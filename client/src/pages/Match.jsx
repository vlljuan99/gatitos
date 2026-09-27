import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Heart, Info, PawPrint, Play, SlidersHorizontal, Undo2 } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, ButtonLink, Chip, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { FiltersPanel } from './Cats.jsx';
import { ageText, gendered, objectPronoun } from '../lib/cats.js';
import { activeFilterCount, buildDeck, EMPTY_FILTERS } from '../lib/deck.js';
import { favorites, useFavorites } from '../lib/favorites.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 650;

/** Una tarjeta del montón. Solo la de arriba se puede arrastrar. */
const SwipeCard = forwardRef(function SwipeCard({ cat, depth, enterFrom, onDecide }, ref) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(enterFrom === 'like' ? 600 : enterFrom === 'next' ? -600 : 0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const loveOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const nextOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const deciding = useRef(false);
  const top = depth === 0;

  useEffect(() => {
    // Al deshacer, la tarjeta vuelve desde el lado por el que se fue.
    if (enterFrom) animate(x, 0, { type: 'spring', stiffness: 320, damping: 30 });
  }, [enterFrom, x]);

  const fly = useCallback(
    async (decision) => {
      if (deciding.current) return;
      deciding.current = true;
      await animate(x, decision === 'like' ? 700 : -700, reduceMotion ? { duration: 0 } : { duration: 0.28, ease: 'easeIn' });
      onDecide(decision, cat.slug);
    },
    [x, onDecide, reduceMotion, cat.slug],
  );
  useImperativeHandle(ref, () => ({ fly }), [fly]);

  const tags = cat.personality.slice(0, 3);
  const hasVideo = top && cat.videos?.length > 0;
  return (
    <motion.div
      // Todas las tarjetas son arrastrables desde que se montan; las de debajo
      // no reciben toques hasta que llegan arriba.
      className={cx('absolute inset-0 touch-pan-y', !top && 'pointer-events-none')}
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={false}
      animate={{ scale: 1 - depth * 0.05, y: depth * 14 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      drag="x"
      dragMomentum={false}
      onDragEnd={(event, info) => {
        if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) fly('like');
        else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) fly('next');
        else animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }}
      aria-hidden={!top}
      data-testid={top ? 'match-card' : undefined}
    >
      <div className="relative size-full select-none overflow-hidden rounded-[2rem] bg-nata shadow-flotante">
        <CatPhoto
          cat={cat}
          eager={depth < 2}
          sizes="(min-width: 768px) 420px, 92vw"
          className="pointer-events-none size-full"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cacao/90 via-cacao/55 to-transparent p-5 pt-24 text-white">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-4xl font-semibold leading-none">{cat.name}</h2>
              <p className="mt-1 font-semibold opacity-90">
                {[cat.sex === 'hembra' ? 'Hembra' : cat.sex === 'macho' ? 'Macho' : null, ageText(cat.birthDate)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {top && (
              <Link
                to={`/gatitos/${cat.slug}`}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur"
                aria-label={`Ver la ficha de ${cat.name}`}
              >
                <Info className="size-5" />
              </Link>
            )}
          </div>
          {(tags.length > 0 || hasVideo) && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {hasVideo && (
                <li>
                  <Link
                    to={`/gatitos/${cat.slug}?video`}
                    className="flex items-center gap-1 rounded-full bg-nata px-3 py-1 text-sm font-bold text-cacao"
                    aria-label={`Ver el vídeo de ${cat.name}`}
                  >
                    <Play className="size-3.5" fill="currentColor" aria-hidden /> Vídeo
                  </Link>
                </li>
              )}
              {tags.map((tag) => (
                <li key={tag} className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">
                  {gendered(tag, cat.sex)}
                </li>
              ))}
            </ul>
          )}
          {cat.summary && <p className="mt-3 line-clamp-2 text-[15px] leading-snug opacity-95">{cat.summary}</p>}
        </div>
        {top && (
          <>
            <motion.div
              style={{ opacity: loveOpacity }}
              className="absolute left-5 top-6 -rotate-12 rounded-2xl border-4 border-canela bg-nata/85 px-3 py-1 font-display text-2xl font-bold text-canela"
              aria-hidden
            >
              ¡ME ENCANTA!
            </motion.div>
            <motion.div
              style={{ opacity: nextOpacity }}
              className="absolute right-5 top-6 rotate-12 rounded-2xl border-4 border-cielo-oscuro bg-nata/85 px-3 py-1 font-display text-2xl font-bold text-cielo-oscuro"
              aria-hidden
            >
              SIGUIENTE
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
});

function FloatingHearts() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[...Array(8)].map((_, i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 text-2xl"
          style={{ left: `${8 + i * 11}%` }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: -260, opacity: [0, 1, 0] }}
          transition={{ duration: 2.2, delay: i * 0.12, ease: 'easeOut' }}
        >
          {i % 2 ? '💕' : '🐾'}
        </motion.span>
      ))}
    </div>
  );
}

