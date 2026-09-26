import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Heart, PawPrint, Send } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { Checkbox, Choice, FormError, Honeypot, TextArea, TextInput } from '../components/form.jsx';
import { Button, ButtonLink, Card, cx, Spinner } from '../components/ui.jsx';
import {
  applicationPayload,
  INITIAL_APPLICATION,
  OUTSIDE_EXTREMADURA,
  stepOfField,
  STEPS,
  validateStep,
} from '../lib/adoption.js';
import { useFavorites } from '../lib/favorites.js';
import { ALLERGIES, HOURS_ALONE, HOUSING, KIDS, PETS_ALLOWED, PROVINCES, TENURE, WINDOWS, YES_NO } from '../lib/forms.js';
import { useForm } from '../lib/useForm.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

const DRAFT_KEY = 'bigotes:solicitud';

function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function Progress({ step }) {
  const pct = ((step + 1) / STEPS.length) * 100;
  return (
    <div className="px-4">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-fresa-oscuro">
          Paso {step + 1} de {STEPS.length}
        </span>
        <span className="text-cacao-suave">
          {STEPS[step].emoji} {STEPS[step].title}
        </span>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-fresa-claro" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Progreso de la solicitud">
        <motion.div className="h-3 rounded-full bg-fresa" initial={false} animate={{ width: `${pct}%` }} />
        <motion.span
          className="absolute -top-1.5 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-nata text-fresa shadow-suave"
          initial={false}
          animate={{ left: `${pct}%` }}
          aria-hidden
        >
          <PawPrint className="size-3.5" />
        </motion.span>
      </div>
    </div>
  );
}

