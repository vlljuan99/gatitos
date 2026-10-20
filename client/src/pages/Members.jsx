import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, HeartHandshake, Mail, Receipt, Stethoscope, Utensils } from 'lucide-react';
import { useSite } from '../components/Layout.jsx';
import { CopyValue } from '../components/CopyValue.jsx';
import { Checkbox, Choice, Field, FormError, Honeypot, TextArea, TextInput } from '../components/form.jsx';
import { Button, ButtonLink, Card, ErrorState, PageHeader, Spinner, cx } from '../components/ui.jsx';
import { euros, feeText, MEMBER_PERIODS, SIGNUP_METHODS } from '../lib/members.js';
import { useForm } from '../lib/useForm.js';
import { useTitle } from '../lib/useTitle.js';

// Hazte socio/a: se elige una cuota, se deja el contacto y se cuenta cómo
// prefiere pagar. Sin pasarela de pago: al terminar se enseña cómo pagar la
// primera cuota y, cuando el equipo apunta el pago en el panel, llega el
// recibo por correo.

const INITIAL = {
  fee: '',
  amount: '',
  period: 'mensual',
  name: '',
  email: '',
  phone: '',
  municipality: '',
  method: '',
  message: '',
  adult: false,
  privacy: false,
  website: '',
};

const PERIOD_CHOICES = Object.entries(MEMBER_PERIODS).map(([value, p]) => ({ value, label: p.label }));

const GOOD_FOR = [
  { Icon: Utensils, title: 'Pienso y arena', text: 'Todo el año, también para las colonias.', tone: 'bg-mantequilla text-mantequilla-oscuro' },
  { Icon: Stethoscope, title: 'Veterinario', text: 'Vacunas, esterilizaciones y urgencias.', tone: 'bg-menta text-menta-oscuro' },
  { Icon: Receipt, title: 'Tu recibo', text: 'Te llega por correo cada vez que pagas.', tone: 'bg-lavanda text-lavanda-oscuro' },
];

