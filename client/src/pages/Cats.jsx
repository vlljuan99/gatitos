import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { CatGrid } from '../components/CatCard.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Button, ButtonLink, Chip, EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';
import { AGE_GROUPS } from '../lib/cats.js';
import { activeFilterCount, EMPTY_FILTERS, matchesFilters } from '../lib/deck.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

export function FiltersPanel({ filters, onChange }) {
  const toggleAge = (value) =>
    onChange({
      ...filters,
      ages: filters.ages.includes(value) ? filters.ages.filter((a) => a !== value) : [...filters.ages, value],
    });
  return (
    <div className="grid gap-6">
      <fieldset>
        <legend className="mb-2 font-bold">Edad</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((group) => (
            <Chip key={group.value} selected={filters.ages.includes(group.value)} onClick={() => toggleAge(group.value)}>
              {group.label} <span className="font-normal opacity-80">· {group.hint}</span>
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-bold">Sexo</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ['todos', 'Da igual'],
            ['hembra', 'Hembra'],
            ['macho', 'Macho'],
          ].map(([value, label]) => (
            <Chip key={value} selected={filters.sex === value} onClick={() => onChange({ ...filters, sex: value })}>
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-bold">Se lleva bien con…</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ['kids', '👶 Niños'],
            ['cats', '🐈 Otros gatos'],
            ['dogs', '🐕 Perros'],
          ].map(([key, label]) => (
            <Chip key={key} selected={filters[key]} onClick={() => onChange({ ...filters, [key]: !filters[key] })}>
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function Cats() {
  useTitle('Gatitos en adopción');
  const { data, error, loading, reload } = useApi('/gatitos');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);

  const cats = useMemo(() => (data?.cats ?? []).filter((cat) => matchesFilters(cat, filters)), [data, filters]);

  return (
    <>
      <PageHeader title="Gatitos en adopción" emoji="🐾">
        {data ? `${data.cats.length} gatitos buscan un hogar para siempre.` : 'Conoce a quienes buscan familia.'}
      </PageHeader>

      <div className="sticky top-14 z-20 bg-crema/95 py-2 backdrop-blur md:top-16">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          <Chip selected={count > 0} onClick={() => setOpen(true)} aria-haspopup="dialog">
            <SlidersHorizontal className="size-4" /> Filtros{count > 0 && ` (${count})`}
          </Chip>
          {AGE_GROUPS.map((group) => (
            <Chip
              key={group.value}
              selected={filters.ages.includes(group.value)}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  ages: f.ages.includes(group.value) ? f.ages.filter((a) => a !== group.value) : [...f.ages, group.value],
                }))
              }
            >
              {group.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        {loading && <Spinner label="Buscando gatitos…" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && cats.length > 0 && <CatGrid cats={cats} />}
        {data && data.cats.length === 0 && (
          <EmptyState title="¡Todos tienen casa!" tone="menta">
            Ahora mismo no hay gatitos en adopción. Vuelve pronto: siempre llega alguno nuevo.
          </EmptyState>
        )}
        {data && data.cats.length > 0 && cats.length === 0 && (
          <EmptyState title="Ningún gatito con esos filtros" action={<Button onClick={() => setFilters(EMPTY_FILTERS)}>Quitar filtros</Button>}>
            Prueba a quitar alguno: ¡a lo mejor te sorprende quien aparece!
          </EmptyState>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtros">
        <FiltersPanel filters={filters} onChange={setFilters} />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpiar
          </Button>
          <Button onClick={() => setOpen(false)}>Ver {cats.length} gatitos</Button>
        </div>
      </Sheet>

      {data && cats.length > 0 && (
        <div className="px-4 pt-8 text-center">
          <p className="text-cacao-suave">¿No sabes por dónde empezar?</p>
          <ButtonLink to="/match" variant="soft" className="mt-2">
            Prueba el modo match ✨
          </ButtonLink>
        </div>
      )}
    </>
  );
}
