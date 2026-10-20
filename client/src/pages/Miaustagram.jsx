import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Heart, MapPin, MessageCircle, PawPrint, SlidersHorizontal } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { useSite } from '../components/Layout.jsx';
import { whatsappUrl } from '../components/BrandIcons.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { SwipeCarousel } from '../components/SwipeCarousel.jsx';
import { Button, ButtonLink, Chip, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { FiltersPanel } from './Cats.jsx';
import { StoryViewer } from './StoryViewer.jsx';
import { ageText, objectPronoun } from '../lib/cats.js';
import { useFavorites } from '../lib/favorites.js';
import { activeFilterCount, EMPTY_FILTERS, feedPosts, handle, hashtags, storyCats } from '../lib/miaustagram.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

// Miaustagram: los gatitos como si fuera una red social. Un feed vertical con
// una publicación por gatito disponible (fotos y vídeos deslizables, doble
// toque = «Me encanta», «Quiero adoptarle» y compartir) y, arriba, historias
// a pantalla completa de los que tienen vídeo o acaban de llegar. Sin
// comentarios: para preguntar, WhatsApp de la asociación.

const SEEN_KEY = 'bigotes:historias-vistas';

/** Historias ya vistas (anillo gris, como en Instagram). Solo en este navegador. */
function useSeenStories() {
  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const markSeen = useCallback((slug) => {
    if (!slug) return;
    setSeen((current) => {
      if (current.has(slug)) return current;
      const next = new Set(current).add(slug);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-100)));
      } catch {
        // Sin almacenamiento: se recuerda solo mientras la página esté abierta.
      }
      return next;
    });
  }, []);
  return [seen, markSeen];
}

function Avatar({ cat, size = 'size-10', ring = false, seen = false }) {
  return (
    <span
      className={cx(
        'shrink-0 rounded-full',
        ring && (seen ? 'bg-borde p-[2px]' : 'bg-gradient-to-tr from-mantequilla-oscuro via-canela to-lavanda-oscuro p-[3px]'),
      )}
    >
      <span className="block rounded-full bg-crema p-[2px]">
        <CatPhoto cat={cat} sizes="80px" className={cx(size, 'rounded-full')} alt="" />
      </span>
    </span>
  );
}

/** Última diapositiva: en vez de otra foto, la invitación a su perfil. */
function ProfileSlide({ cat }) {
  const facts = [cat.sex === 'hembra' ? 'Hembra' : cat.sex === 'macho' ? 'Macho' : null, ageText(cat.birthDate)].filter(Boolean);
  return (
    <div className="grid size-full place-items-center bg-gradient-to-br from-canela-claro via-crema to-lavanda p-6 text-center">
      <div className="grid justify-items-center gap-3">
        <Avatar cat={cat} size="size-32" ring />
        <p className="font-display text-3xl font-semibold">{cat.name}</p>
        {facts.length > 0 && <p className="font-semibold text-cacao-suave">{facts.join(' · ')}</p>}
        <p className="max-w-64 text-cacao-suave">Su historia, su carácter, su salud y con quién se lleva bien.</p>
        <ButtonLink to={`/gatitos/${cat.slug}`} size="lg">
          Ver su perfil completo
        </ButtonLink>
      </div>
    </div>
  );
}

