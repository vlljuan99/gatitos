import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Gift, Landmark, Megaphone, PiggyBank, Share2, Smartphone } from 'lucide-react';
import { useSite } from '../components/Layout.jsx';
import { Checkbox, FormError, Honeypot, MultiChoice, TextArea, TextInput } from '../components/form.jsx';
import { Button, Card, ErrorState, PageHeader, Spinner, cx } from '../components/ui.jsx';
import { VOLUNTEER_AREAS } from '../lib/forms.js';
import { useForm } from '../lib/useForm.js';
import { useTitle } from '../lib/useTitle.js';

const INITIAL = {
  name: '',
  email: '',
  phone: '',
  municipality: '',
  areas: [],
  availability: '',
  message: '',
  adult: false,
  privacy: false,
  website: '',
};

function VolunteerForm() {
  const { values, set, field, errors, formError, sending, submit } = useForm(INITIAL, { draft: 'voluntariado', omit: ['privacy', 'website'] });
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Card className="bg-menta text-center">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-menta-oscuro">¡Gracias por sumarte!</h3>
        <p className="mt-1">Te escribiremos muy pronto para contarte cómo puedes ayudar.</p>
      </Card>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await submit('/voluntariado')) setSent(true);
      }}
    >
      <Honeypot value={values.website} onChange={(v) => set('website', v)} />
      <MultiChoice label="¿Cómo te gustaría ayudar?" options={VOLUNTEER_AREAS} {...field('areas')} />
      <TextInput label="Nombre" autoComplete="name" {...field('name')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Email" type="email" inputMode="email" autoComplete="email" {...field('email')} />
        <TextInput label="Teléfono" type="tel" inputMode="tel" autoComplete="tel" {...field('phone')} />
      </div>
      <TextInput label="Municipio" autoComplete="address-level2" placeholder="Almendralejo" {...field('municipality')} />
      <TextInput label="¿Cuándo sueles tener tiempo?" optional placeholder="Tardes entre semana, sábados por la mañana…" {...field('availability')} />
      <TextArea label="¿Algo más que quieras contarnos?" optional rows={3} {...field('message')} />
      <Checkbox checked={values.adult} onChange={(v) => set('adult', v)} error={errors.adult}>
        Soy mayor de edad
      </Checkbox>
      <Checkbox checked={values.privacy} onChange={(v) => set('privacy', v)} error={errors.privacy}>
        He leído la{' '}
        <Link to="/privacidad" target="_blank" className="font-bold text-canela-oscuro underline">
          política de privacidad
        </Link>{' '}
        y acepto que Bigotes use estos datos para contactarme.
      </Checkbox>
      <FormError>{formError}</FormError>
      <Button type="submit" size="lg" block loading={sending}>
        Quiero ser voluntario/a 🙋
      </Button>
    </form>
  );
}

function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copia el dato:', value);
        }
      }}
      className="mt-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-crema px-4 py-3 text-left font-mono text-sm font-bold"
    >
      <span className="break-all">{value}</span>
      {copied ? <Check className="size-5 shrink-0 text-menta-oscuro" aria-label="Copiado" /> : <Copy className="size-5 shrink-0" aria-label="Copiar" />}
    </button>
  );
}

function DonationMethod({ icon: Icon, title, tone, children, value, href, hrefLabel }) {
  const available = Boolean(value || href);
  return (
    <Card className={cx('flex flex-col', !available && 'opacity-90')}>
      <div className="flex items-center gap-3">
        <span className={cx('grid size-11 place-items-center rounded-2xl', tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {!available && <span className="ml-auto rounded-full bg-mantequilla px-2.5 py-0.5 text-xs font-bold text-mantequilla-oscuro">Muy pronto</span>}
      </div>
      <p className="mt-2 text-sm text-cacao-suave">{children}</p>
      {value && <CopyValue value={value} />}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 font-bold text-canela-oscuro underline">
          {hrefLabel}
        </a>
      )}
    </Card>
  );
}

export default function Collaborate() {
  useTitle('Colabora');
  const { data, error, loading, reload } = useSite();
  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { volunteering, donations } = data.content;

  return (
    <>
      <PageHeader title="Colabora con Bigotes" emoji="🙋">
        Hay muchas formas de ayudar a los gatitos. ¡Todas cuentan!
      </PageHeader>

      <section className="grid gap-6 px-4 md:grid-cols-5" aria-labelledby="voluntariado">
        <div className="md:col-span-2">
          <h2 id="voluntariado" className="font-display text-2xl font-semibold">
            Hazte voluntario/a
          </h2>
          <p className="mt-2 whitespace-pre-line text-lg text-cacao-suave">{volunteering.intro}</p>
        </div>
        <div className="md:col-span-3">
          <VolunteerForm />
        </div>
      </section>

      <section id="donar" className="mt-14 scroll-mt-20 px-4" aria-labelledby="donaciones">
        <div className="flex items-center gap-3">
          <PiggyBank className="size-8 text-canela" aria-hidden />
          <h2 id="donaciones" className="font-display text-2xl font-semibold">
            Donaciones
          </h2>
        </div>
        <p className="mt-2 max-w-2xl whitespace-pre-line text-lg text-cacao-suave">{donations.intro}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DonationMethod icon={Smartphone} title="Bizum" tone="bg-cielo text-cielo-oscuro" value={donations.bizum}>
            Lo más rápido desde el móvil.
          </DonationMethod>
          <DonationMethod icon={Landmark} title="Transferencia" tone="bg-menta text-menta-oscuro" value={donations.iban}>
            Ideal para aportaciones puntuales.
          </DonationMethod>
          <DonationMethod
            icon={Gift}
            title="Teaming"
            tone="bg-lavanda text-lavanda-oscuro"
            href={donations.teaming}
            hrefLabel="Únete a nuestro grupo"
          >
            1 € al mes que, entre muchos, hace muchísimo.
          </DonationMethod>
          <DonationMethod icon={PiggyBank} title="PayPal" tone="bg-mantequilla text-mantequilla-oscuro" href={donations.paypal} hrefLabel="Donar con PayPal">
            Con tarjeta o con tu cuenta de PayPal.
          </DonationMethod>
        </div>
      </section>

      <section className="mt-14 px-4" aria-labelledby="otras">
        <h2 id="otras" className="font-display text-2xl font-semibold">
          Otras formas de ayudar
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Card className="flex gap-4">
            <Share2 className="size-7 shrink-0 text-canela" aria-hidden />
            <div>
              <h3 className="font-display text-lg font-semibold">Comparte sus fichas</h3>
              <p className="text-cacao-suave">
                Un gatito compartido llega a mucha más gente. Cada ficha tiene su botón para mandarla por WhatsApp.
              </p>
            </div>
          </Card>
          <Card className="flex gap-4">
            <Megaphone className="size-7 shrink-0 text-canela" aria-hidden />
            <div>
              <h3 className="font-display text-lg font-semibold">Habla de nosotros</h3>
              <p className="text-cacao-suave">
                Si conoces a alguien que busca gatito, mándale a <Link to="/match" className="font-bold underline">nuestro match</Link>.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
