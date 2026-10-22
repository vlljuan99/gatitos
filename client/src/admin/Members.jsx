import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Eye, Mail, Phone, Plus, Printer, Receipt, RotateCcw, Search, Send, Trash2, TriangleAlert, UserPlus } from 'lucide-react';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { Checkbox, Choice, Field, FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { invalidate } from '../lib/useApi.js';
import { useDraftState } from '../lib/drafts.js';
import { euros, feeText, MEMBER_METHODS, MEMBER_PERIODS, MEMBER_STATES, suggestPeriod } from '../lib/members.js';
import { AdminPage, isAdmin, refreshAfterChange, shortDate, Tabs, todayIso, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { PdfLink } from './paperLinks.jsx';
import { PaperRow } from './Papers.jsx';
import { PdfPreview } from './PdfPreview.jsx';

// Socios y socias: quién paga cuota, hasta cuándo está al día y sus recibos.
// Al apuntar un pago se crea el recibo (con el periodo que cubre) y, si hay
// correo configurado y la persona tiene email, le llega con el PDF adjunto.

const EMPTY = { name: '', dni: '', email: '', phone: '', address: '', municipality: '', fee: '', period: 'mensual', method: 'bizum', notes: '' };
const PERIOD_CHOICES = Object.entries(MEMBER_PERIODS).map(([value, p]) => ({ value, label: p.label }));
const selectClass =
  'w-full appearance-none rounded-2xl border-2 border-borde bg-nata px-4 py-3 text-base text-cacao transition focus:border-canela focus:outline-none';

const toForm = (member) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, member[key] ?? ''])),
  fee: member.fee === null || member.fee === undefined ? '' : String(member.fee).replace('.', ','),
  method: member.method || 'bizum',
});

function StatePill({ state, className }) {
  const info = MEMBER_STATES[state];
  return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', info.tone, className)}>{info.short}</span>;
}