function CatPicker({ cats, value, onChange, favoriteSlugs, error }) {
  // Primero el gatito con el que se llegó y luego los favoritos. El orden no
  // cambia al tocar otro, para que la lista no salte bajo el dedo.
  const [preselected] = useState(value);
  const rank = (cat) => (cat.slug === preselected ? 2 : favoriteSlugs.includes(cat.slug) ? 1 : 0);
  const sorted = [...cats].sort((a, b) => rank(b) - rank(a));
  const option = (selected) =>
    cx(
      'relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border-4 bg-nata text-left shadow-suave transition',
      'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fresa',
      selected ? 'border-fresa' : 'border-transparent',
    );
  return (
    <fieldset>
      <legend className="mb-1 font-display text-2xl font-semibold">¿A quién quieres conocer?</legend>
      <p className="mb-4 text-cacao-suave">Si todavía no lo tienes claro, te ayudamos a encontrar a tu gatito ideal.</p>
      {error && <FormError>{error}</FormError>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className={option(value === '')}>
          <input type="radio" name="gatito" className="sr-only" checked={value === ''} onChange={() => onChange('')} />
          <span className="grid aspect-square place-items-center bg-lavanda text-5xl" aria-hidden>
            🤔
          </span>
          <span className="p-3 font-bold leading-tight">Aún no lo sé, aconsejadme</span>
        </label>
        {sorted.map((cat) => {
          const selected = value === cat.slug;
          return (
            <label key={cat.slug} className={option(selected)}>
              <input type="radio" name="gatito" className="sr-only" checked={selected} onChange={() => onChange(cat.slug)} />
              <CatPhoto cat={cat} sizes="(min-width: 768px) 30vw, 45vw" className="aspect-square w-full" alt="" />
              <span className="flex items-center gap-1.5 p-3 font-display text-lg font-semibold">
                {cat.name}
                {favoriteSlugs.includes(cat.slug) && <Heart className="size-4 text-fresa" fill="currentColor" aria-label="(favorito)" />}
              </span>
              {selected && (
                <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-fresa text-white">
                  <Check className="size-5" strokeWidth={3} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Success({ cat }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <motion.div
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12 }}
        className="mx-auto grid size-32 place-items-center rounded-full bg-fresa-claro text-6xl"
        aria-hidden
      >
        💌
      </motion.div>
      <h1 className="mt-6 font-display text-4xl font-semibold">¡Solicitud enviada!</h1>
      <p className="mt-3 text-lg text-cacao-suave">
        Gracias por querer darle un hogar {cat ? `a ${cat.name}` : 'a uno de nuestros gatitos'}. La leeremos con mucho cariño y
        te escribiremos en unos días para contarte los siguientes pasos.
      </p>
      <div className="mt-8 grid gap-3">
        <ButtonLink to="/gatitos" size="lg">
          Seguir viendo gatitos
        </ButtonLink>
        <ButtonLink to="/como-trabajamos" variant="secondary">
          Cómo es el proceso
        </ButtonLink>
      </div>
    </div>
  );
}

export default function Adopt() {
  useTitle('Solicitud de adopción');
  const [params] = useSearchParams();
  const { data, loading } = useApi('/gatitos');
  const { slugs: favoriteSlugs } = useFavorites();
  const form = useForm(() => {
    const draft = readDraft();
    const initial = { ...INITIAL_APPLICATION, ...(draft ?? {}), website: '' };
    if (params.get('gatito')) initial.catSlug = params.get('gatito');
    return initial;
  });
  const { values, set, field, setErrors, errors, formError, setFormError, sending, submit } = form;

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const cats = useMemo(() => (data?.cats ?? []).filter((c) => c.status === 'disponible' || c.slug === values.catSlug), [data, values.catSlug]);
  const chosen = cats.find((c) => c.slug === values.catSlug) ?? null;

  useEffect(() => {
    if (done) return;
    try {
      const { website, privacy, ...draft } = values;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Sin almacenamiento: simplemente no se guarda el borrador.
    }
  }, [values, done]);

  function go(next) {
    setStep(next);
    setErrors({});
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function next() {
    const stepErrors = validateStep(STEPS[step].key, values);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      setFormError('Revisa los campos marcados');
      return;
    }
    go(step + 1);
  }

  async function send(event) {
    event.preventDefault();
    if (step < STEPS.length - 1) return next();
    const stepErrors = validateStep('enviar', values);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    const ok = await submit('/solicitudes', applicationPayload(values));
    if (ok) {
      setDone(true);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // nada
      }
      window.scrollTo({ top: 0 });
    }
  }

  // Con los errores del servidor ya en el estado, saltar al primer paso afectado.
  useEffect(() => {
    const fields = Object.keys(errors).filter((k) => errors[k]);
    if (fields.length === 0) return;
    const target = Math.min(...fields.map(stepOfField));
    if (target < step) setStep(target);
  }, [errors, step]);

  if (done) return <Success cat={chosen} />;
  if (loading) return <Spinner />;

  const key = STEPS[step].key;
  const outside = values.province === 'otra';

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="px-4 pt-6 pb-4">
        <h1 className="font-display text-3xl font-semibold">Solicitud de adopción 💌</h1>
        <p className="mt-1 text-cacao-suave">Unos minutitos para conocerte. No hay respuestas buenas ni malas: queremos que todo encaje.</p>
      </header>
      <Progress step={step} />

      {chosen && step > 0 && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-3xl bg-nata p-2 pr-4 shadow-suave">
          <CatPhoto cat={chosen} sizes="56px" className="size-14 rounded-2xl" alt="" />
          <p className="text-sm">
            Solicitud para <strong className="font-display text-base">{chosen.name}</strong>
          </p>
          <button type="button" className="ml-auto text-sm font-bold text-fresa-oscuro underline" onClick={() => go(0)}>
            Cambiar
          </button>
        </div>
      )}

      <form onSubmit={send} noValidate className="mt-6 grid gap-6 px-4">
        <Honeypot value={values.website} onChange={(v) => set('website', v)} />

        {key === 'gatito' && (
          <CatPicker
            cats={cats}
            value={values.catSlug}
            onChange={(v) => set('catSlug', v)}
            favoriteSlugs={favoriteSlugs}
            error={errors.catSlug}
          />
        )}

        {key === 'tu' && (
          <>
            <TextInput label="Nombre y apellidos" autoComplete="name" {...field('name')} />
            <TextInput label="Email" type="email" inputMode="email" autoComplete="email" {...field('email')} />
            <TextInput
              label="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint="Te llamaremos o escribiremos por WhatsApp para conocernos."
              {...field('phone')}
            />
            <TextInput label="Municipio" autoComplete="address-level2" placeholder="Almendralejo" {...field('municipality')} />
            <Choice label="Provincia" options={PROVINCES} {...field('province')} error={outside ? undefined : errors.province} />
            {outside && (
              <Card className="bg-melocoton">
                <p className="font-bold text-melocoton-oscuro">Lo sentimos mucho 😿</p>
                <p className="mt-1">
                  {OUTSIDE_EXTREMADURA}, para poder conocernos en persona y hacer el seguimiento. ¡Pero puedes ayudarnos
                  compartiendo sus fichas!
                </p>
              </Card>
            )}
            <Checkbox checked={values.adult} onChange={(v) => set('adult', v)} error={errors.adult}>
              Soy mayor de edad
            </Checkbox>
          </>
        )}

        {key === 'hogar' && (
          <>
            <Choice label="¿Dónde vives?" options={HOUSING} columns {...field('housingType')} />
            <Choice
              label="Tu casa es…"
              options={TENURE}
              {...field('tenure')}
              onChange={(v) => {
                set('tenure', v);
                set('petsAllowed', v === 'alquiler' ? '' : 'no_aplica');
              }}
            />
            {values.tenure === 'alquiler' && (
              <Choice label="¿Tu casero permite animales?" options={PETS_ALLOWED} {...field('petsAllowed')} />
            )}
            <Choice
              label="¿Tienes redes o mallas en ventanas y balcones?"
              hint="Los gatos son muy curiosos y las caídas desde ventanas son uno de los accidentes más frecuentes."
              options={WINDOWS}
              {...field('windowsSafe')}
            />
          </>
        )}

        {key === 'familia' && (
          <>
            <TextInput label="¿Cuántas personas adultas vivís en casa?" type="number" inputMode="numeric" min={1} max={20} {...field('adults')} />
            <Choice label="¿Hay niños en casa?" options={KIDS} {...field('kids')} />
            {values.kids === 'si' && <TextInput label="¿Qué edades tienen?" optional {...field('kidsAges')} />}
            <Choice label="¿Todas las personas de casa están de acuerdo con la adopción?" options={YES_NO} {...field('allAgree')} />
            <Choice label="¿Alguien tiene alergia a los gatos?" options={ALLERGIES} {...field('allergies')} />
            <TextArea
              label="¿Tienes otros animales?"
              optional
              hint="Especie, edad y si están esterilizados y vacunados."
              rows={3}
              {...field('otherPets')}
            />
          </>
        )}

        {key === 'dia' && (
          <>
            <Choice label="¿Cuántas horas al día pasaría solo en casa?" options={HOURS_ALONE} {...field('hoursAlone')} />
            <TextArea label="¿Has tenido gatos antes?" optional hint="Cuéntanos tu experiencia, si la tienes." rows={3} {...field('experience')} />
            <TextArea label="¿Quién le cuidaría en vacaciones?" optional rows={2} {...field('holidays')} />
            <TextArea label="¿Por qué quieres adoptar?" rows={4} {...field('why')} />
          </>
        )}

        {key === 'enviar' && (
          <>
            <div>
              <h2 className="font-display text-2xl font-semibold">Casi estamos 💕</h2>
              <p className="mt-1 text-cacao-suave">Adoptar es un compromiso para toda su vida. Por eso te pedimos:</p>
            </div>
            <Checkbox checked={values.commitVet} onChange={(v) => set('commitVet', v)} error={errors.commitVet}>
              Me comprometo a darle la atención veterinaria que necesite durante toda su vida.
            </Checkbox>
            <Checkbox checked={values.commitSterilize} onChange={(v) => set('commitSterilize', v)} error={errors.commitSterilize}>
              Me comprometo a esterilizarlo si todavía no lo está, cuando tenga edad.
            </Checkbox>
            <Checkbox checked={values.commitFollowUp} onChange={(v) => set('commitFollowUp', v)} error={errors.commitFollowUp}>
              Acepto firmar el contrato de adopción y el seguimiento posterior de la asociación.
            </Checkbox>
            <Checkbox checked={values.privacy} onChange={(v) => set('privacy', v)} error={errors.privacy}>
              He leído la{' '}
              <Link to="/privacidad" target="_blank" className="font-bold text-fresa-oscuro underline">
                política de privacidad
              </Link>{' '}
              y acepto que Bigotes use estos datos para gestionar mi solicitud.
            </Checkbox>
          </>
        )}

        <FormError>{formError}</FormError>

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" size="lg" onClick={() => go(step - 1)} aria-label="Paso anterior">
              <ArrowLeft className="size-5" />
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="submit" size="lg" block disabled={key === 'tu' && outside}>
              Siguiente <ArrowRight className="size-5" />
            </Button>
          ) : (
            <Button type="submit" size="lg" block loading={sending}>
              <Send className="size-5" /> Enviar solicitud
            </Button>
          )}
        </div>
        {chosen && step === 0 && (
          <p className="text-center text-sm text-cacao-suave">
            ¿Quieres saber más antes?{' '}
            <Link to={`/gatitos/${chosen.slug}`} className="font-bold underline">
              Ver la ficha de {chosen.name}
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