function MatchSheet({ cat, onClose }) {
  return (
    <Sheet open={Boolean(cat)} onClose={onClose} title="¡Es un match! 💕">
      {cat && (
        <div className="relative text-center">
          <FloatingHearts />
          <motion.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="relative mx-auto size-40"
          >
            <CatPhoto cat={cat} sizes="160px" eager className="size-40 rounded-full border-4 border-nata shadow-flotante" />
            <span className="absolute -bottom-1 -right-1 grid size-14 place-items-center rounded-full bg-canela text-white shadow-suave">
              <Heart className="size-7" fill="currentColor" />
            </span>
          </motion.div>
          <h2 className="mt-5 font-display text-3xl font-semibold">¡Os habéis gustado!</h2>
          <p className="mx-auto mt-2 max-w-xs text-lg text-cacao-suave">
            {cat.name} ya está en tus favoritos. ¿Te apetece dar el siguiente paso y conocer{objectPronoun(cat.sex)}?
          </p>
          <div className="relative mt-6 grid gap-3">
            <ButtonLink to={`/adoptar?gatito=${cat.slug}`} size="lg" block>
              Quiero conocer{objectPronoun(cat.sex)} 💕
            </ButtonLink>
            <Button variant="secondary" size="lg" block onClick={onClose}>
              Seguir mirando
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function RoundButton({ label, onClick, disabled, className, children, size = 'lg', to }) {
  const classes = cx(
    'grid place-items-center rounded-full shadow-suave transition disabled:opacity-40',
    size === 'lg' ? 'size-18' : 'size-12',
    className,
  );
  return (
    <div className="flex flex-col items-center gap-1.5">
      {to ? (
        <Link to={to} aria-label={label} className={classes}>
          {children}
        </Link>
      ) : (
        <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={onClick} disabled={disabled} aria-label={label} className={classes}>
          {children}
        </motion.button>
      )}
      <span className="text-xs font-bold text-cacao-suave" aria-hidden>
        {label}
      </span>
    </div>
  );
}

export default function Match() {
  useTitle('Encuentra tu match gatuno');
  const { data, error, loading, reload } = useApi('/gatitos');
  const { slugs: favoriteSlugs, add, remove } = useFavorites();
  const toast = useToast();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deck, setDeck] = useState(null);
  const [history, setHistory] = useState([]);
  const [entering, setEntering] = useState(null);
  const [match, setMatch] = useState(null);
  const matchedOnce = useRef(false);
  const topCard = useRef(null);

  const bySlug = useMemo(() => new Map((data?.cats ?? []).map((cat) => [cat.slug, cat])), [data]);

  const shuffle = useCallback(
    (nextFilters) => {
      setDeck(buildDeck(data?.cats ?? [], { filters: nextFilters, exclude: favorites.get() }));
      setHistory([]);
      setEntering(null);
    },
    [data],
  );

  // La baraja se hace una vez al llegar los datos; después solo al cambiar filtros
  // o al volver a empezar, para que no se reordene mientras se desliza.
  useEffect(() => {
    if (data && deck === null) shuffle(filters);
  }, [data, deck, filters, shuffle]);

  const decide = useCallback(
    (decision, slug) => {
      setDeck((current) => current.filter((s) => s !== slug));
      setHistory((h) => [...h, { slug, decision }]);
      setEntering(null);
      if (decision !== 'like') return;
      const cat = bySlug.get(slug);
      add(slug);
      if (!matchedOnce.current) {
        matchedOnce.current = true;
        setMatch(cat);
      } else {
        toast(`${cat.name}, ${gendered('guardado', cat.sex)} en favoritos 💕`, {
          action: (
            <Link to="/favoritos" className="underline">
              Ver
            </Link>
          ),
        });
      }
    },
    [add, bySlug, toast],
  );

  const undo = useCallback(() => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    if (last.decision === 'like') remove(last.slug);
    setEntering({ slug: last.slug, from: last.decision });
    setDeck((current) => [last.slug, ...current]);
  }, [history, remove]);

  useEffect(() => {
    function onKey(event) {
      if (match || filtersOpen || event.target.closest?.('input, textarea')) return;
      if (event.key === 'ArrowRight') topCard.current?.fly('like');
      if (event.key === 'ArrowLeft') topCard.current?.fly('next');
      if (event.key === 'Backspace') undo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [match, filtersOpen, undo]);

  const filterCount = activeFilterCount(filters);
  const visible = (deck ?? []).slice(0, 3);
  const current = visible[0] && bySlug.get(visible[0]);
  const availableCount = (data?.cats ?? []).filter((cat) => cat.status === 'disponible').length;

  let body;
  if (loading) body = <Spinner label="Preparando gatitos…" />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (availableCount === 0) {
    body = (
      <EmptyState title="¡Todos tienen casa!" tone="menta">
        Ahora mismo no hay gatitos disponibles. ¡Vuelve pronto!
      </EmptyState>
    );
  } else if (deck && deck.length === 0) {
    const matching = buildDeck(data.cats, { filters });
    const allLoved = matching.length > 0 && matching.every((slug) => favoriteSlugs.includes(slug));
    body = (
      <EmptyState
        title={history.length ? '¡Los has visto a todos!' : allLoved ? '¡Ya te encantan todos! 😻' : 'Ningún gatito con esos filtros'}
        tone="lavanda"
        action={
          <div className="grid gap-3">
            {favoriteSlugs.length > 0 && <ButtonLink to="/favoritos">Ver mis favoritos ({favoriteSlugs.length})</ButtonLink>}
            {filterCount > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  shuffle(EMPTY_FILTERS);
                }}
              >
                Quitar filtros
              </Button>
            )}
            {history.length > 0 && (
              <Button variant="secondary" onClick={() => shuffle(filters)}>
                Volver a empezar
              </Button>
            )}
          </div>
        }
      >
        {history.length ? 'Los que te han encantado te esperan en favoritos.' : 'Prueba a cambiar los filtros.'}
      </EmptyState>
    );
  } else if (deck) {
    body = (
      <>
        {/* La tarjeta ocupa el alto que queda libre entre cabecera, botones y
            barra inferior (que en el iPhone crece con la zona segura). */}
        <div className="relative mx-auto h-[clamp(260px,calc(100dvh-23rem-var(--zona-segura)),560px)] w-full max-w-sm md:h-[clamp(320px,calc(100dvh-20rem),600px)]">
          {visible
            .map((slug, depth) => (
              <SwipeCard
                key={slug}
                ref={depth === 0 ? topCard : undefined}
                cat={bySlug.get(slug)}
                depth={depth}
                enterFrom={entering?.slug === slug ? entering.from : null}
                onDecide={decide}
              />
            ))
            .reverse()}
        </div>
        <div className="mx-auto mt-7 flex max-w-sm items-start justify-center gap-5">
          <RoundButton label="Deshacer" size="sm" onClick={undo} disabled={history.length === 0} className="mt-3 bg-nata text-cacao-suave">
            <Undo2 className="size-5" />
          </RoundButton>
          <RoundButton label="Siguiente" onClick={() => topCard.current?.fly('next')} className="bg-nata text-cielo-oscuro">
            <PawPrint className="size-8" />
          </RoundButton>
          <RoundButton label="Me encanta" onClick={() => topCard.current?.fly('like')} className="bg-canela text-white">
            <Heart className="size-8" fill="currentColor" />
          </RoundButton>
          <RoundButton label="Ver ficha" size="sm" className="mt-3 bg-nata text-cacao-suave" to={current ? `/gatitos/${current.slug}` : '/gatitos'}>
            <Info className="size-5" />
          </RoundButton>
        </div>
      </>
    );
  }

  return (
    <div className="overflow-x-clip px-4 pt-4 md:pt-8">
      <div className="mx-auto mb-4 flex max-w-sm items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">Encuentra tu match</h1>
          <p className="text-sm text-cacao-suave">Desliza: → me encanta · ← siguiente</p>
        </div>
        <Chip selected={filterCount > 0} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
          <SlidersHorizontal className="size-4" /> Filtros{filterCount > 0 && ` (${filterCount})`}
        </Chip>
      </div>
      {body}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="¿Qué gatito buscas?">
        <FiltersPanel filters={filters} onChange={setFilters} />
        <Button
          block
          size="lg"
          className="mt-6"
          onClick={() => {
            shuffle(filters);
            setFiltersOpen(false);
          }}
        >
          Aplicar filtros
        </Button>
      </Sheet>
      <MatchSheet cat={match} onClose={() => setMatch(null)} />
    </div>
  );
}
