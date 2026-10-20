import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FileSignature, Phone, Search } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { Button, EmptyState, ErrorState, Spinner } from '../components/ui.jsx';
import { adopterProvinces, adoptionYears, EMPTY_ADOPTED_FILTERS, filterAdopted } from '../lib/adopted.js';
import { AdminPage, shortDate, useAdminApi } from './common.jsx';

// Adoptados: cada gatito que ya tiene casa con quien lo adoptó, su contrato y
// cómo contactar (para el seguimiento). Se filtra por año, zona, sexo y si
// tiene adoptante apuntado en el panel.

const pill = 'inline-flex min-h-10 items-center gap-1.5 rounded-full bg-crema px-3 text-sm font-bold';

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-bold text-cacao-suave">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full min-w-0 rounded-2xl border-2 border-borde bg-nata px-3 font-bold text-cacao focus:border-canela focus:outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdoptedItem({ cat }) {
  const a = cat.adopter;
  return (
    <li className="grid gap-3 rounded-3xl bg-nata p-3 shadow-suave">
      <Link to={`/admin/gatitos/${cat.id}`} className="flex items-center gap-3">
        <CatPhoto cat={cat} photo={cat.photo ?? undefined} sizes="64px" className="size-16 shrink-0 rounded-2xl" alt="" />
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-semibold">{cat.name}</span>
          <span className="block truncate text-sm text-cacao-suave">
            {[cat.fileNumber && `N.º ${cat.fileNumber}`, cat.adoptedAt && `Adoptad${cat.sex === 'hembra' ? 'a' : 'o'} el ${shortDate(cat.adoptedAt)}`]
              .filter(Boolean)
              .join(' · ') || 'Sin fecha de adopción'}
          </span>
        </span>
      </Link>
      {a ? (
        <div className="grid gap-2 rounded-2xl bg-crema/60 p-3">
          <div>
            <p className="font-bold">{a.name}</p>
            <p className="text-sm text-cacao-suave">
              {[a.municipality, a.province && `(${a.province})`].filter(Boolean).join(' ')}
              {a.contractNumber && ` · Contrato ${a.contractNumber}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.phone && (
              <>
                <a href={`tel:${a.phone.replace(/\s/g, '')}`} className={pill}>
                  <Phone className="size-4" /> Llamar
                </a>
                <a
                  href={whatsappUrl(a.phone, `¡Hola, ${a.name.split(' ')[0]}! Somos Bigotes. ¿Qué tal está ${cat.name}? 🐾`)}
                  target="_blank"
                  rel="noreferrer"
                  className={pill}
                >
                  <WhatsAppIcon /> WhatsApp
                </a>
              </>
            )}
            <Link to={`/admin/solicitudes/${a.applicationId}`} className={pill}>
              {a.contractNumber ? <FileSignature className="size-4" /> : <ClipboardList className="size-4" />} Solicitud
            </Link>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-mantequilla/60 p-3 text-sm">
          Sin adoptante en el panel: se marcó como adoptad{cat.sex === 'hembra' ? 'a' : 'o'} sin una solicitud.
        </p>
      )}
    </li>
  );
}

export default function Adopted() {
  const { data, error, loading, reload } = useAdminApi('/adoptados');
  const [filters, setFilters] = useState(EMPTY_ADOPTED_FILTERS);
  const cats = useMemo(() => data?.cats ?? [], [data]);
  const visible = useMemo(() => filterAdopted(cats, filters), [cats, filters]);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_ADOPTED_FILTERS);

  return (
    <AdminPage title="Adoptados" subtitle="Gatitos con casa y quién los adoptó">
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && cats.length === 0 && (
        <EmptyState title="Aún no hay adopciones" tone="menta">
          Cuando una solicitud llegue a «Adoptado», el gatito y su familia aparecerán aquí.
        </EmptyState>
      )}
      {cats.length > 0 && (
        <>
          <label className="relative mb-3 block">
            <span className="sr-only">Buscar por gatito, adoptante, teléfono o contrato</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-cacao-suave" aria-hidden />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => set('query')(event.target.value)}
              placeholder="Gatito, adoptante, teléfono, contrato…"
              className="w-full rounded-full border-2 border-borde bg-nata py-3 pl-12 pr-4 focus:border-canela focus:outline-none"
            />
          </label>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <FilterSelect label="Año" value={filters.year} onChange={set('year')} options={[['todos', 'Todos'], ...adoptionYears(cats).map((y) => [y, y])]} />
            <FilterSelect
              label="Zona"
              value={filters.zone}
              onChange={set('zone')}
              options={[
                ['todas', 'Todas'],
                ['extremadura', 'Extremadura'],
                ['fuera', 'Fuera de Extremadura'],
                ...adopterProvinces(cats).map((p) => [p, p]),
              ]}
            />
            <FilterSelect
              label="Sexo"
              value={filters.sex}
              onChange={set('sex')}
              options={[
                ['todos', 'Todos'],
                ['hembra', 'Hembras'],
                ['macho', 'Machos'],
              ]}
            />
            <FilterSelect
              label="Adoptante"
              value={filters.adopter}
              onChange={set('adopter')}
              options={[
                ['todos', 'Todos'],
                ['con', 'Con adoptante'],
                ['sin', 'Sin adoptante'],
              ]}
            />
          </div>
          <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
            <p className="font-bold text-cacao-suave" aria-live="polite">
              {visible.length === 1 ? '1 adoptado' : `${visible.length} adoptados`}
              {filtered && ` de ${cats.length}`}
            </p>
            {filtered && (
              <Button size="sm" variant="secondary" onClick={() => setFilters(EMPTY_ADOPTED_FILTERS)}>
                Quitar filtros
              </Button>
            )}
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((cat) => (
              <AdoptedItem key={cat.id} cat={cat} />
            ))}
          </ul>
        </>
      )}
    </AdminPage>
  );
}
