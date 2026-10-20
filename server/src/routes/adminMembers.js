import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { getContent } from '../content.js';
import {
  listMembers,
  loadMember,
  loadPayment,
  MEMBER_METHODS,
  MEMBER_PERIODS,
  memberPayments,
  nextMemberNumber,
  nextReceiptNumber,
} from '../members.js';
import { mailEnabled, sendMemberReceipt } from '../notify.js';
import { today } from '../numbers.js';
import { receiptPaperData } from '../papers/data.js';
import { formatDate } from '../papers/pdf.js';
import { renderPaper } from '../papers/router.js';
import { email, parseBody, parseId, phone, requiredDay, requiredDecimal, requiredText, text } from '../validation.js';

// Socios y socias en el panel: alta, datos, bajas y pagos. Al apuntar un pago
// se crea su recibo (R-2026-001) con el periodo que cubre y se le manda por
// correo con el PDF adjunto. Cualquiera del equipo lo gestiona; borrar
// (personas o recibos) es cosa de un bigote mayor.

const NOT_FOUND = 'No encontramos a este socio o socia';
const EXAMPLE_EMAIL = 'hola@bigotes.example';

const memberSchema = z.object({
  name: requiredText(120, 'Escribe el nombre'),
  dni: text(20).default(''),
  email: z.union([z.literal(''), email()]).default(''),
  phone: z.union([z.literal(''), phone()]).default(''),
  address: text(300).default(''),
  municipality: text(100).default(''),
  fee: requiredDecimal({ min: 1, max: 10000, message: 'Escribe la cuota en euros, por ejemplo 5 o 12,50', required: 'Escribe la cuota' }),
  period: z.enum(Object.keys(MEMBER_PERIODS), 'Elige cada cuánto paga'),
  method: z.union([z.literal(''), z.enum(Object.keys(MEMBER_METHODS))]).default(''),
  notes: text(2000).default(''),
});

const paymentSchema = z
  .object({
    paidOn: requiredDay('Indica el día del pago').refine((day) => day <= today(), 'La fecha no puede ser futura'),
    amount: requiredDecimal({ min: 0.01, max: 100000, message: 'Escribe el importe en euros, por ejemplo 15 o 12,50' }),
    periodFrom: requiredDay('Indica desde cuándo'),
    periodTo: requiredDay('Indica hasta cuándo'),
    method: z.enum(Object.keys(MEMBER_METHODS), 'Elige cómo ha pagado'),
    notes: text(500).default(''),
    sendEmail: z.boolean().default(true),
  })
  .refine((data) => data.periodTo >= data.periodFrom, { path: ['periodTo'], message: 'Tiene que ser después del inicio' });

const cents = (euros) => Math.round(euros * 100);

/** A quién responde la persona si contesta al correo: el email de contacto de la web. */
function associationReplyTo() {
  const contact = getContent('contact').email;
  const legal = getContent('legal').email;
  return contact || (legal && legal !== EXAMPLE_EMAIL ? legal : '');
}

/**
 * Manda (o vuelve a mandar) el recibo de un pago con el PDF adjunto y apunta
 * cómo ha ido. Devuelve { sent, reason }.
 */
export async function emailReceipt(paymentId) {
  const data = receiptPaperData(paymentId);
  const { member, payment } = data;
  let result;
  if (!member.email) {
    result = { sent: false, reason: 'No tiene email: añádelo a su ficha para mandarle el recibo' };
  } else {
    result = await renderPaper('recibo', data, [payment.receiptNumber, member.name]).then(
      ({ pdf, file }) =>
        sendMemberReceipt({
          member,
          payment,
          pdf,
          filename: file,
          thanks: data.thanks,
          replyTo: associationReplyTo(),
          rows: [
            ['Recibo', payment.receiptNumber],
            ['Importe', payment.formatted],
            ['Periodo cubierto', `del ${formatDate(payment.periodFrom)} al ${formatDate(payment.periodTo)}`],
            ['Forma de pago', MEMBER_METHODS[payment.method] ?? 'Otra'],
          ],
        }),
      (error) => {
        console.error('[socios] No se pudo preparar el recibo:', error);
        return { sent: false, reason: 'No se ha podido preparar el PDF del recibo' };
      },
    );
  }
  db.prepare(
    `UPDATE member_payments SET
       emailed_at = CASE WHEN @sent THEN datetime('now') ELSE emailed_at END,
       emailed_to = CASE WHEN @sent THEN @to ELSE emailed_to END,
       email_error = @error
     WHERE id = @id`,
  ).run({ sent: result.sent ? 1 : 0, to: member.email, error: result.sent ? '' : result.reason, id: paymentId });
  return result;
}

/** Estado según los pagos que le quedan: activo si tiene alguno; si no, pendiente (las bajas se quedan en baja). */
function refreshStatus(memberId) {
  db.prepare(
    `UPDATE members SET status = CASE
       WHEN status = 'baja' THEN 'baja'
       WHEN EXISTS (SELECT 1 FROM member_payments WHERE member_id = members.id) THEN 'activo'
       ELSE 'pendiente' END,
     updated_at = datetime('now')
     WHERE id = ?`,
  ).run(memberId);
}

