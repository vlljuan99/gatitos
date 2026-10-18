import { MAIL, PUBLIC_URL, WHATSAPP } from './config.js';
import { escapeHtml } from './og.js';
import { sendTemplate } from './whatsapp.js';

// Avisos por email mediante la API de Resend. Si no hay clave configurada no
// se envía nada: todo queda igualmente en el panel. Un fallo al enviar nunca
// hace fallar la solicitud del usuario.

export const mailEnabled = () => Boolean(MAIL.resendApiKey && MAIL.from);

/**
 * Envía un correo. attachments: [{ filename, content (Buffer) }]. Devuelve
 * { sent: true } o { sent: false, reason } para que el panel pueda contarlo.
 */
export async function send({ to, subject, text, html, replyTo, attachments }) {
  if (!to) return { sent: false, reason: 'No tiene email' };
  if (!mailEnabled()) return { sent: false, reason: 'El envío de correos no está configurado en el servidor' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MAIL.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: MAIL.from,
        to: [to],
        subject,
        text,
        html,
        reply_to: replyTo || undefined,
        attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error('[email] Resend respondió', response.status, await response.text());
      return { sent: false, reason: `El servicio de correo lo ha rechazado (error ${response.status})` };
    }
    return { sent: true };
  } catch (error) {
    console.error('[email] No se pudo enviar el aviso:', error.message);
    return { sent: false, reason: 'No se ha podido conectar con el servicio de correo' };
  }
}

const firstName = (name) => String(name).trim().split(/\s+/)[0];

/**
 * Correo con el estilo de la web: tarjeta blanca sobre crema, la carita del
 * logo y una tabla de datos. rows: [[etiqueta, valor]]. Todo se escapa.
 */
function htmlEmail({ title, paragraphs, rows = [], footer }) {
  const p = (text) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${escapeHtml(text)}</p>`;
  const table = rows.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:6px 0 18px;background:#fbf3ef;border-radius:14px">${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 14px;font-size:14px;color:#6b5d59">${escapeHtml(label)}</td><td style="padding:10px 14px;font-size:15px;font-weight:700;text-align:right">${escapeHtml(value)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#fbf6f2;font-family:Nunito,Arial,sans-serif;color:#2b2727">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#ffffff;border-radius:22px;padding:28px 24px">
<img src="${PUBLIC_URL}/apple-touch-icon.png" width="56" height="56" alt="Bigotes" style="display:block;border-radius:16px;margin-bottom:16px">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#5c3b33">${escapeHtml(title)}</h1>
${paragraphs.map(p).join('\n')}
${table}
${footer ? `<p style="margin:0;font-size:15px;line-height:1.5">${escapeHtml(footer).replaceAll('\n', '<br>')}</p>` : ''}
</div>
<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#7d706c">Bigotes · Asociación para la ayuda al gato callejero · Almendralejo</p>
</div></body></html>`;
}

const textEmail = ({ title, paragraphs, rows = [], footer }) =>
  [title, '', ...paragraphs.flatMap((t) => [t, '']), ...rows.map(([l, v]) => `${l}: ${v}`), rows.length ? '' : null, footer]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

/**
 * Solicitud de adopción completada: aviso al equipo (email y WhatsApp al
 * móvil de Bigotes) y confirmación a quien la envía (email y WhatsApp).
 */
export function notifyNewApplication(application) {
  const cat = application.catName ? ` para ${application.catName}` : '';
  const panel = `${PUBLIC_URL}/admin/solicitudes/${application.id}`;
  const catName = application.catName || 'un gatito';
  return Promise.all([
    sendTemplate(WHATSAPP.notifyTo, WHATSAPP.teamTemplate, [application.name, catName, panel]),
    sendTemplate(application.phone, WHATSAPP.adopterTemplate, [firstName(application.name), catName]),
    send({
      to: MAIL.notifyTo,
      subject: `🐾 Nueva solicitud de adopción${cat}`,
      replyTo: application.email,
      text: `${application.name} (${application.municipality}) ha enviado una solicitud de adopción${cat}.\n\nVer en el panel: ${PUBLIC_URL}/admin/solicitudes/${application.id}`,
    }),
    send({
      to: application.email,
      subject: '¡Hemos recibido tu solicitud! 💕',
      text: `¡Hola, ${application.name}!\n\nGracias por querer adoptar${cat}. Hemos recibido tu solicitud y la leeremos con mucho cariño. En unos días nos pondremos en contacto contigo para contarte los siguientes pasos.\n\nUn ronroneo,\nEl equipo de Bigotes`,
    }),
  ]);
}

