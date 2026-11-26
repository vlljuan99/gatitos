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

/**
 * Cómo se llama cada número premiado: el primero que tiene dueño es el
 * ganador y los siguientes, suplentes. Uno de fuera que no se vendió (la
 * ONCE…) queda como «Sin vender».
 */
export function drawLabels(draws) {
  let withOwner = 0;
  return draws.map((draw) => {
    if (!draw.winnerName) return 'Sin vender';
    withOwner += 1;
    return withOwner === 1 ? 'Ganador' : `Suplente ${withOwner - 1}`;
  });
}

/** De lo que se escribe (el cupón entero vale) cuentan las últimas cifras. */
export function externalNumber(text, digits) {
  const clean = String(text ?? '').replace(/\D/g, '');
  return clean ? Number(clean.slice(-digits)) : null;
}

/** «ONCE», «lotería»: el sorteo se hace fuera y aquí se apunta el número. */
export const drawsOutside = (drawInfo) => /\bonce\b|loter/i.test(drawInfo ?? '');

/** «con el cupón de la ONCE del 18 de diciembre» → «Cupón de la ONCE del 18 de diciembre». */
export function outsideSource(drawInfo) {
  if (!drawsOutside(drawInfo)) return '';
  const text = drawInfo.trim().replace(/^(con|en)\s+(el|la)\s+/i, '').replace(/\.$/, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