export function adminMembersRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    const members = listMembers();
    const year = today().slice(0, 4);
    const collected = db
      .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS cents, COUNT(*) AS n FROM member_payments WHERE strftime('%Y', paid_on) = ?")
      .get(year);
    const counts = { pendiente: 0, al_dia: 0, renovar: 0, caducada: 0, baja: 0 };
    for (const m of members) counts[m.state] += 1;
    const donations = getContent('donations');
    res.json({
      members,
      counts,
      totals: { year: Number(year), collected: collected.cents / 100, payments: collected.n },
      periods: MEMBER_PERIODS,
      methods: MEMBER_METHODS,
      mailEnabled: mailEnabled(),
      payTo: { bizum: donations.bizum, iban: donations.iban },
    });
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const member = loadMember(id);
    if (!member) return res.status(404).json({ error: NOT_FOUND });
    res.json({ member, payments: memberPayments(id), mailEnabled: mailEnabled() });
  });

  router.post('/', (req, res) => {
    const data = parseBody(memberSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `INSERT INTO members (name, dni, email, phone, address, municipality, fee_cents, period, method, notes, source)
         VALUES (@name, @dni, @email, @phone, @address, @municipality, @feeCents, @period, @method, @notes, 'panel')`,
      )
      .run({ ...data, feeCents: cents(data.fee) });
    res.status(201).json({ member: loadMember(info.lastInsertRowid) });
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(memberSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `UPDATE members SET name = @name, dni = @dni, email = @email, phone = @phone, address = @address,
           municipality = @municipality, fee_cents = @feeCents, period = @period, method = @method, notes = @notes,
           updated_at = datetime('now')
         WHERE id = @id`,
      )
      .run({ ...data, feeCents: cents(data.fee), id });
    if (info.changes === 0) return res.status(404).json({ error: NOT_FOUND });
    res.json({ member: loadMember(id) });
  });

  // Dar de baja o volver a dar de alta.
  router.patch('/:id/estado', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(z.object({ status: z.enum(['baja', 'activo'], 'Estado no válido') }), req, res);
    if (!data) return;
    const member = loadMember(id);
    if (!member) return res.status(404).json({ error: NOT_FOUND });
    if (data.status === 'baja') {
      db.prepare("UPDATE members SET status = 'baja', left_on = ?, updated_at = datetime('now') WHERE id = ?").run(today(), id);
    } else {
      db.prepare("UPDATE members SET status = 'pendiente', left_on = NULL WHERE id = ?").run(id);
      refreshStatus(id);
    }
    res.json({ member: loadMember(id) });
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const member = loadMember(id);
    if (!member) return res.status(404).json({ error: NOT_FOUND });
    if (member.paymentsCount > 0) {
      return res.status(409).json({
        error: 'Tiene recibos, que hay que guardar para la contabilidad. Dale de baja en lugar de borrarle (o borra antes sus recibos si eran un error).',
      });
    }
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // --- Pagos y recibos -----------------------------------------------------

  router.post('/:id/pagos', async (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(paymentSchema, req, res);
    if (!data) return;
    if (!loadMember(id)) return res.status(404).json({ error: NOT_FOUND });
    const paymentId = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO member_payments (member_id, receipt_number, paid_on, amount_cents, period_from, period_to, method, notes, created_by)
           VALUES (@memberId, @receipt, @paidOn, @amountCents, @periodFrom, @periodTo, @method, @notes, @createdBy)`,
        )
        .run({
          ...data,
          memberId: id,
          receipt: nextReceiptNumber(Number(data.paidOn.slice(0, 4))),
          amountCents: cents(data.amount),
          createdBy: req.user.id,
        });
      // Con el primer pago es socio/a de pleno derecho: número y fecha de alta.
      // Si estaba de baja y vuelve a pagar, vuelve a estar de alta.
      db.prepare(
        `UPDATE members SET
           number = COALESCE(number, @number),
           joined_on = COALESCE(joined_on, @paidOn),
           status = 'activo', left_on = NULL, updated_at = datetime('now')
         WHERE id = @id`,
      ).run({ number: nextMemberNumber(), paidOn: data.paidOn, id });
      return info.lastInsertRowid;
    })();
    // email: null si no se ha pedido mandarlo.
    const email = data.sendEmail ? await emailReceipt(paymentId) : null;
    res.status(201).json({ payment: loadPayment(paymentId), member: loadMember(id), email });
  });

  router.put('/:id/pagos/:paymentId', (req, res) => {
    const id = parseId(req.params.id, res);
    const paymentId = parseId(req.params.paymentId, res);
    if (id === null || paymentId === null) return;
    const data = parseBody(paymentSchema, req, res);
    if (!data) return;
    const info = db
      .prepare(
        `UPDATE member_payments SET paid_on = @paidOn, amount_cents = @amountCents, period_from = @periodFrom,
           period_to = @periodTo, method = @method, notes = @notes, updated_at = datetime('now')
         WHERE id = @paymentId AND member_id = @id`,
      )
      .run({ ...data, amountCents: cents(data.amount), paymentId, id });
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos este recibo' });
    res.json({ payment: loadPayment(paymentId), member: loadMember(id) });
  });

  router.post('/:id/pagos/:paymentId/enviar', async (req, res) => {
    const id = parseId(req.params.id, res);
    const paymentId = parseId(req.params.paymentId, res);
    if (id === null || paymentId === null) return;
    const payment = loadPayment(paymentId);
    if (!payment || payment.memberId !== id) return res.status(404).json({ error: 'No encontramos este recibo' });
    const email = await emailReceipt(paymentId);
    res.json({ payment: loadPayment(paymentId), email });
  });

  router.delete('/:id/pagos/:paymentId', requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    const paymentId = parseId(req.params.paymentId, res);
    if (id === null || paymentId === null) return;
    const info = db.prepare('DELETE FROM member_payments WHERE id = ? AND member_id = ?').run(paymentId, id);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos este recibo' });
    refreshStatus(id);
    res.json({ member: loadMember(id) });
  });

  return router;
}

