import { WHATSAPP } from './config.js';

// Avisos por WhatsApp con la API oficial de WhatsApp Business (Cloud API de
// Meta). Son opcionales: sin WHATSAPP_TOKEN y WHATSAPP_PHONE_ID no se envía
// nada y el panel sigue teniendo su botón de WhatsApp con el mensaje escrito.
// WhatsApp solo deja escribir primero con plantillas aprobadas en Meta, así
// que cada aviso es una plantilla con sus huecos ({{1}}, {{2}}…).

export const whatsappEnabled = () => Boolean(WHATSAPP.token && WHATSAPP.phoneId);

/** Teléfono español escrito de cualquier forma → 34600111222. */
export function waNumber(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9) digits = `34${digits}`;
  return digits.length >= 11 ? digits : '';
}

/** Envía una plantilla. Devuelve { sent } o { sent: false, reason }; nunca lanza. */
export async function sendTemplate(to, template, params) {
  const number = waNumber(to);
  if (!whatsappEnabled() || !template) return { sent: false, reason: 'WhatsApp no está configurado' };
  if (!number) return { sent: false, reason: 'Teléfono no válido' };
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: number,
        type: 'template',
        template: {
          name: template,
          language: { code: WHATSAPP.language },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text || '-').slice(0, 200) })) }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error('[whatsapp] Meta respondió', response.status, await response.text());
      return { sent: false, reason: `WhatsApp lo ha rechazado (error ${response.status})` };
    }
    return { sent: true };
  } catch (error) {
    console.error('[whatsapp] No se pudo enviar:', error.message);
    return { sent: false, reason: 'No se ha podido conectar con WhatsApp' };
  }
}
