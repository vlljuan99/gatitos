// Sorteos del panel: cómo se escriben los números, el resumen de una papeleta
// y el texto para mandarla por WhatsApp. Los números se reparten y se sortean
// en el servidor (server/src/routes/adminRaffles.js).

/** 7 con 3 cifras → «007». */
export const formatNumber = (number, digits) => String(number).padStart(digits, '0');

/** «12 €» o «12,50 €». */
export const raffleEuros = (value) =>
  `${Number(value ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

export const entriesLabel = (entries) => `${entries} participaci${entries === 1 ? 'ón' : 'ones'}`;

/** «3 participaciones · 15 números · 9 €» */
export const ticketSummary = (ticket) =>
  `${entriesLabel(ticket.entries)} · ${ticket.numbers.length} número${ticket.numbers.length === 1 ? '' : 's'} · ${raffleEuros(ticket.amount)}`;

/** Lo que va bajo los números: cuándo y cómo se sortea. */
export const drawLine = (raffle) => (raffle.drawInfo ? `Se sortea ${raffle.drawInfo}.` : '');

/** Texto para acompañar la papeleta en WhatsApp. */
export function ticketText(raffle, ticket) {
  const numbers = [...ticket.numbers]
    .sort((a, b) => a - b)
    .map((n) => formatNumber(n, raffle.digits))
    .join(' · ');
  return [
    `🐾 *${raffle.title} · Bigotes*`,
    `¡Gracias por participar, ${ticket.name}!`,
    '',
    `*Tus números:* ${numbers}`,
    ticketSummary(ticket),
    drawLine(raffle),
    '',
    '¡Mucha suerte! 🍀',
  ]
    .filter((line, i, all) => line !== '' || (all[i - 1] !== '' && i > 0))
    .join('\n');
}