function MethodSelect({ value, onChange, error, label = 'Forma de pago' }) {
  return (
    <Field label={label} error={error}>
      {({ id }) => (
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
          {Object.entries(MEMBER_METHODS).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Datos de un socio/a (alta en el panel y edición). */
function MemberFields({ form, set, errors }) {
  return (
    <>
      <TextInput label="Nombre y apellidos" autoComplete="off" value={form.name} onChange={set('name')} error={errors.name} maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Cuota (€)" inputMode="decimal" placeholder="5" value={form.fee} onChange={set('fee')} error={errors.fee} />
        <MethodSelect value={form.method} onChange={set('method')} error={errors.method} label="Suele pagar por" />
      </div>
      <Choice label="Cada cuánto" options={PERIOD_CHOICES} value={form.period} onChange={set('period')} error={errors.period} />
      <TextInput label="Email" optional type="email" inputMode="email" hint="Aquí le llegan los recibos." value={form.email} onChange={set('email')} error={errors.email} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Teléfono" optional type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} maxLength={30} />
        <TextInput label="DNI / NIE" optional autoComplete="off" value={form.dni} onChange={set('dni')} error={errors.dni} maxLength={20} />
      </div>
      <TextInput label="Municipio" optional value={form.municipality} onChange={set('municipality')} error={errors.municipality} maxLength={100} />
      <TextInput label="Dirección" optional hint="Para el libro de socios y el recibo." value={form.address} onChange={set('address')} error={errors.address} maxLength={300} />
      <TextArea label="Notas" optional rows={2} value={form.notes} onChange={set('notes')} error={errors.notes} />
    </>
  );
}

function NewMemberSheet({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm, draft] = useDraftState('socio-nuevo', EMPTY, { storage: 'local' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { member } = await api('/admin/socios', { method: 'POST', body: form });
      draft.discard();
      setForm(EMPTY);
      refreshAfterChange();
      toast(`${member.name} ya está en la lista 💛`);
      navigate(`/admin/socios/${member.id}`);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo socio o socia">
      <form onSubmit={save} className="grid gap-4" noValidate>
        <MemberFields form={form} set={set} errors={errors} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          Añadir
        </Button>
        <p className="text-center text-sm text-cacao-suave">Después podrás apuntar su primer pago.</p>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

const LIST_TABS = [
  { value: 'pendiente', label: 'Nuevas', states: ['pendiente'] },
  { value: 'renovar', label: 'Por renovar', states: ['renovar', 'caducada'] },
  { value: 'al_dia', label: 'Al día', states: ['al_dia', 'renovar'] },
  { value: 'baja', label: 'Bajas', states: ['baja'] },
  { value: 'todas', label: 'Todas', states: null },
];

export default function Members() {
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useAdminApi('/socios');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const members = useMemo(() => data?.members ?? [], [data]);
  const count = (states) => members.filter((m) => !states || states.includes(m.state)).length;
  // Por defecto, lo que pide atención: altas nuevas o cuotas por renovar; si no hay, quién está al día.
  const fallback = count(['pendiente']) ? 'pendiente' : count(['renovar', 'caducada']) ? 'renovar' : 'al_dia';
  const tab = LIST_TABS.some((t) => t.value === params.get('ver')) ? params.get('ver') : fallback;
  const states = LIST_TABS.find((t) => t.value === tab).states;
  const q = query.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      (q ? true : !states || states.includes(m.state)) &&
      (!q || [m.name, m.email, m.phone, m.municipality, m.number && `${m.number}`].some((v) => v && String(v).toLowerCase().includes(q))),
  );

  return (
    <AdminPage
      title="Socios y socias 💛"
      subtitle="Quién paga cuota, hasta cuándo está al día y sus recibos."
      action={
        <PdfLink path="/socios" label="Libro de socios y socias en PDF">
          <Printer className="size-4" /> Libro
        </PdfLink>
      }
    >
      {data && !data.mailEnabled && (
        <Card className="mb-4 flex gap-3 bg-mantequilla">
          <TriangleAlert className="size-6 shrink-0 text-mantequilla-oscuro" aria-hidden />
          <p className="text-sm">
            <strong>El envío de correos aún no está configurado en el servidor.</strong> Los pagos y sus recibos se guardan igual, pero
            no se mandan solos: puedes abrir cada recibo en PDF y enviarlo por WhatsApp. Para activarlo hay que poner la clave de
            Resend (ver <em>deploy/README.md</em>).
          </p>
        </Card>
      )}
      <Button size="lg" block onClick={() => setAdding(true)} className="mb-5">
        <UserPlus className="size-5" /> Añadir socio/a
      </Button>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[
            ['Al día', count(['al_dia', 'renovar']), 'bg-menta text-menta-oscuro'],
            ['Por renovar', count(['renovar', 'caducada']), 'bg-melocoton text-melocoton-oscuro'],
            [`Cuotas ${data.totals.year}`, euros(data.totals.collected), 'bg-mantequilla text-mantequilla-oscuro'],
          ].map(([label, value, tone]) => (
            <Card key={label} className={cx('p-3', tone)}>
              <p className="font-display text-xl font-semibold leading-tight">{value}</p>
              <p className="text-xs font-bold">{label}</p>
            </Card>
          ))}
        </div>
      )}
      {data && members.length > 0 && (
        <>
          <label className="relative mb-3 block">
            <span className="sr-only">Buscar</span>
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-cacao-suave" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, email, teléfono o n.º"
              className="w-full rounded-2xl border-2 border-borde bg-nata py-3 pr-4 pl-12 text-base focus:border-canela focus:outline-none"
            />
          </label>
          {!q && (
            <Tabs
              value={tab}
              onChange={(value) => setParams({ ver: value }, { replace: true })}
              tabs={LIST_TABS.map((t) => ({ value: t.value, label: t.label, count: t.value === 'todas' ? 0 : count(t.states) }))}
            />
          )}
        </>
      )}
      {data && members.length === 0 && (
        <EmptyState title="Aún no hay socios ni socias" tone="mantequilla">
          Quien se apunte en «Hazte socio/a» de la web aparecerá aquí. También puedes añadir a quien se apunte en persona.
        </EmptyState>
      )}
      {data && members.length > 0 && shown.length === 0 && <p className="py-6 text-center text-cacao-suave">Nadie por aquí.</p>}
      <ul className="grid gap-2">
        {shown.map((m) => (
          <li key={m.id}>
            <Link to={`/admin/socios/${m.id}`} className="flex items-center gap-3 rounded-3xl bg-nata p-3 shadow-suave">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mantequilla font-display font-semibold text-mantequilla-oscuro" aria-hidden>
                {m.number ?? '💛'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{m.name}</span>
                <span className="block truncate text-sm text-cacao-suave">
                  {feeText(m.fee, m.period)}
                  {m.paidUntil && m.state !== 'baja' && ` · hasta ${shortDate(m.paidUntil)}`}
                  {m.state === 'pendiente' && ` · desde ${m.source === 'web' ? 'la web' : 'el panel'}, ${shortDate(m.createdAt)}`}
                </span>
              </span>
              <StatePill state={m.state} className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      <NewMemberSheet open={adding} onClose={() => setAdding(false)} />
    </AdminPage>
  );
}

// ---------------------------------------------------------------------------
// Ficha de un socio/a
// ---------------------------------------------------------------------------

/** Apuntar un pago: importe, cuántas cuotas y el periodo que cubre (se calcula solo). */
function PaymentSheet({ member, open, onClose, onSaved, mailEnabled }) {
  const today = todayIso();
  const pristine = { paidOn: today, count: 1, amount: String(member.fee).replace('.', ','), method: member.method || 'bizum', notes: '', custom: false, periodFrom: '', periodTo: '' };
  const [form, setForm] = useState(pristine);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canEmail = Boolean(member.email) && mailEnabled;
  const [sendEmail, setSendEmail] = useState(true);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const suggested = suggestPeriod({ paidUntil: member.paidUntil, paidOn: form.paidOn || today, period: member.period, count: form.count });
  const period = form.custom ? { from: form.periodFrom || suggested.from, to: form.periodTo || suggested.to } : suggested;

  function setCount(count) {
    const n = Math.min(12, Math.max(1, count));
    setForm((f) => ({ ...f, count: n, amount: String(Math.round(member.fee * n * 100) / 100).replace('.', ',') }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api(`/admin/socios/${member.id}/pagos`, {
        method: 'POST',
        body: { paidOn: form.paidOn, amount: form.amount, method: form.method, notes: form.notes, periodFrom: period.from, periodTo: period.to, sendEmail: canEmail && sendEmail },
      });
      setForm(pristine);
      onSaved(result);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Apuntar un pago">
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Field label="¿Cuántas cuotas paga?" hint={`Su cuota: ${feeText(member.fee, member.period)}.`}>
          {() => (
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setCount(form.count - 1)} disabled={form.count <= 1} aria-label="Una cuota menos">
                −
              </Button>
              <span className="min-w-10 text-center font-display text-2xl font-semibold" aria-live="polite">
                {form.count}
              </span>
              <Button variant="secondary" onClick={() => setCount(form.count + 1)} disabled={form.count >= 12} aria-label="Una cuota más">
                +
              </Button>
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Importe (€)" inputMode="decimal" value={form.amount} onChange={set('amount')} error={errors.amount} />
          <TextInput label="Día del pago" type="date" value={form.paidOn} onChange={set('paidOn')} error={errors.paidOn} max={today} />
        </div>
        <MethodSelect value={form.method} onChange={set('method')} error={errors.method} />
        <div className="rounded-2xl bg-menta p-3">
          <p className="text-sm font-bold text-menta-oscuro">Cubre</p>
          <p className="font-display text-lg font-semibold">
            del {shortDate(period.from)} al {shortDate(period.to)}
          </p>
          {!form.custom ? (
            <button
              type="button"
              className="text-sm font-bold underline"
              onClick={() => setForm((f) => ({ ...f, custom: true, periodFrom: period.from, periodTo: period.to }))}
            >
              Cambiar las fechas
            </button>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <TextInput label="Desde" type="date" value={form.periodFrom} onChange={set('periodFrom')} error={errors.periodFrom} />
              <TextInput label="Hasta" type="date" value={form.periodTo} onChange={set('periodTo')} error={errors.periodTo} />
            </div>
          )}
        </div>
        <TextInput label="Notas" optional value={form.notes} onChange={set('notes')} error={errors.notes} maxLength={500} />
        {canEmail ? (
          <Checkbox checked={sendEmail} onChange={setSendEmail}>
            Mandarle el recibo por correo a <strong>{member.email}</strong>
          </Checkbox>
        ) : (
          <p className="rounded-2xl bg-crema p-3 text-sm text-cacao-suave">
            {member.email ? 'El correo no está configurado: ' : 'No tiene email: '}
            el recibo se guarda y podrás abrirlo en PDF para dárselo o mandarlo por WhatsApp.
          </p>
        )}
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          <Receipt className="size-5" /> Apuntar pago y crear recibo
        </Button>
      </form>
    </Sheet>
  );
}

function PaymentItem({ member, payment, canDelete, onResend, onDelete, mailEnabled }) {
  const [viewing, setViewing] = useState(false);
  const [sending, setSending] = useState(false);
  const title = `Recibo ${payment.receiptNumber}`;
  return (
    <li className="grid gap-2 rounded-2xl bg-crema p-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-bold">{payment.receiptNumber}</span>
        <span className="font-display text-lg font-semibold">{euros(payment.amount)}</span>
        <span className="text-sm text-cacao-suave">
          {shortDate(payment.paidOn)} · {MEMBER_METHODS[payment.method] ?? 'Otra'}
        </span>
      </div>
      <p className="text-sm">
        Cubre del {shortDate(payment.periodFrom)} al {shortDate(payment.periodTo)}
      </p>
      {payment.emailedAt ? (
        <p className="text-sm font-bold text-menta-oscuro">
          📧 Enviado el {shortDate(payment.emailedAt)} a {payment.emailedTo}
        </p>
      ) : (
        payment.emailError && <p className="text-sm text-canela-oscuro">No se ha enviado por correo: {payment.emailError}</p>
      )}
      {payment.notes && <p className="text-sm text-cacao-suave">{payment.notes}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={() => setViewing(true)} aria-label={`Ver ${title}`}>
          <Eye className="size-4" /> Ver
        </Button>
        <PdfLink path={`/recibo/${payment.id}`} download label={`Descargar ${title}`}>
          <Download className="size-4" /> Descargar
        </PdfLink>
        <PdfLink path={`/recibo/${payment.id}`} label={`${title} en PDF`}>
          <Printer className="size-4" /> Imprimir
        </PdfLink>
        {member.email && mailEnabled && (
          <Button
            size="sm"
            variant="secondary"
            loading={sending}
            onClick={async () => {
              setSending(true);
              await onResend(payment);
              setSending(false);
            }}
          >
            <Send className="size-4" /> {payment.emailedAt ? 'Reenviar' : 'Enviar'}
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(payment)} aria-label={`Borrar ${title}`}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <PdfPreview path={`/recibo/${payment.id}`} title={title} a5 open={viewing} onClose={() => setViewing(false)} />
    </li>
  );
}

function reminderText(member) {
  const first = member.name.split(' ')[0];
  if (member.state === 'pendiente') {
    return `¡Hola, ${first}! 🐾 Te escribimos de Bigotes: gracias por querer hacerte socio/a. ¿Te pasamos los datos para pagar la primera cuota (${feeText(member.fee, member.period)})?`;
  }
  if (member.state === 'renovar' || member.state === 'caducada') {
    const when = member.state === 'caducada' ? 'venció' : 'vence';
    return `¡Hola, ${first}! 🐾 Tu cuota de socio/a de Bigotes ${when} el ${shortDate(member.paidUntil)}. ¿Te pasamos los datos para renovarla? ¡Gracias por cuidar de los gatos con nosotros!`;
  }
  return `¡Hola, ${first}! 🐾`;
}

export function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi(`/socios/${id}`);
  // Abrir su ficha la quita de los avisos de «nuevas» (lo marca el servidor).
  const loaded = Boolean(data);
  useEffect(() => {
    if (loaded) invalidate('/admin/resumen');
  }, [id, loaded]);
  const [paying, setPaying] = useState(false);
  const [ask, dialog] = useConfirm();

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { member, payments, mailEnabled } = data;
  const info = MEMBER_STATES[member.state];
  const status =
    member.state === 'pendiente'
      ? `Se apuntó ${member.source === 'web' ? 'desde la web' : 'en el panel'} el ${shortDate(member.createdAt)} y aún no ha pagado.`
      : member.state === 'baja'
        ? `De baja desde el ${shortDate(member.leftOn)}.`
        : member.state === 'caducada'
          ? `Su cuota venció el ${shortDate(member.paidUntil)}.`
          : `Al día hasta el ${shortDate(member.paidUntil)}.`;

  async function changeStatus(next) {
    if (next === 'baja') {
      const ok = await ask({
        title: `¿Dar de baja a ${member.name}?`,
        body: 'Deja de contar como socio/a. Sus recibos se guardan. Puedes volver a darle de alta cuando quieras.',
        confirmLabel: 'Sí, dar de baja',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await api(`/admin/socios/${member.id}/estado`, { method: 'PATCH', body: { status: next } });
      refreshAfterChange();
      reload();
      toast(next === 'baja' ? 'Dado/a de baja' : '¡Otra vez de alta! 💛');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function remove() {
    const ok = await ask({
      title: `¿Borrar a ${member.name}?`,
      body: 'Se borran sus datos para siempre (si lo pide, es su derecho). Si tiene recibos, hay que darle de baja: los recibos se guardan para la contabilidad.',
      confirmLabel: 'Sí, borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/socios/${member.id}`, { method: 'DELETE' });
      refreshAfterChange();
      toast(`${member.name} borrado/a`);
      navigate('/admin/socios', { replace: true });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function resend(payment) {
    try {
      const result = await api(`/admin/socios/${member.id}/pagos/${payment.id}/enviar`, { method: 'POST' });
      reload();
      toast(result.email.sent ? `Recibo enviado a ${member.email} 📧` : `No se ha podido enviar: ${result.email.reason}`, {
        tone: result.email.sent ? undefined : 'error',
      });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function removePayment(payment) {
    const ok = await ask({
      title: `¿Borrar el recibo ${payment.receiptNumber}?`,
      body: 'Solo si fue un error: desaparece de las cuentas y su número no se vuelve a usar.',
      confirmLabel: 'Sí, borrarlo',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/socios/${member.id}/pagos/${payment.id}`, { method: 'DELETE' });
      refreshAfterChange();
      reload();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <AdminPage title={member.name} back="/admin/socios" subtitle={[member.number && `Socio/a n.º ${member.number}`, feeText(member.fee, member.period)].filter(Boolean).join(' · ')}>
      <div className="grid gap-4">
        <Card className={cx('grid gap-3', info.tone)}>
          <div>
            <p className="font-display text-xl font-semibold">{info.label}</p>
            <p>{status}</p>
          </div>
          {member.state !== 'baja' ? (
            <Button size="lg" block onClick={() => setPaying(true)}>
              <Plus className="size-5" /> Apuntar pago
            </Button>
          ) : (
            <Button size="lg" block variant="secondary" onClick={() => changeStatus('activo')}>
              <RotateCcw className="size-5" /> Volver a dar de alta
            </Button>
          )}
        </Card>

        {(member.phone || member.email) && (
          <div className="flex flex-wrap gap-2">
            {member.phone && (
              <>
                <a href={`tel:${member.phone.replace(/\s/g, '')}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-nata px-4 font-bold shadow-suave">
                  <Phone className="size-4" /> Llamar
                </a>
                <a
                  href={whatsappUrl(member.phone, reminderText(member))}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-nata px-4 font-bold shadow-suave"
                >
                  <WhatsAppIcon /> {member.state === 'renovar' || member.state === 'caducada' ? 'Recordar la cuota' : 'WhatsApp'}
                </a>
              </>
            )}
            {member.email && (
              <a href={`mailto:${member.email}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-nata px-4 font-bold shadow-suave">
                <Mail className="size-4" /> Email
              </a>
            )}
          </div>
        )}

        {member.message && (
          <Card className="bg-lavanda">
            <p className="text-sm font-bold text-lavanda-oscuro">Nos escribió al apuntarse</p>
            <p className="mt-1 whitespace-pre-line">{member.message}</p>
          </Card>
        )}

        <Card className="grid gap-3">
          <h2 className="font-display text-xl font-semibold">Recibos</h2>
          {payments.length === 0 ? (
            <p className="text-cacao-suave">Todavía no hay pagos. Al apuntar el primero se le da su número de socio/a.</p>
          ) : (
            <ul className="grid gap-2">
              {payments.map((payment) => (
                <PaymentItem
                  key={payment.id}
                  member={member}
                  payment={payment}
                  mailEnabled={mailEnabled}
                  canDelete={isAdmin(user)}
                  onResend={resend}
                  onDelete={removePayment}
                />
              ))}
            </ul>
          )}
        </Card>

        <MemberData key={member.updatedAt} member={member} onSaved={reload} />

        <Card className="grid gap-3">
          <h2 className="font-display text-xl font-semibold">Papeles</h2>
          <ul className="grid gap-2">
            <PaperRow icon={UserPlus} title="Hoja de inscripción" hint="A5 · con sus datos, para que la firme" path={`/socio/${member.id}/inscripcion`} a5 tone="bg-lavanda text-lavanda-oscuro" />
          </ul>
        </Card>

        <div className="flex flex-wrap gap-2">
          {member.state !== 'baja' && (
            <Button variant="danger" onClick={() => changeStatus('baja')}>
              Dar de baja
            </Button>
          )}
          {isAdmin(user) && (
            <Button variant="ghost" onClick={remove}>
              <Trash2 className="size-4" /> Borrar
            </Button>
          )}
        </div>
      </div>
      <PaymentSheet
        key={`${member.id}-${member.paidUntil}`}
        member={member}
        mailEnabled={mailEnabled}
        open={paying}
        onClose={() => setPaying(false)}
        onSaved={(result) => {
          setPaying(false);
          refreshAfterChange();
          reload();
          const number = result.payment.receiptNumber;
          if (result.email?.sent) toast(`Recibo ${number} enviado a ${member.email} 📧`);
          else if (result.email) toast(`Recibo ${number} guardado, pero no se ha podido enviar: ${result.email.reason}`, { duration: 6000 });
          else toast(`Recibo ${number} guardado 🧾`);
        }}
      />
      {dialog}
    </AdminPage>
  );
}

/** Sus datos, editables (con borrador por si se recarga la página). */
function MemberData({ member, onSaved }) {
  const toast = useToast();
  const pristine = toForm(member);
  const [form, setForm, draft] = useDraftState(`socio-${member.id}`, pristine, { storage: 'local', checkBase: true });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const dirty = JSON.stringify(form) !== JSON.stringify(pristine);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/admin/socios/${member.id}`, { method: 'PUT', body: form });
      draft.discard();
      refreshAfterChange();
      onSaved();
      toast('Datos guardados');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <h2 className="font-display text-xl font-semibold">Sus datos</h2>
        <MemberFields form={form} set={set} errors={errors} />
        <FormError>{error}</FormError>
        <Button type="submit" block loading={saving} disabled={!dirty}>
          Guardar datos
        </Button>
      </form>
    </Card>
  );
}