/** Fotos y vídeos de una publicación, deslizables. Doble toque: «Me encanta». */
function PostMedia({ cat, eager, onDoubleTap }) {
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const reduceMotion = useReducedMotion();
  const slides = [
    ...cat.photos.map((photo) => ({ key: `foto-${photo.id}`, photo })),
    ...(cat.videos ?? []).map((video) => ({ key: `video-${video.id}`, video })),
  ];
  if (slides.length === 0) slides.push({ key: 'ilustracion', photo: null });
  // La última «foto» es una invitación a ver su perfil completo.
  slides.push({ key: 'perfil', profile: true });

  function onTap(event) {
    if (event.target.closest('video, a')) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setBurst((n) => n + 1);
      onDoubleTap();
    } else {
      lastTap.current = now;
    }
  }

  return (
    <div className="relative select-none" onClick={onTap}>
      <SwipeCarousel
        count={slides.length}
        label={`Fotos y vídeos de ${cat.name}`}
        onIndexChange={setIndex}
        className="aspect-[4/5] bg-cacao/5"
        renderSlide={(i) => {
          const { photo, video, profile } = slides[i];
          if (profile) return <ProfileSlide cat={cat} />;
          if (video) {
            return (
              <video
                src={video.url}
                poster={video.poster}
                controls
                playsInline
                preload="none"
                className="size-full bg-cacao object-contain"
                aria-label={`Vídeo de ${cat.name}`}
              />
            );
          }
          return (
            <CatPhoto
              cat={cat}
              photo={photo ?? undefined}
              eager={eager && i === 0}
              sizes="(min-width: 768px) 470px, 100vw"
              className="pointer-events-none size-full"
              alt={`${cat.name}, foto ${i + 1}`}
            />
          );
        }}
      />
      {slides.length > 1 && (
        <span className="absolute right-3 top-3 rounded-full bg-cacao/70 px-2.5 py-1 text-xs font-bold text-white" aria-hidden>
          {index + 1}/{slides.length}
        </span>
      )}
      <AnimatePresence>
        {burst > 0 && !reduceMotion && (
          <motion.span
            key={burst}
            className="pointer-events-none absolute inset-0 grid place-items-center text-white drop-shadow-lg"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1.15, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.45 }}
            onAnimationComplete={() => setTimeout(() => setBurst(0), 250)}
            aria-hidden
          >
            <Heart className="size-28" fill="currentColor" strokeWidth={1.2} />
          </motion.span>
        )}
      </AnimatePresence>
      {slides.length > 1 && (
        <div className="mt-2 flex justify-center gap-1" aria-hidden>
          {slides.map(({ key }, i) => (
            <span key={key} className={cx('size-1.5 rounded-full', i === index ? 'bg-canela' : 'bg-borde')} />
          ))}
        </div>
      )}
    </div>
  );
}

function Post({ cat, whatsapp, eager }) {
  const { has, add, toggle } = useFavorites();
  const loved = has(cat.slug);
  const facts = [cat.sex === 'hembra' ? 'Hembra' : cat.sex === 'macho' ? 'Macho' : null, ageText(cat.birthDate)].filter(Boolean);
  const tags = hashtags(cat);
  return (
    <article id={`gato-${cat.slug}`} className="scroll-mt-20 border-b border-borde pb-5 md:rounded-[2rem] md:border md:bg-nata md:shadow-suave" aria-label={`Publicación de ${cat.name}`} data-testid="post">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to={`/gatitos/${cat.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar cat={cat} />
          <span className="min-w-0">
            <span className="block truncate font-bold leading-tight">{handle(cat)}</span>
            <span className="flex items-center gap-1 truncate text-sm text-cacao-suave">
              {cat.location ? (
                <>
                  <MapPin className="size-3.5 shrink-0" aria-hidden /> {cat.location}
                </>
              ) : (
                facts.join(' · ')
              )}
            </span>
          </span>
        </Link>
      </header>
      <PostMedia cat={cat} eager={eager} onDoubleTap={() => add(cat.slug)} />
      <div className="flex items-center gap-1 px-2 pt-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.8 }}
          onClick={() => toggle(cat.slug)}
          aria-pressed={loved}
          aria-label={loved ? `Quitar a ${cat.name} de favoritos` : `Me encanta ${cat.name}`}
          className={cx('grid size-12 place-items-center rounded-full', loved ? 'text-canela' : 'text-cacao')}
        >
          <Heart className="size-7" fill={loved ? 'currentColor' : 'none'} strokeWidth={2.2} />
        </motion.button>
        {whatsapp && (
          <a
            href={whatsappUrl(whatsapp, `¡Hola! Tengo una pregunta sobre ${cat.name} 🐾`)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Preguntar por ${cat.name} por WhatsApp`}
            className="grid size-12 place-items-center rounded-full text-cacao"
          >
            <MessageCircle className="size-7" strokeWidth={2.2} />
          </a>
        )}
        <ShareButton
          title={cat.name}
          text={`¡Mira a ${cat.name} en el Miaustagram de Bigotes! 🐾`}
          path={`/gatitos/${cat.slug}`}
          label={`Compartir a ${cat.name}`}
          className="grid size-12 place-items-center rounded-full text-cacao"
        />
        <ButtonLink to={`/adoptar?gatito=${cat.slug}`} size="sm" className="ml-auto mr-2">
          <PawPrint className="size-4" /> Quiero adoptar{objectPronoun(cat.sex)}
        </ButtonLink>
      </div>
      <div className="grid gap-1 px-4 pt-1">
        <p className="leading-snug">
          <Link to={`/gatitos/${cat.slug}`} className="font-bold">
            {cat.name}
          </Link>{' '}
          {cat.summary || facts.join(' · ')}
        </p>
        {tags.length > 0 && <p className="font-semibold text-canela-oscuro">{tags.join(' ')}</p>}
      </div>
    </article>
  );
}