/** Cuotas que ofrece la asociación como tarjetas, más «Otra cantidad». */
function FeePicker({ fees, allowCustom, value, onChange, error }) {
  const options = [...fees.map((f, i) => ({ key: String(i), ...f })), ...(allowCustom ? [{ key: 'otra' }] : [])];
  return (
    <Field label="Elige tu cuota" error={error} as="fieldset">
      {() => (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {options.map((option) => {
            const selected = value === option.key;
            return (
              <label
                key={option.key}
                className={cx(
                  'relative flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-3xl border-4 bg-nata p-3 text-center shadow-suave transition',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-canela',
                  selected ? 'border-canela' : 'border-transparent',
                )}
              >
                <input type="radio" name="cuota" className="sr-only" checked={selected} onChange={() => onChange(option.key)} />
                {option.key === 'otra' ? (
                  <span className="font-display text-xl font-semibold">Otra cantidad</span>
                ) : (
                  <>
                    <span className="font-display text-3xl font-semibold text-canela-oscuro">{euros(option.amount)}</span>
                    <span className="font-bold text-cacao-suave">{MEMBER_PERIODS[option.period].every}</span>
                  </>
                )}
                {selected && (
                  <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-canela text-white">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </Field>
  );
}

function HowToPay({ payment, method, email }) {
  const { bizum, iban, concept, fee } = payment;
  const ways = [
    bizum && (method === 'bizum' || !iban) && { title: 'Por Bizum', value: bizum, label: 'el número de Bizum' },
    iban && (method === 'transferencia' || !bizum) && { title: 'Por transferencia', value: iban, label: 'el IBAN' },
  ].filter(Boolean);
  return (
    <div className="grid gap-4 text-left">
      {method === 'efectivo' ? (
        <p>Te escribiremos para quedar y que puedas pagar <strong>{fee}</strong> en mano.</p>
      ) : ways.length ? (
        <>
          <p>
            Para completar tu alta, paga tu primera cuota de <strong>{fee}</strong>:
          </p>
          {ways.map((way) => (
            <div key={way.title}>
              <p className="font-bold">{way.title}</p>
              <CopyValue value={way.value} label={way.label} />
            </div>
          ))}
          <div>
            <p className="font-bold">Con este concepto</p>
            <CopyValue value={concept} label="el concepto" />
          </div>
        </>
      ) : (
        <p>En unos días te escribiremos para contarte cómo pagar tu primera cuota de {fee}.</p>
      )}
      <p className="flex gap-2 rounded-2xl bg-crema p-3 text-sm">
        <Mail className="size-5 shrink-0 text-canela" aria-hidden />
        <span>
          Cuando recibamos el pago te mandaremos el recibo a <strong>{email}</strong>. Te lo hemos contado también por correo.
        </span>
      </p>
    </div>
  );
}

function SignupForm({ settings, donations }) {
  const { values, set, field, errors, formError, sending, submit } = useForm(INITIAL, { draft: 'socio', omit: ['privacy', 'website'] });
  const [done, setDone] = useState(null);
  const chosen = values.fee === 'otra' ? null : settings.fees[Number(values.fee)];
  const methods = SIGNUP_METHODS.filter((m) => m.value === 'efectivo' || (m.value === 'bizum' ? donations.bizum : donations.iban) || (!donations.bizum && !donations.iban));

  if (done) {
    return (
      <Card className="text-center">
        <motion.p initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-6xl" aria-hidden>
          💛
        </motion.p>
        <h2 className="mt-3 font-display text-3xl font-semibold">¡Ya casi eres de la familia!</h2>
        <p className="mt-2 text-cacao-suave">Gracias, {values.name.split(' ')[0] || 'de corazón'}. Así podremos cuidar de muchos más gatos.</p>
        <div className="mt-5">
          <HowToPay payment={done} method={values.method} email={values.email} />
        </div>
        <ButtonLink to="/gatitos" variant="secondary" className="mt-6">
          Ver a los gatitos
        </ButtonLink>
      </Card>
    );
  }

  async function send(event) {
    event.preventDefault();
    const body = {
      ...values,
      amount: chosen ? chosen.amount : values.amount,
      period: chosen ? chosen.period : values.period,
    };
    if (!values.fee) body.amount = '';
    const result = await submit('/socios', body);
    if (result) {
      setDone(result.payment ?? { fee: feeText(body.amount, body.period), concept: '', bizum: '', iban: '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <form noValidate className="grid gap-6" onSubmit={send}>
      <Honeypot value={values.website} onChange={(v) => set('website', v)} />
      <FeePicker
        fees={settings.fees}
        allowCustom={settings.allowCustom}
        value={values.fee}
        onChange={(v) => set('fee', v)}
        error={values.fee === 'otra' ? undefined : errors.amount}
      />
      {values.fee === 'otra' && (
        <div className="grid gap-4 rounded-3xl bg-canela-claro/60 p-4">
          <TextInput label="¿Cuánto?" inputMode="decimal" placeholder="10" hint="En euros. Lo mínimo es 1 €." {...field('amount')} />
          <Choice label="¿Cada cuánto?" options={PERIOD_CHOICES} {...field('period')} />
        </div>
      )}
      <TextInput label="Nombre y apellidos" autoComplete="name" {...field('name')} />
      <TextInput label="Email" type="email" inputMode="email" autoComplete="email" hint="Aquí te llegarán tus recibos." {...field('email')} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput label="Teléfono" optional type="tel" inputMode="tel" autoComplete="tel" hint="Para avisarte de la renovación." {...field('phone')} />
        <TextInput label="Municipio" autoComplete="address-level2" {...field('municipality')} />
      </div>
      <Choice label="¿Cómo prefieres pagar?" options={methods} {...field('method')} />
      <TextArea label="¿Algo que quieras contarnos?" optional rows={2} {...field('message')} />
      <Checkbox checked={values.adult} onChange={(v) => set('adult', v)} error={errors.adult}>
        Soy mayor de edad
      </Checkbox>
      <Checkbox checked={values.privacy} onChange={(v) => set('privacy', v)} error={errors.privacy}>
        He leído la{' '}
        <Link to="/privacidad" target="_blank" className="font-bold text-canela-oscuro underline">
          política de privacidad
        </Link>{' '}
        y acepto que Bigotes use estos datos para gestionar mi cuota y mandarme los recibos.
      </Checkbox>
      <FormError>{formError}</FormError>
      <Button type="submit" size="lg" block loading={sending}>
        Hacerme socio/a 💛
      </Button>
      <p className="text-center text-sm text-cacao-suave">Puedes darte de baja cuando quieras: solo tienes que decírnoslo.</p>
    </form>
  );
}

export default function Members() {
  useTitle('Hazte socio/a');
  const { data, error, loading, reload } = useSite();
  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { members, donations } = data.content;

  return (
    <>
      <PageHeader title="Hazte socio/a" emoji="💛">
        {members.intro}
      </PageHeader>
      <div className="grid gap-8 px-4 md:grid-cols-5">
        <aside className="order-last grid content-start gap-3 md:order-none md:col-span-2">
          {GOOD_FOR.map(({ Icon, title, text, tone }) => (
            <Card key={title} className="flex items-center gap-3">
              <span className={cx('grid size-12 shrink-0 place-items-center rounded-2xl', tone)}>
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">{title}</h2>
                <p className="text-cacao-suave">{text}</p>
              </div>
            </Card>
          ))}
          <Card className="flex gap-3 bg-lavanda">
            <HeartHandshake className="size-7 shrink-0 text-lavanda-oscuro" aria-hidden />
            <p className="text-sm">
              ¿Prefieres ayudar de otra forma? Puedes{' '}
              <Link to="/colabora#donar" className="font-bold underline">
                hacer una donación
              </Link>{' '}
              o{' '}
              <Link to="/colabora#voluntariado" className="font-bold underline">
                echarnos una mano
              </Link>
              .
            </p>
          </Card>
        </aside>
        <div className="md:col-span-3">
          <SignupForm settings={members} donations={donations} />
        </div>
      </div>
    </>
  );
}
