import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Info, Play, SlidersHorizontal } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Button, ButtonLink, Chip, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { FiltersPanel } from './Cats.jsx';
import { ageText, gendered, objectPronoun } from '../lib/cats.js';
import { activeFilterCount, bookPages, EMPTY_FILTERS } from '../lib/book.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

// Libro de gatos: una página por gatito disponible, que se pasa deslizando
// con el dedo (carrusel con scroll-snap del navegador) o con las flechas.
// Cada página lleva su foto, lo esencial y «Quiero adoptarle», que abre la
// solicitud con ese gatito ya elegido.

const PLACE_KEY = 'bigotes:libro';

function rememberPlace(slug) {
  try {
    globalThis.sessionStorage?.setItem(PLACE_KEY, slug);
  } catch {
    // Sin almacenamiento: se empieza por la primera página.
  }
}

function savedPlace() {
  try {
    return globalThis.sessionStorage?.getItem(PLACE_KEY);
  } catch {
    return null;
  }
}

function BookPage({ cat, index, total, eager }) {
  const tags = cat.personality.slice(0, 3);
  const facts = [cat.sex === 'hembra' ? 'Hembra' : cat.sex === 'macho' ? 'Macho' : null, ageText(cat.birthDate)].filter(Boolean);
  return (
    <article
      className="w-full shrink-0 snap-center snap-always px-1"
      aria-roledescription="página"
      aria-label={`${cat.name}, ${index + 1} de ${total}`}
      data-testid="book-page"
    >
      <div className="overflow-hidden rounded-[2rem] bg-nata shadow-suave">
        <div className="relative">
          <CatPhoto
            cat={cat}
            eager={eager}
            sizes="(min-width: 768px) 420px, 92vw"
            className="h-[clamp(200px,calc(100dvh-35rem-var(--zona-segura)),440px)] w-full object-cover"
          />
          <FavoriteButton cat={cat} size="lg" className="absolute right-3 top-3" />
          {cat.videos?.length > 0 && (
            <Link
              to={`/gatitos/${cat.slug}?video`}
              className="absolute bottom-3 left-3 flex min-h-11 items-center gap-1.5 rounded-full bg-nata/95 px-4 font-bold text-cacao shadow-suave"
            >
              <Play className="size-4" fill="currentColor" aria-hidden /> Vídeo
            </Link>
          )}
        </div>
        <div className="grid gap-3 p-5">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-none">{cat.name}</h2>
            {facts.length > 0 && <p className="mt-1 font-semibold text-cacao-suave">{facts.join(' · ')}</p>}
          </div>
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag} className="rounded-full bg-canela-claro px-3 py-1 text-sm font-bold text-canela-oscuro">
                  {gendered(tag, cat.sex)}
                </li>
              ))}
            </ul>
          )}
          {cat.summary && <p className="line-clamp-3 leading-snug">{cat.summary}</p>}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <ButtonLink to={`/adoptar?gatito=${cat.slug}`} block>
              Quiero adoptar{objectPronoun(cat.sex)} 💕
            </ButtonLink>
            <ButtonLink to={`/gatitos/${cat.slug}`} variant="secondary" aria-label={`Conocer más a ${cat.name}`}>
              <Info className="size-5" /> Más
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}

function PageButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-12 place-items-center rounded-full bg-nata text-cacao shadow-suave transition active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export default function CatBook() {
  useTitle('Libro de gatos');
  const { data, error, loading, reload } = useApi('/gatitos');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const strip = useRef(null);

  const pages = useMemo(() => bookPages(data?.cats ?? [], { filters }), [data, filters]);
  const filterCount = activeFilterCount(filters);

  const goTo = useCallback((index, smooth = true) => {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Al volver al libro (p. ej. desde la ficha) se abre por la misma página.
  useEffect(() => {
    if (!pages.length) return;
    const index = pages.findIndex((cat) => cat.slug === savedPlace());
    setCurrent(Math.max(0, index));
    requestAnimationFrame(() => goTo(Math.max(0, index), false));
  }, [pages, goTo]);

  const onScroll = () => {
    const el = strip.current;
    if (!el?.clientWidth) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== current && pages[index]) {
      setCurrent(index);
      rememberPlace(pages[index].slug);
    }
  };

  useEffect(() => {
    function onKey(event) {
      if (filtersOpen || event.target.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowRight') goTo(Math.min(current + 1, pages.length - 1));
      if (event.key === 'ArrowLeft') goTo(Math.max(current - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, pages.length, filtersOpen, goTo]);

  let body;
  if (loading) body = <Spinner label="Abriendo el libro…" />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (pages.length === 0) {
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
        <div
          ref={strip}
          onScroll={onScroll}
          className="no-scrollbar -mx-1 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          aria-roledescription="carrusel"
          aria-label="Libro de gatos"
        >
          {pages.map((cat, i) => (
            <BookPage key={cat.slug} cat={cat} index={i} total={pages.length} eager={Math.abs(i - current) < 2} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <PageButton label="Página anterior" onClick={() => goTo(current - 1)} disabled={current === 0}>
            <ChevronLeft className="size-6" />
          </PageButton>
          <div className="grid justify-items-center gap-2">
            <p className="font-bold text-cacao-suave" aria-live="polite">
              {current + 1} de {pages.length}
            </p>
            {pages.length <= 12 && (
              <div className="flex gap-1.5" aria-hidden>
                {pages.map((cat, i) => (
                  <span key={cat.slug} className={cx('h-2 rounded-full transition-all', i === current ? 'w-5 bg-canela' : 'w-2 bg-borde')} />
                ))}
              </div>
            )}
          </div>
          <PageButton label="Página siguiente" onClick={() => goTo(current + 1)} disabled={current >= pages.length - 1}>
            <ChevronRight className="size-6" />
          </PageButton>
        </div>
      </>
    );
  }

  return (
    <div className="overflow-x-clip px-4 pt-4 md:pt-8">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight md:text-3xl">Libro de gatos</h1>
            <p className="text-sm text-cacao-suave">Pasa las páginas para conocerlos</p>
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
          Ver {pages.length === 1 ? '1 gatito' : `${pages.length} gatitos`}
        </Button>
      </Sheet>
    </div>
  );
}
