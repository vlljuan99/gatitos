import { z } from 'zod';
import { db } from './db.js';

// Textos editables desde el panel. Cada clave tiene un valor por defecto que
// sirve mientras nadie lo cambie, y un esquema que valida lo que se guarda.
// Los textos por defecto son un punto de partida: la asociación debe revisarlos.

const line = (max) => z.string().trim().max(max);

// Enlaces que la web publica como href: vacíos o direcciones http(s)
// absolutas. «paypal.me/bigotes» se guarda como «https://paypal.me/bigotes»;
// sin esto el navegador lo trataría como una ruta de la propia web.
const webUrl = (example) =>
  line(300)
    .transform((value) => (value && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? `https://${value}` : value))
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.');
      } catch {
        return false;
      }
    }, `Escribe un enlace completo, por ejemplo ${example}`);

// Instagram se guarda como nombre de usuario, venga como «@usuario» o como enlace.
const instagramHandle = line(200)
  .transform((value) =>
    value
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/[/?#].*$/, ''),
  )
  .refine((value) => /^[A-Za-z0-9._]{0,30}$/.test(value), 'Escribe el usuario de Instagram, por ejemplo @bigotes');

const DEFAULT_FEE =
  'La adopción tiene una cuota que ayuda a cubrir parte de los gastos veterinarios (vacunas, microchip, desparasitación y esterilización). Te contamos el importe y lo que incluye en la entrevista.';

export const CONTENT = {
  home: {
    schema: z.object({
      heroTitle: line(120).min(1, 'Escribe un titular'),
      heroText: line(400),
      rescuedBase: z.coerce.number().int().min(0).max(100000),
    }),
    defaults: {
      heroTitle: 'Cada gatito merece un hogar lleno de mimos',
      heroText:
        'Somos Bigotes, una asociación de Almendralejo que rescata gatitos y les busca una familia para siempre. ¿Será la tuya?',
      rescuedBase: 0,
    },
  },
  about: {
    schema: z.object({
      intro: line(2000).min(1, 'Cuenta algo sobre la asociación'),
    }),
    defaults: {
      intro:
        'Bigotes es una asociación de Almendralejo formada por personas voluntarias que no quieren ver a ningún gatito en la calle. Rescatamos, curamos, cuidamos en casas de acogida y buscamos familias responsables que les den todo el cariño que se merecen.',
    },
  },
  process: {
    schema: z.object({
      steps: z
        .array(z.object({ title: line(80).min(1, 'Pon un título al paso'), text: line(600) }))
        .min(1)
        .max(12),
    }),
    defaults: {
      steps: [
        {
          title: 'Rescate',
          text: 'Recogemos gatitos abandonados, heridos o en peligro en Almendralejo y alrededores. Muchos llegan siendo bebés que caben en una mano.',
        },
        {
          title: 'Veterinario',
          text: 'Lo primero es la salud: revisión, desparasitación, vacunas, microchip y, cuando tienen edad, esterilización.',
        },
        {
          title: 'Casa de acogida',
          text: 'Mientras encuentran familia viven en casas de voluntarios, donde aprenden a convivir, jugar y dejarse querer. Así conocemos bien su carácter.',
        },
        {
          title: 'Buscamos su match',
          text: 'Publicamos su ficha con fotos y su forma de ser para que le conozcas. Nos importa que el gatito y la familia encajen de verdad.',
        },
        {
          title: 'Adopción responsable',
          text: 'Leemos tu solicitud, hablamos contigo, hacemos una visita y firmamos un contrato de adopción. Sin prisas y con mucho cariño.',
        },
        {
          title: 'Seguimiento',
          text: 'Después de la adopción seguimos en contacto: nos encanta recibir fotos y estamos para ayudarte con cualquier duda.',
        },
      ],
    },
  },
  adoption: {
    schema: z.object({
      requirements: z.array(line(300).min(1)).max(20),
      fee: line(1000),
      delivery: line(1000),
    }),
    defaults: {
      requirements: [
        'Ser mayor de edad.',
        'Vivir en Extremadura: de momento solo damos en adopción en las provincias de Badajoz y Cáceres.',
        'Que todas las personas de casa estén de acuerdo con la adopción.',
        'Tener ventanas y balcones protegidos con redes o mallas, o comprometerte a ponerlas antes de que llegue el gatito.',
        'Si vives de alquiler, contar con permiso para tener animales.',
        'Comprometerte a darle atención veterinaria y a esterilizarlo si todavía no lo está.',
        'Firmar el contrato de adopción y aceptar el seguimiento posterior.',
      ],
      fee: DEFAULT_FEE,
      delivery:
        'Los gatitos se entregan con microchip, vacunas y desparasitación al día, y esterilizados o con compromiso de esterilización si todavía son muy pequeños.',
    },
  },
  faq: {
    schema: z.object({
      items: z
        .array(z.object({ q: line(200).min(1, 'Escribe la pregunta'), a: line(1500).min(1, 'Escribe la respuesta') }))
        .max(30),
    }),
    defaults: {
      items: [
        { q: '¿Cuánto cuesta adoptar?', a: DEFAULT_FEE },
        {
          q: '¿Puedo adoptar si no vivo en Extremadura?',
          a: 'De momento no. Solo damos en adopción en las provincias de Badajoz y Cáceres para poder conocernos en persona, hacer la visita y el seguimiento.',
        },
        {
          q: '¿Cuánto tarda el proceso?',
          a: 'Suele llevar entre una y dos semanas desde que recibimos tu solicitud. Depende de la entrevista, la visita y de que el gatito esté listo para irse a casa.',
        },
        {
          q: 'Le he dado «Me encanta» a varios gatitos, ¿qué hago?',
          a: '¡Nos parece genial! Se guardan en tus favoritos. En la solicitud puedes elegir uno o decirnos que te ayudemos a decidir.',
        },
        {
          q: '¿Puedo adoptar dos gatitos?',
          a: '¡Claro! A los gatitos jóvenes les viene muy bien crecer con un compañero de juegos. Cuéntanoslo en la solicitud.',
        },
        {
          q: '¿Y si la adopción no sale bien?',
          a: 'Si surge cualquier problema, háblalo con nosotros y buscaremos una solución juntos. Si no la hubiera, el gatito vuelve con la asociación: nunca debe cederse a otras personas.',
        },
        {
          q: '¿Puedo ayudar sin adoptar?',
          a: 'Sí, y mucho. Puedes hacerte voluntario o voluntaria, compartir las fichas de los gatitos en tus redes o, muy pronto, colaborar con una donación.',
        },
      ],
    },
  },
  contact: {
    schema: z.object({
      email: z.union([z.literal(''), z.email('Escribe un email válido')]),
      phone: line(30),
      whatsapp: line(30),
      instagram: instagramHandle,
      facebook: webUrl('https://facebook.com/bigotes'),
      address: line(200),
      hours: line(200),
    }),
    defaults: {
      email: '',
      phone: '',
      whatsapp: '',
      instagram: '',
      facebook: '',
      address: 'Almendralejo (Badajoz)',
      hours: '',
    },
  },
  donations: {
    schema: z.object({
      intro: line(1000),
      bizum: line(40),
      iban: line(40),
      teaming: webUrl('https://www.teaming.net/bigotes'),
      paypal: webUrl('https://paypal.me/bigotes'),
    }),
    defaults: {
      intro:
        'Cada donación se convierte en pienso, arena, vacunas y visitas al veterinario. Muy pronto podrás ayudarnos desde aquí.',
      bizum: '',
      iban: '',
      teaming: '',
      paypal: '',
    },
  },
  volunteering: {
    schema: z.object({ intro: line(1000) }),
    defaults: {
      intro:
        'No hace falta saber mucho de gatos, solo tener ganas. Puedes echarnos una mano con los cuidados, llevando gatitos al veterinario, en las jornadas de adopción, haciendo fotos o moviendo nuestras redes.',
    },
  },
  legal: {
    adminOnly: true,
    schema: z.object({
      holder: line(200).min(1, 'Indica el nombre legal de la asociación'),
      cif: line(20),
      registry: line(200),
      address: line(300),
      email: z.union([z.literal(''), z.email('Escribe un email válido')]),
    }),
    defaults: {
      holder: 'Asociación Bigotes',
      cif: '',
      registry: '',
      address: 'Almendralejo (Badajoz)',
      email: '',
    },
  },
};

export const CONTENT_KEYS = Object.keys(CONTENT);

export function getContent(key) {
  const entry = CONTENT[key];
  if (!entry) return null;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return structuredClone(entry.defaults);
  try {
    // Se mezcla con los valores por defecto para que un campo nuevo añadido
    // en una versión posterior tenga valor aunque ya hubiera algo guardado.
    return { ...structuredClone(entry.defaults), ...JSON.parse(row.value) };
  } catch {
    return structuredClone(entry.defaults);
  }
}

export function getAllContent() {
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, getContent(key)]));
}

export function saveContent(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value));
  return getContent(key);
}