export function notifyNewMessage(message) {
  return send({
    to: MAIL.notifyTo,
    subject: `✉️ Nuevo mensaje de ${message.name}${message.subject ? `: ${message.subject}` : ''}`,
    replyTo: message.email,
    text: `${message.body}\n\n— ${message.name} <${message.email}>\n\nVer en el panel: ${PUBLIC_URL}/admin/mensajes`,
  });
}

export function notifyNewTransport(person) {
  const places = person.destinations.map((d) => d.city).join(', ');
  return send({
    to: MAIL.notifyTo,
    subject: `🚗 ${person.name} se apunta a los viajes solidarios`,
    replyTo: person.email,
    text: `${person.name} sale de ${person.origin} y viaja a menudo a ${places}.\n\nVer en el panel: ${PUBLIC_URL}/admin/transporte`,
  });
}

export function notifyNewVolunteer(volunteer) {
  return send({
    to: MAIL.notifyTo,
    subject: `🙋 ${volunteer.name} quiere ser voluntario/a`,
    replyTo: volunteer.email,
    text: `${volunteer.name} (${volunteer.municipality}) se ha ofrecido como voluntario/a.\n\nVer en el panel: ${PUBLIC_URL}/admin/voluntariado`,
  });
}

/**
 * Alguien se hace socio/a desde la web: aviso al equipo y bienvenida con
 * cómo pagar la primera cuota. how: [[etiqueta, valor]] con Bizum, IBAN…
 */
export function notifyNewMember(member, { fee, how, concept, replyTo }) {
  const content = {
    title: `¡Gracias por hacerte socio/a, ${firstName(member.name)}! 💕`,
    paragraphs: [
      `Hemos recibido tu alta con una cuota de ${fee}.`,
      how.length
        ? `Para completarla, haz el primer pago con el concepto «${concept}». En cuanto lo recibamos te mandaremos tu recibo por correo.`
        : 'En unos días te escribiremos para contarte cómo pagar la primera cuota. En cuanto la recibamos te mandaremos tu recibo por correo.',
    ],
    rows: how,
    footer: 'Un ronroneo,\nEl equipo de Bigotes',
  };
  return Promise.all([
    send({
      to: MAIL.notifyTo,
      subject: `💛 ${member.name} quiere hacerse socio/a (${fee})`,
      replyTo: member.email,
      text: `${member.name} (${member.municipality}) se ha apuntado como socio/a con una cuota de ${fee}.\n\nCuando pague, apúntalo en el panel y le llegará su recibo: ${PUBLIC_URL}/admin/socios`,
    }),
    send({ to: member.email, replyTo, subject: content.title, text: textEmail(content), html: htmlEmail(content) }),
  ]);
}

/** Recibo de una cuota, con el PDF adjunto. */
export function sendMemberReceipt({ member, payment, rows, pdf, filename, thanks, replyTo }) {
  const content = {
    title: `¡Gracias, ${firstName(member.name)}! 💕`,
    paragraphs: [`Hemos recibido tu cuota de socio/a de Bigotes. Te adjuntamos el recibo en PDF por si lo necesitas.`, thanks].filter(Boolean),
    rows,
    footer: 'Un ronroneo,\nEl equipo de Bigotes',
  };
  return send({
    to: member.email,
    replyTo,
    subject: `Tu recibo de Bigotes · ${payment.receiptNumber}`,
    text: textEmail(content),
    html: htmlEmail(content),
    attachments: [{ filename, content: pdf }],
  });
}
