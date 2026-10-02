// Textos para compartir un gatito en redes: los datos que salen en la imagen
// y el pie de foto que se copia para Instagram o WhatsApp. Sin DOM ni React
// para poder probarlos con node --test.
import { ageText, gendered } from './cats.js';

const SEX_SHORT = { hembra: 'Hembra', macho: 'Macho' };

/** «a, b y c» */
export function listText(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/** Lo que tiene hecho de salud, en femenino si es una gatita: «Vacunada», «Con microchip»… */
export function healthItems(cat) {
  const g = (word) => gendered(word, cat.sex);
  const { vaccinated, dewormed, microchipped, sterilized } = cat.health ?? {};
  return [
    vaccinated && g('Vacunado'),
    dewormed && g('Desparasitado'),
    microchipped && 'Con microchip',
    sterilized && g('Esterilizado'),
  ].filter(Boolean);
}

/** Etiquetas de la imagen: sexo, edad y hasta dos rasgos de carácter. */
export function catFacts(cat, now = new Date()) {
  return [
    SEX_SHORT[cat.sex],
    ageText(cat.birthDate, now),
    ...(cat.personality ?? []).slice(0, 2).map((tag) => gendered(tag, cat.sex)),
  ].filter(Boolean);
}

/**
 * Contacto de la asociación para la imagen: una línea principal (WhatsApp o
 * teléfono, lo que haya) y otra con la web y el Instagram.
 */
export function contactLines(contact = {}, webUrl = '') {
  const main = contact.whatsapp
    ? `WhatsApp ${contact.whatsapp}`
    : contact.phone
      ? `Tel. ${contact.phone}`
      : contact.email || '';
  const extra = [webUrl, contact.instagram && `@${contact.instagram}`].filter(Boolean).join(' · ');
  return { main, extra };
}

/** Pie de foto listo para pegar en Instagram, Facebook o WhatsApp. */
export function shareCaption(cat, contact = {}, catUrl = '', now = new Date()) {
  const facts = catFacts(cat, now).join(' · ');
  const health = healthItems(cat).map((item) => item.toLowerCase());
  const love = { hembra: '¿Te has enamorado de ella?', macho: '¿Te has enamorado de él?' }[cat.sex] ?? '¿Te has enamorado?';
  const phone = contact.whatsapp ? `WhatsApp ${contact.whatsapp}` : contact.phone ? `Teléfono ${contact.phone}` : '';
  return [
    `🐾 ¡${cat.name} busca hogar!`,
    cat.summary,
    facts,
    health.length ? `Se entrega ${listText(health)}.` : '',
    `💌 ${love} Rellena la solicitud en ${catUrl}`,
    phone && `📞 ${phone}`,
    '📍 Adopciones en Extremadura y, con nuestro transporte solidario, también más lejos. ¡Gracias por compartir!',
    '#adopta #adoptaungato #gatosenadopcion #Almendralejo #Extremadura #Bigotes',
  ]
    .filter(Boolean)
    .join('\n\n');
}
