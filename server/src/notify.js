import { MAIL, PUBLIC_URL } from './config.js';

// Avisos por email mediante la API de Resend. Si no hay clave configurada no
// se envía nada: todo queda igualmente en el panel. Un fallo al enviar nunca
// hace fallar la solicitud del usuario.

export const mailEnabled = () => Boolean(MAIL.resendApiKey && MAIL.from);

async function send({ to, subject, text, replyTo }) {
  if (!mailEnabled() || !to) return;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MAIL.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL.from, to: [to], subject, text, reply_to: replyTo }),
    });
    if (!response.ok) console.error('[email] Resend respondió', response.status, await response.text());
  } catch (error) {
    console.error('[email] No se pudo enviar el aviso:', error.message);
  }
}

export function notifyNewApplication(application) {
  const cat = application.catName ? ` para ${application.catName}` : '';
  return Promise.all([
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

export function notifyNewVolunteer(volunteer) {
  return send({
    to: MAIL.notifyTo,
    subject: `🙋 ${volunteer.name} quiere ser voluntario/a`,
    replyTo: volunteer.email,
    text: `${volunteer.name} (${volunteer.municipality}) se ha ofrecido como voluntario/a.\n\nVer en el panel: ${PUBLIC_URL}/admin/voluntariado`,
  });
}
