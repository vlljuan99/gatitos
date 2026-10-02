import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, HeartHandshake, MapPin, Plus, Trash2 } from 'lucide-react';
import { Checkbox, Choice, Field, FormError, Honeypot, TextArea, TextInput } from '../components/form.jsx';
import { Button, Card, PageHeader, cx } from '../components/ui.jsx';
import { PROVINCES, TRANSPORT_FREQUENCIES } from '../lib/forms.js';
import { useForm } from '../lib/useForm.js';
import { useTitle } from '../lib/useTitle.js';

// Transporte solidario: gente que viaja a menudo a otra ciudad y puede llevar
// a un gatito con su nueva familia. Así se puede adoptar también fuera de
// Extremadura (el panel cruza cada solicitud con quien viaja a su provincia).

const MAX_DESTINATIONS = 6;
const EMPTY_DESTINATION = { city: '', province: '' };
const INITIAL = {
  name: '',
  email: '',
  phone: '',
  origin: '',
  destinations: [EMPTY_DESTINATION],
  frequency: '',
  notes: '',
  adult: false,
  privacy: false,
  website: '',
};

const STEPS = [
  { emoji: '📝', title: 'Te apuntas', text: 'Nos dices desde dónde sales y a qué ciudades sueles ir.' },
  { emoji: '💌', title: 'Te avisamos', text: 'Si alguien de allí quiere adoptar, te escribimos para ver si te viene bien. Sin compromiso.' },
  { emoji: '🧺', title: 'Viaja contigo', text: 'El gatito va en su transportín, con todo preparado, y la familia lo recoge al llegar.' },
];

function Destination({ index, value, onChange, onRemove, errors }) {
  const error = (key) => errors[`destinations.${index}.${key}`];
  return (
    <li className="grid gap-3 rounded-3xl bg-crema p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold">
          <MapPin className="size-5 text-canela" aria-hidden /> Destino {index + 1}
        </p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="grid size-11 place-items-center rounded-full text-canela-oscuro hover:bg-canela-claro"
            aria-label={`Quitar el destino ${index + 1}`}
          >
            <Trash2 className="size-5" />
          </button>
        )}
      </div>
      <TextInput label="Ciudad o pueblo" placeholder="Madrid" value={value.city} onChange={(city) => onChange({ ...value, city })} error={error('city')} />
      <Field label="Provincia" error={error('province')}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            value={value.province}
            onChange={(event) => onChange({ ...value, province: event.target.value })}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cx(
              'w-full appearance-none rounded-2xl border-2 bg-nata px-4 py-3 text-base focus:border-canela focus:outline-none',
              invalid ? 'border-canela-oscuro' : 'border-borde',
            )}
          >
            <option value="">Elige la provincia</option>
            {PROVINCES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </Field>
    </li>
  );
}

function TransportForm() {
  const { values, set, field, errors, formError, sending, submit } = useForm(INITIAL, {
    draft: 'transporte',
    omit: ['privacy', 'website'],
  });
  const [sent, setSent] = useState(false);
  const destinations = values.destinations?.length ? values.destinations : [EMPTY_DESTINATION];
  const setDestination = (index, value) => set('destinations', destinations.map((d, i) => (i === index ? value : d)));

  if (sent) {
    return (
      <Card className="bg-menta text-center">
        <p className="text-5xl" aria-hidden>
          🚗💕
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-menta-oscuro">¡Gracias por apuntarte!</h2>
        <p className="mt-1">Cuando alguien de tus destinos quiera adoptar, te escribiremos para ver si te viene bien.</p>
      </Card>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await submit('/transporte', { ...values, destinations })) setSent(true);
      }}
    >
      <Honeypot value={values.website} onChange={(v) => set('website', v)} />
      <TextInput label="Nombre y apellidos" autoComplete="name" {...field('name')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Email" type="email" inputMode="email" autoComplete="email" {...field('email')} />
        <TextInput label="Teléfono" type="tel" inputMode="tel" autoComplete="tel" {...field('phone')} />
      </div>
      <TextInput label="¿Desde dónde sales?" autoComplete="address-level2" placeholder="Almendralejo" {...field('origin')} />
      <fieldset className="grid gap-3">
        <legend className="mb-1.5 font-bold">¿A dónde viajas a menudo?</legend>
        <ul className="grid gap-3">
          {destinations.map((destination, index) => (
            <Destination
              key={index}
              index={index}
              value={destination}
              errors={errors}
              onChange={(value) => setDestination(index, value)}
              onRemove={destinations.length > 1 ? () => set('destinations', destinations.filter((_, i) => i !== index)) : null}
            />
          ))}
        </ul>
        {errors.destinations && <p className="text-sm font-semibold text-canela-oscuro">{errors.destinations}</p>}
        {destinations.length < MAX_DESTINATIONS && (
          <Button variant="soft" onClick={() => set('destinations', [...destinations, EMPTY_DESTINATION])} className="justify-self-start">
            <Plus className="size-4" /> Añadir otro destino
          </Button>
        )}
      </fieldset>
      <Choice label="¿Cada cuánto viajas?" options={TRANSPORT_FREQUENCIES} columns {...field('frequency')} />
      <TextArea
        label="¿Algo más que debamos saber?"
        optional
        rows={3}
        placeholder="Qué días sueles ir, si vas en coche o en autobús, si puedes llevar un transportín…"
        {...field('notes')}
      />
      <Checkbox checked={values.adult} onChange={(v) => set('adult', v)} error={errors.adult}>
        Soy mayor de edad
      </Checkbox>
      <Checkbox checked={values.privacy} onChange={(v) => set('privacy', v)} error={errors.privacy}>
        He leído la{' '}
        <Link to="/privacidad" target="_blank" className="font-bold text-canela-oscuro underline">
          política de privacidad
        </Link>{' '}
        y acepto que Bigotes use estos datos para avisarme cuando un gatito pueda viajar conmigo.
      </Checkbox>
      <FormError>{formError}</FormError>
      <Button type="submit" size="lg" block loading={sending}>
        <Car className="size-5" /> Apuntarme al transporte solidario
      </Button>
    </form>
  );
}

export default function Transport() {
  useTitle('Transporte solidario');
  return (
    <>
      <PageHeader title="Transporte solidario" emoji="🚗">
        ¿Viajas a menudo a otra ciudad? Puedes ayudar a que un gatito de Bigotes llegue a su familia, aunque viva lejos de
        Extremadura.
      </PageHeader>
      <div className="grid gap-8 px-4 md:grid-cols-5">
        <div className="grid content-start gap-3 md:col-span-2">
          {STEPS.map((step) => (
            <Card key={step.title} className="flex gap-3">
              <span className="text-3xl" aria-hidden>
                {step.emoji}
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">{step.title}</h2>
                <p className="text-cacao-suave">{step.text}</p>
              </div>
            </Card>
          ))}
          <Card className="flex gap-3 bg-lavanda">
            <HeartHandshake className="size-7 shrink-0 text-lavanda-oscuro" aria-hidden />
            <p className="text-sm">
              Siempre te acompañamos: te contamos todo del gatito y de la familia y estamos al teléfono durante el viaje.
            </p>
          </Card>
        </div>
        <div className="md:col-span-3">
          <TransportForm />
        </div>
      </div>
    </>
  );
}
