import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Car, Gift, Landmark, Megaphone, Package, PiggyBank, Share2, Smartphone } from 'lucide-react';
import { CopyValue } from '../components/CopyValue.jsx';
import { HELP_LINKS, useSite } from '../components/Layout.jsx';
import { Checkbox, FormError, Honeypot, MultiChoice, TextArea, TextInput } from '../components/form.jsx';
import { Button, ButtonLink, Card, ErrorState, PageHeader, Spinner, cx } from '../components/ui.jsx';
import { VOLUNTEER_AREAS } from '../lib/forms.js';
import { euros, MEMBER_PERIODS } from '../lib/members.js';
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
      <TextInput label="Municipio" autoComplete="address-level2" {...field('municipality')} />
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
  const { volunteering, donations, members } = data.content;
  const anyMethod = Boolean(donations.bizum || donations.iban || donations.teaming || donations.paypal);

  return (
    <>
      <PageHeader title="Colabora con Bigotes" emoji="🐾">
        Rescatar, curar y buscar familia a cada gatito es posible gracias a gente como tú. ¡Todas las formas de ayudar cuentan!
      </PageHeader>

      {/* Accesos a cada forma de ayudar, a primera vista. */}
      <nav aria-label="Formas de colaborar" className="px-4">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {HELP_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={cx('flex h-full flex-col gap-1 rounded-3xl p-4 shadow-suave transition hover:-translate-y-0.5', link.tone)}
              >
                <span className="text-3xl" aria-hidden>
                  {link.emoji}
                </span>
                <span className="font-display text-lg font-semibold leading-tight">{link.label}</span>
                <span className="text-sm text-cacao-suave">{link.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section id="socios" className="mt-12 scroll-mt-20 px-4" aria-labelledby="socios-titulo">
        <Card className="grid gap-5 bg-mantequilla md:grid-cols-5 md:items-center">
          <div className="md:col-span-3">
            <h2 id="socios-titulo" className="font-display text-3xl font-semibold">
              Hazte socio/a 💛
            </h2>
            <p className="mt-2 text-lg">{members.intro}</p>
            <p className="mt-2 text-cacao-suave">Cada vez que pagues te llegará tu recibo por correo.</p>
          </div>
          <div className="grid gap-3 md:col-span-2">
            <ul className="flex flex-wrap gap-2">
              {members.fees.map((fee) => (
                <li key={`${fee.amount}-${fee.period}`} className="rounded-2xl bg-nata px-4 py-2 font-bold shadow-suave">
                  <span className="font-display text-xl text-mantequilla-oscuro">{euros(fee.amount)}</span> {MEMBER_PERIODS[fee.period].every}
                </li>
              ))}
            </ul>
            <ButtonLink to="/hazte-socio" size="lg" block>
              Quiero ser socio/a <ArrowRight className="size-5" />
            </ButtonLink>
          </div>
        </Card>
      </section>

      <section id="donar" className="mt-14 scroll-mt-20 px-4" aria-labelledby="donaciones">
        <div className="flex items-center gap-3">
          <PiggyBank className="size-8 text-canela" aria-hidden />
          <h2 id="donaciones" className="font-display text-3xl font-semibold">
            Haz una donación
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
        {!anyMethod && (
          <p className="mt-3 text-cacao-suave">
            Mientras preparamos las donaciones online, puedes{' '}
            <Link to="/hazte-socio" className="font-bold text-canela-oscuro underline">
              hacerte socio/a
            </Link>{' '}
            o{' '}
            <Link to="/contacto" className="font-bold text-canela-oscuro underline">
              escribirnos
            </Link>
            .
          </p>
        )}
        <Card className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Package className="size-9 shrink-0 text-canela" aria-hidden />
          <div className="flex-1">
            <h3 className="font-display text-xl font-semibold">¿Prefieres donar pienso, arena o mantas?</h3>
            <p className="text-cacao-suave">
              También nos vienen genial transportines, rascadores o medicinas sin caducar. Escríbenos y te contamos qué hace más
              falta ahora.
            </p>
          </div>
          <ButtonLink to="/contacto" variant="secondary" className="shrink-0">
            Escribirnos
          </ButtonLink>
        </Card>
      </section>

      <section id="voluntariado" className="mt-14 grid scroll-mt-20 gap-6 px-4 md:grid-cols-5" aria-labelledby="voluntariado-titulo">
        <div className="md:col-span-2">
          <h2 id="voluntariado-titulo" className="font-display text-3xl font-semibold">
            Hazte voluntario/a 🙋
          </h2>
          <p className="mt-2 whitespace-pre-line text-lg text-cacao-suave">{volunteering.intro}</p>
        </div>
        <div className="md:col-span-3">
          <VolunteerForm />
        </div>
      </section>

      <section id="viajes" className="mt-14 scroll-mt-20 px-4" aria-labelledby="viajes-titulo">
        <Card className="flex flex-col gap-4 bg-menta sm:flex-row sm:items-center">
          <Car className="size-10 shrink-0 text-menta-oscuro" aria-hidden />
          <div className="flex-1">
            <h2 id="viajes-titulo" className="font-display text-2xl font-semibold">
              Viajes solidarios
            </h2>
            <p className="mt-1">
              ¿Viajas a menudo a otra ciudad? Apúntate y, cuando alguien de allí quiera adoptar, el gatito podrá viajar contigo hasta
              su nueva familia.
            </p>
          </div>
          <ButtonLink to="/viajes-solidarios" size="lg" className="shrink-0">
            Apuntarme 🚗
          </ButtonLink>
        </Card>
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
                Si conoces a alguien que busca gatito, mándale a <Link to="/miaugram" className="font-bold underline">nuestro Miaugram</Link>.
              </p>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
