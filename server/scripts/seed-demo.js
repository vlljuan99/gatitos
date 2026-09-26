// Gatitos de demostración con retratos ilustrados, para ver la web con vida
// en local o enseñársela a la asociación. Solo actúa si no hay gatitos.
//
//   npm run seed:demo
//
// Fuera de producción crea además dos cuentas de prueba:
//   admin@bigotes.local / bigotes-demo           (Administración)
//   cuidabigotes@bigotes.local / bigotes-demo    (Cuidabigotes)
import sharp from 'sharp';
import { IS_PROD } from '../src/config.js';
import { db, runMigrations } from '../src/db.js';
import { createUser } from '../src/auth.js';
import { uniqueSlug } from '../src/cats.js';
import { savePhoto } from '../src/images.js';
import { catPortraitSvg } from './cat-art.js';

const monthsAgo = (n) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
};
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const ROSA = { background: '#ffd9e2', accent: '#f6a6b8' };
const LAVANDA = { background: '#e4dcfa', accent: '#b9a6ee' };
const MENTA = { background: '#cdefe3', accent: '#8fd3b8' };
const MELOCOTON = { background: '#ffe1c7', accent: '#f7b78a' };
const CIELO = { background: '#d6ecfa', accent: '#9ccbea' };
const MANTEQUILLA = { background: '#fff1b8', accent: '#f0d36a' };

