import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, PawPrint } from 'lucide-react';
import { HELP_LINKS, useSite } from '../components/Layout.jsx';
import { CatCard } from '../components/CatCard.jsx';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { CatIllustration } from '../components/CatIllustration.jsx';
import { ButtonLink, SectionTitle, cx } from '../components/ui.jsx';
import { euros, MEMBER_PERIODS } from '../lib/members.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

// Las fotos de la portada llevan a su publicación del Miaustagram.
const MotionLink = motion.create(Link);

const STEPS = [
  { emoji: '😻', title: 'Enamórate', text: 'Cotillea el Miaustagram o las fichas hasta encontrar al tuyo.' },
  { emoji: '📝', title: 'Envía tu solicitud', text: 'Un formulario cortito para conocerte un poco.' },
  { emoji: '☕', title: 'Nos conocemos', text: 'Hablamos contigo, resolvemos dudas y hacemos una visita.' },
  { emoji: '🏡', title: '¡A casa!', text: 'Firmamos la adopción y empieza vuestra vida juntos.' },
];

function Polaroids({ cats }) {
  const picks = cats.slice(0, 3);
  const tilts = ['-rotate-6', 'rotate-3', '-rotate-2'];
  const positions = ['left-0 top-6', 'right-0 top-0', 'left-1/2 -translate-x-1/2 top-24'];
  if (picks.length === 0) {
    return <CatIllustration tone="canela" seed={0} className="mx-auto size-56 rounded-[3rem] shadow-suave" />;
  }
  return (
    <div className="relative mx-auto h-72 w-full max-w-xs md:h-96 md:max-w-sm">
      {picks.map((cat, i) => (
        <MotionLink
          to={`/miaustagram#gato-${cat.slug}`}
          aria-label={`Ver a ${cat.name} en el Miaustagram`}
          key={cat.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * i, type: 'spring', stiffness: 200, damping: 20 }}
          className={cx('absolute block w-36 rounded-2xl bg-nata p-2 pb-7 shadow-flotante transition-transform active:scale-95 md:w-48', tilts[i], positions[i])}
        >
          <CatPhoto cat={cat} sizes="200px" eager className="aspect-square w-full rounded-xl" alt="" />
          <span className="absolute inset-x-0 bottom-1.5 text-center font-display font-semibold">{cat.name}</span>
        </MotionLink>
      ))}
    </div>
  );
}

/**
 * Formas de ayudar, bien a la vista: hacerse socio/a (la que más ayuda a
 * planificar) en grande y el resto en tarjetas.
 */
