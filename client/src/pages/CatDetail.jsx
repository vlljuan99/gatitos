import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarHeart, Check, CircleHelp, MapPin, Sparkles, X } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { SexIcon, CatCard } from '../components/CatCard.jsx';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { ButtonLink, Card, EmptyState, ErrorState, Spinner, Tag, cx } from '../components/ui.jsx';
import {
  ageText,
  COMPAT,
  FIV_FELV_LABELS,
  gendered,
  SEX_LABELS,
  statusLabel,
} from '../lib/cats.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

function Gallery({ cat }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef(null);
  const photos = cat.photos.length ? cat.photos : [null];

  function onScroll() {
    const el = scroller.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }
  function goTo(i) {
    scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative md:overflow-hidden md:rounded-[2rem]">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto md:aspect-square"
        aria-roledescription="carrusel"
        aria-label={`Fotos de ${cat.name}`}
      >
        {photos.map((photo, i) => (
          <div key={photo?.id ?? 'ilustracion'} className="h-full w-full shrink-0 snap-center" aria-label={`Foto ${i + 1} de ${photos.length}`}>
            <CatPhoto
              cat={cat}
              photo={photo ?? undefined}
              eager={i === 0}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="size-full"
              alt={`${cat.name}, foto ${i + 1}`}
            />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center gap-1.5 md:bottom-4">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === index}
              className={cx('h-2 rounded-full bg-nata shadow transition-all', i === index ? 'w-6' : 'w-2 opacity-70')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompatIcon({ value }) {
  if (value === 'si') return <Check className="size-5 text-menta-oscuro" aria-label="Sí" />;
  if (value === 'no') return <X className="size-5 text-fresa-oscuro" aria-label="No" />;
  return <CircleHelp className="size-5 text-cacao-suave" aria-label="No lo sabemos todavía" />;
}

function HealthItem({ done, children }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cx('grid size-6 place-items-center rounded-full', done ? 'bg-menta text-menta-oscuro' : 'bg-cacao/5 text-cacao-suave')}
        aria-hidden
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : '·'}
      </span>
      <span className={done ? '' : 'text-cacao-suave'}>
        {children}
        {!done && <span className="sr-only"> (pendiente)</span>}
      </span>
    </li>
  );
}

export default function CatDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(`/gatitos/${slug}`, { maxAge: 30_000 });
  const others = useApi('/gatitos');
  const cat = data?.cat;
  useTitle(cat ? `${cat.name} ${cat.status === 'adoptado' ? 'ya tiene hogar 💕' : 'busca hogar 🐾'}` : null);

  if (loading) return <Spinner />;
  if (error?.status === 404) {
    return (
      <EmptyState title="No encontramos a este gatito" action={<ButtonLink to="/gatitos">Ver gatitos en adopción</ButtonLink>}>
        Puede que ya haya encontrado familia. ¡Mira quién más te está esperando!
      </EmptyState>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const g = (word) => gendered(word, cat.sex);
  const age = ageText(cat.birthDate);
  const adopted = cat.status === 'adoptado';
  const reserved = cat.status === 'reservado';
  const more = (others.data?.cats ?? []).filter((c) => c.slug !== cat.slug && c.status === 'disponible').slice(0, 4);
  const shareText = adopted ? `${cat.name} ya tiene hogar gracias a Bigotes 💕` : `¡Mira a ${cat.name}! Busca hogar en Bigotes 🐾`;

  return (
    <article className="pb-28 md:px-4 md:pt-6 md:pb-10">
      <div className="md:grid md:grid-cols-2 md:gap-8">
        <div className="relative md:sticky md:top-24 md:self-start">
          <Gallery cat={cat} />
          <div className="absolute inset-x-0 top-0 flex justify-between p-3">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/gatitos'))}
              className="grid size-11 place-items-center rounded-full bg-nata/90 shadow-suave backdrop-blur"
              aria-label="Volver"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex gap-2">
              <ShareButton
                title={`${cat.name} · Bigotes`}
                text={shareText}
                path={`/gatitos/${cat.slug}`}
                className="grid size-11 place-items-center rounded-full bg-nata/90 shadow-suave backdrop-blur"
              />
              {!adopted && <FavoriteButton cat={cat} className="size-11" />}
            </div>
          </div>
        </div>

        <div className="relative -mt-7 rounded-t-[2rem] bg-crema px-4 pt-6 md:mt-0 md:rounded-none md:px-0 md:pt-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 font-display text-4xl font-semibold">
                {cat.name} <SexIcon sex={cat.sex} className="size-6" />
              </h1>
              <p className="mt-1 text-lg text-cacao-suave">
                {[SEX_LABELS[cat.sex], age, cat.coat].filter(Boolean).join(' · ')}
              </p>
            </div>
            {(adopted || reserved) && (
              <Tag tone={adopted ? 'menta' : 'mantequilla'} className="shrink-0">
                {statusLabel(cat.status, cat.sex)} {adopted ? '💕' : '💛'}
              </Tag>
            )}
          </div>

          {cat.summary && <p className="mt-4 text-xl leading-snug">{cat.summary}</p>}

          {cat.personality.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Personalidad">
              {cat.personality.map((tag) => (
                <li key={tag}>
                  <Tag tone="lavanda">{g(tag)}</Tag>
                </li>
              ))}
            </ul>
          )}

          {adopted && cat.happyEnding && (
            <Card className="mt-6 bg-menta">
              <h2 className="font-display text-xl font-semibold text-menta-oscuro">Su final feliz 💕</h2>
              <p className="mt-2 whitespace-pre-line">{cat.happyEnding}</p>
            </Card>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Card>
              <h2 className="font-display text-lg font-semibold">Se lleva bien con</h2>
              <ul className="mt-3 grid gap-2">
                {COMPAT.map(({ key, label }) => (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span>{label}</span>
                    <CompatIcon value={cat.goodWith[key]} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">Salud</h2>
              <ul className="mt-3 grid gap-2">
                <HealthItem done={cat.health.vaccinated}>{g('Vacunado')}</HealthItem>
                <HealthItem done={cat.health.dewormed}>{g('Desparasitado')}</HealthItem>
                <HealthItem done={cat.health.microchipped}>Con microchip</HealthItem>
                <HealthItem done={cat.health.sterilized}>{g('Esterilizado')}</HealthItem>
                <HealthItem done={cat.health.fivFelv === 'negativo'}>{FIV_FELV_LABELS[cat.health.fivFelv]}</HealthItem>
              </ul>
            </Card>
          </div>

          {cat.specialNeeds && (
            <Card className="mt-3 bg-mantequilla">
              <h2 className="font-display text-lg font-semibold text-mantequilla-oscuro">Necesidades especiales</h2>
              <p className="mt-1 whitespace-pre-line">{cat.specialNeeds}</p>
            </Card>
          )}

          {cat.story && (
            <section className="mt-6">
              <h2 className="font-display text-2xl font-semibold">Su historia</h2>
              <p className="mt-2 whitespace-pre-line text-lg leading-relaxed">{cat.story}</p>
            </section>
          )}

          <ul className="mt-6 grid gap-2 text-cacao-suave">
            {cat.location && (
              <li className="flex items-center gap-2">
                <MapPin className="size-5" aria-hidden /> {cat.location}
              </li>
            )}
            {cat.arrivedAt && !adopted && (
              <li className="flex items-center gap-2">
                <CalendarHeart className="size-5" aria-hidden /> Con nosotros desde{' '}
                {new Date(cat.arrivedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </li>
            )}
          </ul>

          {!adopted && (
            <div className="fixed inset-x-0 bottom-[4.75rem] z-30 px-4 md:static md:mt-8 md:px-0">
              {reserved ? (
                <div className="rounded-3xl bg-mantequilla p-4 text-center shadow-flotante md:shadow-none">
                  <p className="font-bold text-mantequilla-oscuro">
                    {cat.name} está {g('reservado')}: ¡su familia está a punto de llegar!
                  </p>
                  <Link to="/gatitos" className="mt-1 inline-block font-bold underline">
                    Conoce a otros gatitos
                  </Link>
                </div>
              ) : (
                <ButtonLink to={`/adoptar?gatito=${cat.slug}`} size="lg" block className="shadow-flotante md:shadow-suave">
                  Quiero {cat.sex === 'hembra' ? 'adoptarla' : 'adoptarle'} 💕
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-12 px-4 md:px-0">
          <h2 className="mb-4 font-display text-2xl font-semibold">
            Si te gusta {cat.name}, {more.length > 1 ? 'también te pueden gustar' : 'también te puede gustar'}
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {more.map((other) => (
              <li key={other.id}>
                <CatCard cat={other} sizes="(min-width: 768px) 25vw, 50vw" />
              </li>
            ))}
          </ul>
          <div className="mt-6 text-center">
            <ButtonLink to="/match" variant="soft">
              <Sparkles className="size-5" /> Descubre tu match
            </ButtonLink>
          </div>
        </section>
      )}
    </article>
  );
}
