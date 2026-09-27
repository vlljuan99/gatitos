import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { createUser, hashPassword, publicUser, ROLES, temporaryPassword } from '../auth.js';
import { email, parseBody, parseId, requiredText } from '../validation.js';

// Gestión del equipo (solo bigotes mayores, es decir, administración). No hay
// registro público: se da de alta a cada persona, sea cuidabigotes o bigote
// mayor, con una contraseña temporal que se enseña una sola vez para
// pasársela por WhatsApp o en persona.
export function adminTeamRouter() {
  const router = Router();
  const roles = Object.keys(ROLES);

  const activeAdmins = () =>
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY active DESC, role, name').all();
    res.json({ users: rows.map(publicUser) });
  });

  const createSchema = z.object({
    name: requiredText(60, 'Escribe su nombre'),
    email: email(),
    role: z.enum(roles).default('cuidabigotes'),
  });

  router.post('/', (req, res) => {
    const data = parseBody(createSchema, req, res);
    if (!data) return;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) {
      return res.status(409).json({ error: 'Ya hay alguien con ese email', fields: { email: 'Ya está en el equipo' } });
    }
    const password = temporaryPassword();
    const user = createUser({ ...data, password });
    res.status(201).json({ user: publicUser(user), temporaryPassword: password });
  });

  const updateSchema = z.object({
    name: requiredText(60, 'Escribe su nombre').optional(),
    role: z.enum(roles).optional(),
    active: z.boolean().optional(),
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const data = parseBody(updateSchema, req, res);
    if (!data) return;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'No encontramos a esta persona' });

    const losesAdmin =
      row.role === 'admin' && row.active && ((data.role && data.role !== 'admin') || data.active === false);
    if (id === req.user.id && (data.active === false || (data.role && data.role !== row.role))) {
      return res.status(400).json({ error: 'No puedes desactivarte ni cambiar tu propio papel' });
    }
    if (losesAdmin && activeAdmins() <= 1) {
      return res.status(400).json({ error: 'Tiene que quedar al menos un bigote mayor en el equipo' });
    }

    const next = {
      name: data.name ?? row.name,
      role: data.role ?? row.role,
      active: data.active === undefined ? row.active : Number(data.active),
    };
    // Desactivar o cambiar de papel cierra sus sesiones abiertas.
    const bump = next.active !== row.active || next.role !== row.role ? 1 : 0;
    db.prepare(
      'UPDATE users SET name = ?, role = ?, active = ?, session_version = session_version + ? WHERE id = ?',
    ).run(next.name, next.role, next.active, bump, id);
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  });

  router.post('/:id/restablecer', async (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'No encontramos a esta persona' });
    const password = temporaryPassword();
    db.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(
      await hashPassword(password),
      id,
    );
    res.json({ temporaryPassword: password });
  });

  return router;
}