function StoriesBar({ cats, seen, onOpen }) {
  if (cats.length === 0) return null;
  return (
    <ul className="no-scrollbar -mx-4 mb-2 flex gap-3 overflow-x-auto px-4 pb-2" aria-label="Historias">
      {cats.map((cat, i) => (
        <li key={cat.slug}>
          <button type="button" onClick={() => onOpen(i)} className="flex w-18 flex-col items-center gap-1" aria-label={`Ver la historia de ${cat.name}`}>
            <Avatar cat={cat} size="size-16" ring seen={seen.has(cat.slug)} />
            <span className="w-full truncate text-center text-xs font-semibold">{cat.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Miaustagram() {
  useTitle('Miaustagram');
  const { data, error, loading, reload } = useApi('/gatitos');
  const site = useSite();
  const whatsapp = site.data?.content?.contact?.whatsapp;
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [story, setStory] = useState(null);
  const closeStory = useCallback(() => setStory(null), []);
  const [seen, markSeen] = useSeenStories();
  const { hash } = useLocation();

  const posts = feedPosts(data?.cats ?? [], { filters });
  const stories = storyCats(posts);
  const filterCount = activeFilterCount(filters);

  // Desde la portada se llega con #gato-luna: se baja hasta su publicación.
  const loaded = Boolean(data);
  useEffect(() => {
    if (!loaded || !hash) return;
    requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' }));
  }, [loaded, hash]);

  let body;
  if (loading) body = <Spinner label="Cargando el Miaustagram…" />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (posts.length === 0) {
    body =
      filterCount > 0 ? (
        <EmptyState
          title="Ningún gatito con esos filtros"
          tone="lavanda"
          action={
            <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
              Quitar filtros
            </Button>
          }
        >
          Prueba a cambiar los filtros.
        </EmptyState>
      ) : (
        <EmptyState title="¡Todos tienen casa!" tone="menta">
          Ahora mismo no hay gatitos disponibles. ¡Vuelve pronto!
        </EmptyState>
      );
  } else {
    body = (
      <>
        <StoriesBar cats={stories} seen={seen} onOpen={setStory} />
        <div className="-mx-4 grid gap-5 md:mx-0 md:gap-8">
          {posts.map((cat, i) => (
            <Post key={cat.slug} cat={cat} whatsapp={whatsapp} eager={i < 2} />
          ))}
        </div>
        <p className="py-8 text-center text-cacao-suave">
          ¡Ya los has visto a todos! 🐾{' '}
          <Link to="/favoritos" className="font-bold underline">
            Ver mis favoritos
          </Link>
        </p>
      </>
    );
  }

  return (
    <div className="px-4 pt-4 md:pt-8">
      <div className="mx-auto max-w-[470px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">Miaustagram</h1>
            <p className="text-sm text-cacao-suave">Doble toque en la foto: «Me encanta» 💕</p>
          </div>
          <Chip selected={filterCount > 0} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
            <SlidersHorizontal className="size-4" /> Filtros{filterCount > 0 && ` (${filterCount})`}
          </Chip>
        </div>
        {body}
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="¿Qué gatito buscas?">
        <FiltersPanel filters={filters} onChange={setFilters} />
        <Button block size="lg" className="mt-6" onClick={() => setFiltersOpen(false)}>
          Ver {posts.length === 1 ? '1 gatito' : `${posts.length} gatitos`}
        </Button>
      </Sheet>
      {story !== null && <StoryViewer cats={stories} start={story} onClose={closeStory} onSeen={markSeen} />}
    </div>
  );
}
