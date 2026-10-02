import { db } from './db.js';
import { PUBLIC_URL } from './config.js';
import { getContent } from './content.js';
import { photoUrls, PUBLIC_STATUSES_SQL } from './cats.js';

// La web es una SPA, pero WhatsApp, Instagram o Facebook no ejecutan
// JavaScript al generar la vista previa de un enlace. Por eso el servidor
// rellena el <head> de index.html con título, descripción y foto de cada
// página (y de cada gatito) antes de enviarlo.

const SITE = 'Bigotes';
const DEFAULT_IMAGE = { url: '/og-bigotes.jpg', width: 1200, height: 630 };

const STATIC_PAGES = {
  '/': { title: 'Bigotes · Adopción de gatitos en Almendralejo' },
  '/gatitos': { title: 'Gatitos en adopción', description: 'Conoce a los gatitos de Bigotes que buscan una familia para siempre en Extremadura.' },
  '/match': { title: 'Encuentra tu match gatuno', description: 'Desliza, dale «Me encanta» y descubre qué gatito de Bigotes está hecho para ti.' },
  '/favoritos': { title: 'Tus favoritos' },
  '/como-trabajamos': { title: 'Cómo trabajamos', description: 'Rescate, veterinario, casa de acogida y adopción responsable: así cuidamos a cada gatito.' },
  '/adoptar': { title: 'Solicitud de adopción', description: 'Rellena la solicitud para adoptar un gatito de Bigotes. Te leemos con mucho cariño.' },
  '/finales-felices': { title: 'Finales felices', description: 'Gatitos rescatados por Bigotes que ya ronronean en su hogar para siempre.' },
  '/colabora': { title: 'Colabora', description: 'Hazte voluntario o voluntaria de Bigotes y ayúdanos a rescatar gatitos en Almendralejo.' },
  '/contacto': { title: 'Contacto', description: 'Escríbenos: estaremos encantados de resolver tus dudas sobre adopción o voluntariado.' },
  '/aviso-legal': { title: 'Aviso legal' },
  '/privacidad': { title: 'Política de privacidad' },
  '/cookies': { title: 'Política de cookies' },
};

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function ageText(birthDate, now = new Date()) {
  if (!birthDate) return '';
  const [year, month] = birthDate.split('-').map(Number);
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  if (months < 1) return 'menos de un mes';
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

function catMeta(slug) {
  const cat = db.prepare(`SELECT * FROM cats WHERE slug = ? AND status IN (${PUBLIC_STATUSES_SQL})`).get(slug);
  if (!cat) return null;
  const photo = db.prepare('SELECT file_key FROM cat_photos WHERE cat_id = ? ORDER BY position, id LIMIT 1').get(cat.id);
  const sex = cat.sex === 'macho' ? 'macho' : cat.sex === 'hembra' ? 'hembra' : '';
  const facts = [sex, ageText(cat.birth_date)].filter(Boolean).join(' · ');
  const adopted = cat.status === 'adoptado';
  return {
    title: adopted ? `${cat.name} ya tiene hogar 💕` : `${cat.name} busca hogar 🐾`,
    description:
      cat.summary ||
      (adopted
        ? `${cat.name} fue rescatado por Bigotes y ya vive feliz con su familia.`
        : `Conoce a ${cat.name}${facts ? ` (${facts})` : ''}, en adopción con Bigotes en Almendralejo.`),
    image: photo ? { url: photoUrls(photo.file_key).og, width: 1200, height: 630 } : DEFAULT_IMAGE,
    type: 'article',
  };
}

/** Devuelve { status, meta } para una ruta de la SPA. */
export function metaFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin' || path.startsWith('/admin/')) {
    return { status: 200, meta: { title: 'Panel', noindex: true } };
  }
  const catMatch = path.match(/^\/gatitos\/([a-z0-9-]+)$/);
  if (catMatch) {
    const meta = catMeta(catMatch[1]);
    return meta ? { status: 200, meta } : { status: 404, meta: { title: 'Gatito no encontrado', noindex: true } };
  }
  const page = STATIC_PAGES[path];
  if (page) return { status: 200, meta: page };
  return { status: 404, meta: { title: 'Página no encontrada', noindex: true } };
}

export function renderHead(pathname, meta) {
  const home = getContent('home');
  const title = meta.title.startsWith(SITE) ? meta.title : `${meta.title} · ${SITE}`;
  const description = meta.description ?? home.heroText;
  const url = `${PUBLIC_URL}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;
  const image = meta.image ?? DEFAULT_IMAGE;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    '<meta property="og:locale" content="es_ES" />',
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(PUBLIC_URL + image.url)}" />`,
    `<meta property="og:image:width" content="${image.width}" />`,
    `<meta property="og:image:height" content="${image.height}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ];
  return tags.join('\n    ');
}

/** Sustituye el bloque <!--meta-->…<!--/meta--> de index.html. */
export function injectHead(template, pathname, meta) {
  return template.replace(/<!--meta-->[\s\S]*?<!--\/meta-->/, renderHead(pathname, meta));
}

export function sitemapXml() {
  const cats = db.prepare(`SELECT slug, updated_at FROM cats WHERE status IN (${PUBLIC_STATUSES_SQL})`).all();
  const pages = Object.keys(STATIC_PAGES).filter((p) => !['/favoritos', '/aviso-legal', '/privacidad', '/cookies'].includes(p));
  const urls = [
    ...pages.map((p) => `<url><loc>${PUBLIC_URL}${p}</loc></url>`),
    ...cats.map(
      (c) => `<url><loc>${PUBLIC_URL}/gatitos/${c.slug}</loc><lastmod>${c.updated_at.slice(0, 10)}</lastmod></url>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${PUBLIC_URL}/sitemap.xml\n`;
}