const CATS = [
  {
    name: 'Luna',
    sex: 'hembra',
    birth_date: monthsAgo(4),
    coat: 'Atigrada gris',
    summary: 'Una bolita de mimos que ronronea en cuanto la coges en brazos.',
    story:
      'Luna apareció con sus hermanos en una caja junto a un contenedor. Era la más pequeña y la más valiente: fue la primera en salir a pedir comida. Ahora vive en una casa de acogida donde juega con todo lo que se mueve y termina cada día dormida encima de alguien.',
    personality: ['mimoso', 'juguetón', 'curioso'],
    good: ['si', 'si', 'desconocido'],
    health: [1, 1, 1, 0, 'negativo'],
    location: 'Casa de acogida en Almendralejo',
    status: 'disponible',
    featured: 1,
    arrived: daysAgo(70),
    art: [
      { fur: 'gris', eyes: 'verde', ...ROSA },
      { fur: 'gris', eyes: 'verde', ...LAVANDA, tilt: -7 },
    ],
  },
  {
    name: 'Canelo',
    sex: 'macho',
    birth_date: monthsAgo(19),
    coat: 'Naranja atigrado',
    summary: 'Glotón profesional y experto en siestas al sol.',
    story:
      'Canelo vivía en una colonia del polígono y un vecino nos avisó porque cojeaba. Resultó ser una espina clavada: se curó enseguida, pero se quedó con nosotros el gusto por la vida tranquila. Se lleva genial con otros gatos y con perros educados.',
    personality: ['glotón', 'dormilón', 'sociable'],
    good: ['si', 'si', 'si'],
    health: [1, 1, 1, 1, 'negativo'],
    location: 'Casa de acogida en Almendralejo',
    status: 'disponible',
    featured: 1,
    arrived: daysAgo(120),
    art: [{ fur: 'naranja', eyes: 'ambar', ...MELOCOTON }],
  },
  {
    name: 'Pimienta',
    sex: 'hembra',
    birth_date: monthsAgo(86),
    coat: 'Carey',
    summary: 'Señora tranquila que busca un sofá y una persona con paciencia.',
    story:
      'Pimienta se quedó sola cuando su dueña falleció. Al principio le cuesta confiar, pero cuando te elige es para siempre. Prefiere una casa sin niños pequeños y sin demasiado jaleo.',
    personality: ['tranquilo', 'independiente', 'mimoso'],
    good: ['no', 'desconocido', 'no'],
    health: [1, 1, 1, 1, 'negativo'],
    location: 'Casa de acogida en Villafranca de los Barros',
    status: 'disponible',
    featured: 0,
    arrived: daysAgo(200),
    art: [{ fur: 'carey', eyes: 'ambar', ...LAVANDA, tilt: 5 }],
  },
  {
    name: 'Tofu',
    sex: 'macho',
    birth_date: monthsAgo(3),
    coat: 'Blanco con manchas grises',
    summary: 'Curioso, travieso y con unas patitas enormes.',
    story:
      'Tofu llegó con los ojitos pegados y un hambre de león. Hoy es un torbellino que investiga cada rincón de la casa. Le vendría genial un hogar con otro gatito joven para gastar energía juntos.',
    personality: ['curioso', 'aventurero', 'juguetón'],
    good: ['si', 'si', 'desconocido'],
    health: [1, 1, 0, 0, 'pendiente'],
    location: 'Casa de acogida en Almendralejo',
    status: 'disponible',
    featured: 1,
    arrived: daysAgo(40),
    art: [
      { fur: 'blanco', eyes: 'azul', ...MENTA },
      { fur: 'blanco', eyes: 'azul', ...CIELO, tilt: 6 },
    ],
  },
  {
    name: 'Morena',
    sex: 'hembra',
    birth_date: monthsAgo(32),
    coat: 'Negra',
    summary: 'Tímida al principio, pegajosa para siempre.',
    story:
      'A Morena la encontramos en un patio abandonado. Es un poco tímida con los desconocidos, pero en cuanto coge confianza te sigue por toda la casa y duerme a tus pies.',
    personality: ['tímido', 'cariñoso con niños', 'tranquilo'],
    good: ['si', 'desconocido', 'desconocido'],
    health: [1, 1, 1, 1, 'negativo'],
    location: 'Casa de acogida en Almendralejo',
    status: 'disponible',
    featured: 0,
    arrived: daysAgo(160),
    art: [{ fur: 'negro', eyes: 'ambar', ...MANTEQUILLA }],
  },
  {
    name: 'Bigotín',
    sex: 'macho',
    birth_date: monthsAgo(125),
    coat: 'Gris',
    summary: 'Abuelito dulce con los bigotes más espectaculares de Almendralejo.',
    story:
      'Bigotín ha vivido muchas cosas y solo quiere una manta, comida rica y caricias. Tiene FIV, lo que no le impide llevar una vida larga y feliz.',
    personality: ['tranquilo', 'mimoso', 'dormilón'],
    good: ['si', 'no', 'desconocido'],
    health: [1, 1, 1, 1, 'positivo_fiv'],
    specialNeeds:
      'Tiene FIV: mejor como único gato de la casa o con otros gatos que también tengan FIV. Necesita revisiones veterinarias periódicas.',
    location: 'Casa de acogida en Almendralejo',
    status: 'disponible',
    featured: 0,
    arrived: daysAgo(300),
    art: [{ fur: 'gris', eyes: 'verde', ...CIELO, tilt: -4 }],
  },
  {
    name: 'Nube',
    sex: 'hembra',
    birth_date: monthsAgo(8),
    coat: 'Blanca',
    summary: 'Suave como una nube y con la mirada más dulce.',
    story: 'Nube ya tiene una familia interesada y estamos terminando el proceso. ¡Crucemos las patitas!',
    personality: ['mimoso', 'sociable'],
    good: ['si', 'si', 'si'],
    health: [1, 1, 1, 1, 'negativo'],
    location: 'Casa de acogida en Almendralejo',
    status: 'reservado',
    featured: 0,
    arrived: daysAgo(90),
    art: [{ fur: 'blanco', eyes: 'azul', ...ROSA }],
  },
  {
    name: 'Chispa',
    sex: 'hembra',
    birth_date: monthsAgo(14),
    coat: 'Crema',
    summary: 'La más revoltosa de su camada.',
    story: 'Chispa llegó con tres semanas y un maullido que se oía en toda la calle.',
    personality: ['juguetón', 'charlatán'],
    good: ['si', 'si', 'desconocido'],
    health: [1, 1, 1, 1, 'negativo'],
    status: 'adoptado',
    adopted: daysAgo(45),
    happyEnding:
      'Chispa vive ahora en Mérida con Laura y Pablo. Nos mandan fotos casi cada semana: ya ha conquistado el sofá, la cama y el corazón de toda la familia.',
    arrived: daysAgo(240),
    art: [{ fur: 'crema', eyes: 'verde', ...MANTEQUILLA }],
  },
  {
    name: 'Garbanzo',
    sex: 'macho',
    birth_date: monthsAgo(28),
    coat: 'Naranja',
    summary: 'Un bonachón con cara de pan.',
    story: 'Garbanzo estuvo meses esperando familia en su casa de acogida.',
    personality: ['tranquilo', 'glotón'],
    good: ['si', 'si', 'si'],
    health: [1, 1, 1, 1, 'negativo'],
    status: 'adoptado',
    adopted: daysAgo(110),
    happyEnding:
      'Garbanzo se fue a vivir con Carmen, que buscaba un compañero tranquilo. Dice que es el mejor despertador del mundo: cada mañana a las ocho, ronroneo en la oreja.',
    arrived: daysAgo(380),
    art: [{ fur: 'naranja', eyes: 'verde', ...MENTA, tilt: 4 }],
  },
];

