import { z } from 'zod';

// Mensajes de zod en español para los casos que no llevan uno propio.
z.config(z.locales.es());

/**
 * Valida req.body con un esquema. Si falla, responde 400 con un mensaje por
 * campo ({ fields: { email: '...' } }) para que el formulario los marque, y
 * devuelve null. Si pasa, devuelve los datos ya limpios.
 */
export function parseBody(schema, req, res) {
  const result = schema.safeParse(req.body ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  res.status(400).json({ error: 'Revisa los campos marcados', fields });
  return null;
}

export const text = (max) => z.string().trim().max(max, `Máximo ${max} caracteres`);
export const requiredText = (max, message) => text(max).min(1, message);
export const email = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Escribe un email válido'));
export const phone = (message = 'Escribe un teléfono válido') =>
  z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{9,20}$/, message);

// Las fechas vacías llegan como '' desde el formulario o como null al reenviar
// algo tal cual se leyó: ambas significan «sin fecha» y quedan en ''.
export const optionalDate = (schema) =>
  z
    .union([z.literal(''), schema])
    .nullish()
    .transform((value) => value ?? '');
export const optionalDay = () => optionalDate(z.iso.date('Fecha no válida'));
export const requiredDay = (message = 'Indica la fecha') => z.iso.date(message);

/**
 * Número que puede llegar escrito a mano («12,5», «3») o como número. Vacío
 * queda en null. Sirve para cantidades del inventario e importes en euros.
 */
export const decimal = ({ min = 0, max = 1_000_000, message = 'Escribe un número' } = {}) =>
  z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value, ctx) => {
      if (value === null || value === undefined || String(value).trim() === '') return null;
      const number = typeof value === 'number' ? value : Number(String(value).trim().replace(/\s|€/g, '').replace(',', '.'));
      if (!Number.isFinite(number) || number < min || number > max) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return number;
    });

export const idParam = z.coerce.number().int().positive();

/** Convierte un id de la URL en número o responde 404. */
export function parseId(value, res) {
  const result = idParam.safeParse(value);
  if (result.success) return result.data;
  res.status(404).json({ error: 'No encontrado' });
  return null;
}
