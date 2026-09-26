import { Router } from 'express';
import { db } from '../db.js';
import { getAllContent } from '../content.js';
import { publicStats, serializeCat, serializeCats, photosFor } from '../cats.js';
import { applicationSchema, messageSchema, volunteerSchema } from '../forms.js';
import { notifyNewApplication, notifyNewMessage, notifyNewVolunteer } from '../notify.js';
import { isBot, rateLimit } from '../security.js';
import { parseBody } from '../validation.js';

// API pública: lo que ve cualquiera que visite la web.
export function publicRouter() {
  const router = Router();
  // Un límite por formulario: en una jornada de adopción mucha gente puede
  // rellenar solicitudes desde la misma wifi (misma IP), así que no es muy bajo.
  const formLimit = () => rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
  const likeLimit = rateLimit({ windowMs: 60 * 1000, max: 60 });

  // Textos de la web y contadores de portada en una sola petición.
  router.get('/sitio', (req, res) => {
    const content = getAllContent();
    res.json({ content, stats: publicStats(content.home.rescuedBase) });
  });

  // Gatitos que buscan hogar (disponibles y reservados). Son pocas decenas:
  // se envían todos y el filtrado se hace en el móvil, sin recargar.
  router.get('/gatitos', (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM cats WHERE status IN ('disponible', 'reservado')
         ORDER BY status = 'reservado', featured DESC, created_at DESC`,
      )
      .all();
    res.json({ cats: serializeCats(rows) });
  });

  router.get('/gatitos/:slug', (req, res) => {
    const row = db.prepare("SELECT * FROM cats WHERE slug = ? AND status != 'borrador'").get(req.params.slug);
    if (!row) return res.status(404).json({ error: 'No encontramos a este gatito' });
    res.json({ cat: serializeCat(row, photosFor([row.id]).get(row.id)) });
  });

  router.post('/gatitos/:slug/me-encanta', likeLimit, (req, res) => {
    const info = db
      .prepare("UPDATE cats SET likes = likes + 1 WHERE slug = ? AND status IN ('disponible', 'reservado')")
      .run(req.params.slug);
    if (info.changes === 0) return res.status(404).json({ error: 'No encontramos a este gatito' });
    res.json({ ok: true });
  });

  router.get('/finales-felices', (req, res) => {
    const rows = db
      .prepare("SELECT * FROM cats WHERE status = 'adoptado' ORDER BY adopted_at DESC, updated_at DESC LIMIT 60")
      .all();
    res.json({ cats: serializeCats(rows) });
  });

  router.post('/solicitudes', formLimit(), (req, res) => {
    if (isBot(req.body)) return res.status(201).json({ ok: true });
    const data = parseBody(applicationSchema, req, res);
    if (!data) return;

    let cat = null;
    if (data.catSlug) {
      cat = db
        .prepare("SELECT id, name FROM cats WHERE slug = ? AND status IN ('disponible', 'reservado')")
        .get(data.catSlug);
      if (!cat) {
        return res.status(400).json({
          error: 'Este gatito ya no está disponible',
          fields: { catSlug: 'Este gatito ya no está disponible. Elige otro o deja que te aconsejemos.' },
        });
      }
    }

    const { catSlug, name, email, phone, municipality, province, privacy, ...answers } = data;
    const info = db
      .prepare(
        `INSERT INTO applications (cat_id, cat_name, name, email, phone, municipality, province, answers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(cat?.id ?? null, cat?.name ?? '', name, email, phone, municipality, province, JSON.stringify(answers));

    notifyNewApplication({ id: info.lastInsertRowid, name, email, municipality, catName: cat?.name ?? '' });
    res.status(201).json({ ok: true });
  });

  router.post('/mensajes', formLimit(), (req, res) => {
    if (isBot(req.body)) return res.status(201).json({ ok: true });
    const data = parseBody(messageSchema, req, res);
    if (!data) return;
    db.prepare('INSERT INTO messages (name, email, phone, subject, body) VALUES (?, ?, ?, ?, ?)').run(
      data.name,
      data.email,
      data.phone,
      data.subject,
      data.body,
    );
    notifyNewMessage(data);
    res.status(201).json({ ok: true });
  });

  router.post('/voluntariado', formLimit(), (req, res) => {
    if (isBot(req.body)) return res.status(201).json({ ok: true });
    const data = parseBody(volunteerSchema, req, res);
    if (!data) return;
    db.prepare(
      `INSERT INTO volunteers (name, email, phone, municipality, areas, availability, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.name,
      data.email,
      data.phone,
      data.municipality,
      JSON.stringify(data.areas),
      data.availability,
      data.message,
    );
    notifyNewVolunteer(data);
    res.status(201).json({ ok: true });
  });

  return router;
}