runMigrations();

if (db.prepare('SELECT COUNT(*) AS n FROM cats').get().n > 0) {
  console.log('Ya hay gatitos en la base de datos: no se añaden los de demostración.');
  process.exit(0);
}

if (!IS_PROD && db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
  createUser({ email: 'admin@bigotes.local', name: 'Juan', role: 'admin', password: 'bigotes-demo' });
  createUser({ email: 'cuidabigotes@bigotes.local', name: 'Marta', role: 'cuidabigotes', password: 'bigotes-demo' });
  console.log('Cuentas de prueba: admin@bigotes.local y cuidabigotes@bigotes.local (contraseña: bigotes-demo)');
}

const insertCat = db.prepare(`
  INSERT INTO cats (slug, name, sex, birth_date, coat, summary, story, personality,
    good_with_kids, good_with_cats, good_with_dogs, vaccinated, dewormed, microchipped, sterilized, fiv_felv,
    special_needs, location, status, featured, likes, arrived_at, adopted_at, happy_ending)
  VALUES (@slug, @name, @sex, @birth_date, @coat, @summary, @story, @personality,
    @kids, @cats, @dogs, @vaccinated, @dewormed, @microchipped, @sterilized, @fiv,
    @specialNeeds, @location, @status, @featured, @likes, @arrived, @adopted, @happyEnding)`);
const insertPhoto = db.prepare(
  'INSERT INTO cat_photos (cat_id, file_key, width, height, position) VALUES (?, ?, ?, ?, ?)',
);

for (const cat of CATS) {
  const [kids, cats, dogs] = cat.good;
  const [vaccinated, dewormed, microchipped, sterilized, fiv] = cat.health;
  const info = insertCat.run({
    slug: uniqueSlug(cat.name),
    name: cat.name,
    sex: cat.sex,
    birth_date: cat.birth_date,
    coat: cat.coat,
    summary: cat.summary,
    story: cat.story,
    personality: JSON.stringify(cat.personality),
    kids,
    cats,
    dogs,
    vaccinated,
    dewormed,
    microchipped,
    sterilized,
    fiv,
    specialNeeds: cat.specialNeeds ?? '',
    location: cat.location ?? '',
    status: cat.status,
    featured: cat.featured ?? 0,
    likes: Math.floor(Math.random() * 40),
    arrived: cat.arrived,
    adopted: cat.adopted ?? null,
    happyEnding: cat.happyEnding ?? '',
  });
  for (const [position, art] of cat.art.entries()) {
    const buffer = await sharp(Buffer.from(catPortraitSvg(art))).jpeg({ quality: 90 }).toBuffer();
    const photo = await savePhoto(buffer);
    insertPhoto.run(info.lastInsertRowid, photo.key, photo.width, photo.height, position);
  }
  console.log(`🐱 ${cat.name}`);
}
console.log('Gatitos de demostración creados.');
