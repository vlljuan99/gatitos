import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Heart, MapPin, MessageCircle, PawPrint, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { useSite } from '../components/Layout.jsx';
import { whatsappUrl } from '../components/BrandIcons.jsx';
import { ShareButton } from '../components/ShareButton.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Button, ButtonLink, Chip, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { FiltersPanel } from './Cats.jsx';
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

const STORY_PHOTO_MS = 5000;

function Avatar({ cat, size = 'size-10', ring = false }) {
  return (
    <span className={cx('shrink-0 rounded-full', ring ? 'bg-gradient-to-tr from-mantequilla-oscuro via-canela to-lavanda-oscuro p-[3px]' : '')}>
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
  const scroller = useRef(null);
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

  function onScroll() {
    const el = scroller.current;
    if (!el?.clientWidth) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) {
      setIndex(next);
      el.querySelectorAll('video').forEach((video) => video.pause());
    }
  }

  return (
    <div className="relative select-none" onClick={onTap}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto bg-cacao/5"
        aria-roledescription="carrusel"
        aria-label={`Fotos y vídeos de ${cat.name}`}
      >
        {slides.map(({ key, photo, video, profile }, i) => (
          <div key={key} className="h-full w-full shrink-0 snap-center">
            {profile ? (
              <ProfileSlide cat={cat} />
            ) : video ? (
              <video
                src={video.url}
                poster={video.poster}
                controls
                playsInline
                preload="none"
                className="size-full bg-cacao object-contain"
                aria-label={`Vídeo de ${cat.name}`}
              />
            ) : (
              <CatPhoto
                cat={cat}
                photo={photo ?? undefined}
                eager={eager && i === 0}
                sizes="(min-width: 768px) 470px, 100vw"
                className="size-full"
                alt={`${cat.name}, foto ${i + 1}`}
              />
            )}
          </div>
        ))}
      </div>
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

function StoriesBar({ cats, onOpen }) {
  if (cats.length === 0) return null;
  return (
    <ul className="no-scrollbar -mx-4 mb-2 flex gap-3 overflow-x-auto px-4 pb-2" aria-label="Historias">
      {cats.map((cat, i) => (
        <li key={cat.slug}>
          <button type="button" onClick={() => onOpen(i)} className="flex w-18 flex-col items-center gap-1" aria-label={`Ver la historia de ${cat.name}`}>
            <Avatar cat={cat} size="size-16" ring />
            <span className="w-full truncate text-center text-xs font-semibold">{cat.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Historias a pantalla completa: vídeo (o foto 5 s), tocar a los lados para pasar. */
function StoryViewer({ cats, start, onClose }) {
  const [index, setIndex] = useState(start);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const video = useRef(null);
  const cat = cats[index];
  const clip = cat?.videos?.[0];

  const next = useCallback(() => {
    setProgress(0);
    setIndex((i) => {
      if (i + 1 >= cats.length) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [cats.length, onClose]);
  const prev = () => {
    setProgress(0);
    setIndex((i) => Math.max(0, i - 1));
  };

  // Las fotos duran 5 s; los vídeos, lo que duren.
  useEffect(() => {
    if (clip) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const p = (Date.now() - started) / STORY_PHOTO_MS;
      if (p >= 1) next();
      else setProgress(p);
    }, 50);
    return () => clearInterval(timer);
  }, [index, clip, next]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, onClose]);

  if (!cat) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-cacao text-white" role="dialog" aria-modal="true" aria-label={`Historia de ${cat.name}`}>
      <div className="relative mx-auto flex h-dvh max-w-md flex-col">
        {/* Degradado para que se lean el nombre y el progreso sobre fotos claras. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-cacao/70 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-3" aria-hidden>
          {cats.map((c, i) => (
            <span key={c.slug} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35">
              <span className="block h-full bg-white" style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-0 top-5 z-10 flex items-center gap-3 px-3 pt-2">
          <Avatar cat={cat} size="size-9" />
          <span className="flex-1 font-bold drop-shadow">{handle(cat)}</span>
          {clip && (
            <button type="button" onClick={() => setMuted((m) => !m)} className="grid size-11 place-items-center rounded-full" aria-label={muted ? 'Activar el sonido' : 'Quitar el sonido'}>
              {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
            </button>
          )}
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full" aria-label="Cerrar">
            <X className="size-7" />
          </button>
        </div>

        <div className="relative flex-1">
          {clip ? (
            <video
              key={clip.id}
              ref={video}
              src={clip.url}
              poster={clip.poster}
              autoPlay
              muted={muted}
              playsInline
              onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime / (event.currentTarget.duration || 1))}
              onEnded={next}
              className="size-full object-contain"
              aria-label={`Vídeo de ${cat.name}`}
            />
          ) : (
            <CatPhoto cat={cat} eager sizes="100vw" className="size-full object-cover" alt={cat.name} />
          )}
          {/* Tocar a la izquierda: anterior; a la derecha: siguiente. */}
          <button type="button" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" aria-label="Historia anterior" />
          <button type="button" onClick={next} className="absolute inset-y-0 right-0 w-2/3" aria-label="Historia siguiente" />
        </div>

        <div className="grid gap-2 bg-gradient-to-t from-cacao via-cacao/90 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {cat.summary && <p className="line-clamp-2 text-[15px] leading-snug">{cat.summary}</p>}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <ButtonLink to={`/adoptar?gatito=${cat.slug}`} block onClick={onClose}>
              Quiero adoptar{objectPronoun(cat.sex)} 💕
            </ButtonLink>
            <ButtonLink to={`/gatitos/${cat.slug}`} variant="secondary" onClick={onClose}>
              Perfil
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
        <StoriesBar cats={stories} onOpen={setStory} />
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
      {story !== null && <StoryViewer cats={stories} start={story} onClose={closeStory} />}
    </div>
  );
}
