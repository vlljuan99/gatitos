import { z } from 'zod';
import { email, phone, requiredText, text } from './validation.js';

// Esquemas de los formularios públicos. Los valores de las opciones deben
// coincidir con client/src/lib/forms.js, que tiene las etiquetas visibles.

export const PROVINCES = ['Badajoz', 'Cáceres'];

const privacy = z.literal(true, 'Necesitamos tu permiso para tratar estos datos');
const adult = z.literal(true, 'Tienes que ser mayor de edad');
const commitment = z.literal(true, 'Marca este compromiso para continuar');

export const applicationSchema = z
  .object({
    catSlug: text(60).default(''),
    name: requiredText(100, 'Escribe tu nombre'),
    email: email(),
    phone: phone(),
    adult,
    municipality: requiredText(100, 'Escribe tu municipio'),
    province: z.enum(PROVINCES, 'De momento solo damos en adopción en Extremadura (Badajoz y Cáceres)'),
    housingType: z.enum(['piso', 'casa', 'casa_patio', 'otro'], 'Elige un tipo de vivienda'),
    tenure: z.enum(['propiedad', 'alquiler', 'familiar'], 'Elige una opción'),
    petsAllowed: z.enum(['si', 'no', 'no_se', 'no_aplica']).default('no_aplica'),
    windowsSafe: z.enum(['si', 'no', 'me_comprometo'], 'Elige una opción'),
    adults: z.coerce.number('Indica cuántos adultos sois').int().min(1, 'Al menos una persona adulta').max(20),
    kids: z.enum(['no', 'si'], 'Elige una opción'),
    kidsAges: text(200).default(''),
    allAgree: z.enum(['si', 'no'], 'Elige una opción'),
    allergies: z.enum(['no', 'si', 'no_se'], 'Elige una opción'),
    otherPets: text(500).default(''),
    experience: text(1500).default(''),
    hoursAlone: z.enum(['menos_4', '4_8', 'mas_8'], 'Elige una opción'),
    holidays: text(500).default(''),
    why: requiredText(2000, 'Cuéntanos un poquito por qué quieres adoptar'),
    commitVet: commitment,
    commitSterilize: commitment,
    commitFollowUp: commitment,
    privacy,
  })
  .superRefine((data, ctx) => {
    if (data.tenure === 'alquiler' && data.petsAllowed === 'no_aplica') {
      ctx.addIssue({ code: 'custom', path: ['petsAllowed'], message: 'Cuéntanos si tu casero permite animales' });
    }
  });

export const messageSchema = z.object({
  name: requiredText(100, 'Escribe tu nombre'),
  email: email(),
  phone: z.union([z.literal(''), phone()]).default(''),
  subject: text(150).default(''),
  body: requiredText(4000, 'Escribe tu mensaje'),
  privacy,
});

export const VOLUNTEER_AREAS = ['cuidados', 'transporte', 'eventos', 'fotos', 'redes', 'difusion', 'otros'];

export const volunteerSchema = z.object({
  name: requiredText(100, 'Escribe tu nombre'),
  email: email(),
  phone: phone(),
  municipality: requiredText(100, 'Escribe tu municipio'),
  areas: z.array(z.enum(VOLUNTEER_AREAS)).min(1, 'Elige al menos una forma de ayudar'),
  availability: text(500).default(''),
  message: text(2000).default(''),
  adult,
  privacy,
});