function HelpSection({ members }) {
  const [member, ...others] = HELP_LINKS;
  // «Desde 5 € al mes»: la cuota más pequeña que se ofrece.
  const cheapest = members?.fees?.length ? [...members.fees].sort((a, b) => a.amount - b.amount)[0] : null;
  return (
    <section className="mt-12 px-4" aria-labelledby="ayuda">
      <SectionTitle>
        <span id="ayuda">¿No puedes adoptar? ¡Ayúdanos igual! 🐾</span>
      </SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <Link to={member.to} className="flex flex-col justify-between gap-4 rounded-[2rem] bg-mantequilla p-6 shadow-suave transition hover:-translate-y-0.5">
          <div>
            <span className="text-4xl" aria-hidden>
              {member.emoji}
            </span>
            <h3 className="mt-2 font-display text-3xl font-semibold">{member.label}</h3>
            <p className="mt-1 text-lg text-cacao-suave">
              {cheapest
                ? `Desde ${euros(cheapest.amount)} ${MEMBER_PERIODS[cheapest.period].every}: pienso, vacunas y esterilizaciones todo el año.`
                : member.text}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-nata px-5 py-3 font-display text-lg font-medium text-mantequilla-oscuro shadow-suave">
            Quiero ser socio/a <ArrowRight className="size-5" />
          </span>
        </Link>
        <ul className="grid gap-3">
          {others.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="flex min-h-20 items-center gap-4 rounded-3xl bg-nata p-4 shadow-suave transition hover:-translate-y-0.5">
                <span className={cx('grid size-14 shrink-0 place-items-center rounded-2xl text-3xl', link.tone)} aria-hidden>
                  {link.emoji}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-xl font-semibold">{link.label}</span>
                  <span className="text-cacao-suave">{link.text}</span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-canela" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className={cx('rounded-3xl p-4 text-center', tone)}>
      <div className="font-display text-3xl font-semibold md:text-4xl">{value}</div>
      <div className="text-sm font-bold leading-tight">{label}</div>
    </div>
  );
}

export default function Home() {
  useTitle('Bigotes · Adopción de gatitos en Almendralejo');
  const site = useSite();
  const cats = useApi('/gatitos');
  const happy = useApi('/finales-felices');
  const home = site.data?.content.home;
  const stats = site.data?.stats;
  const available = (cats.data?.cats ?? []).filter((cat) => cat.status === 'disponible');
  const featured = [...available].sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <>
      <section className="relative overflow-hidden px-4 pt-6 pb-10 md:grid md:grid-cols-2 md:items-center md:gap-8 md:pt-16">
        <div className="pointer-events-none absolute -right-20 -top-16 size-64 rounded-full bg-canela-claro" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-72 size-48 rounded-full bg-lavanda" aria-hidden />
        <div className="relative">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-nata px-3 py-1 text-sm font-bold text-canela-oscuro shadow-suave">
            🐾 Ayuda al gato callejero · Almendralejo
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] md:text-6xl">
            {home?.heroTitle ?? 'Cada gatito merece un hogar lleno de mimos'}
          </h1>
          <p className="mt-4 text-lg text-cacao-suave md:text-xl">{home?.heroText}</p>
          <div className="mt-6 grid gap-3 sm:flex">
            <ButtonLink to="/miaustagram" size="lg">
              <PawPrint className="size-5" /> Entra en el Miaustagram
            </ButtonLink>
            <ButtonLink to="/gatitos" size="lg" variant="secondary">
              Ver todos los gatitos
            </ButtonLink>
          </div>
          <Link to="/colabora" className="mt-4 inline-flex items-center gap-1 font-bold text-canela-oscuro">
            ¿No puedes adoptar? Hazte socio/a, dona o viaja con un gatito <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="relative mt-10 md:mt-0">
          <Polaroids cats={featured} />
        </div>
      </section>

      {stats && (
        <section className="px-4" aria-label="Nuestros números">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <Stat value={stats.rescued} label="gatitos rescatados" tone="bg-canela-claro text-canela-oscuro" />
            <Stat value={stats.adoptedThisYear} label={`adoptados en ${stats.year}`} tone="bg-menta text-menta-oscuro" />
            <Stat value={stats.available} label="buscan hogar" tone="bg-mantequilla text-mantequilla-oscuro" />
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mt-12">
          <SectionTitle
            className="px-4"
            action={
              <Link to="/gatitos" className="flex items-center gap-1 font-bold text-canela-oscuro">
                Ver todos <ArrowRight className="size-4" />
              </Link>
            }
          >
            Te están esperando
          </SectionTitle>
          <ul className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-4 md:overflow-visible">
            {featured.slice(0, 8).map((cat) => (
              <li key={cat.id} className="w-[46%] shrink-0 snap-start md:w-auto">
                <CatCard cat={cat} sizes="(min-width: 768px) 25vw, 46vw" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <HelpSection members={site.data?.content.members} />

      <section className="mt-12 px-4">
        <SectionTitle>Adoptar es así de fácil</SectionTitle>
        <ol className="grid gap-3 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-3xl bg-nata p-4 shadow-suave md:flex-col">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-crema text-2xl" aria-hidden>
                {step.emoji}
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">
                  <span className="text-canela-oscuro">{i + 1}.</span> {step.title}
                </h3>
                <p className="text-cacao-suave">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link to="/como-trabajamos" className="mt-4 inline-flex items-center gap-1 font-bold text-canela-oscuro">
          Cómo trabajamos y requisitos <ArrowRight className="size-4" />
        </Link>
      </section>

      {happy.data?.cats.length > 0 && (
        <section className="mt-12 px-4">
          <SectionTitle
            action={
              <Link to="/finales-felices" className="flex items-center gap-1 font-bold text-canela-oscuro">
                Ver más <ArrowRight className="size-4" />
              </Link>
            }
          >
            Finales felices 💕
          </SectionTitle>
          <ul className="grid gap-3 md:grid-cols-3">
            {happy.data.cats.slice(0, 3).map((cat) => (
              <li key={cat.id}>
                <Link to={`/gatitos/${cat.slug}`} className="flex gap-3 rounded-3xl bg-nata p-3 shadow-suave">
                  <CatPhoto cat={cat} sizes="96px" className="size-24 shrink-0 rounded-2xl" />
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold">{cat.name}</h3>
                    <p className="line-clamp-3 text-sm text-cacao-suave">{cat.happyEnding || cat.summary}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
