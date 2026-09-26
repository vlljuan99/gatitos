import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Star } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { useToast } from '../components/Toast.jsx';
import { ButtonLink, EmptyState, ErrorState, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { ageText, statusLabel } from '../lib/cats.js';
import { AdminPage, refreshAfterChange, Tabs, timeAgo, useAdminApi } from './common.jsx';

export const CAT_STATUSES = ['borrador', 'disponible', 'reservado', 'adoptado'];

const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Selector de estado en una píldora: cambiar a «Adoptado» es un toque. */
function QuickStatus({ cat, onChanged }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const tones = {
    borrador: 'bg-cacao/10 text-cacao-suave',
    disponible: 'bg-menta text-menta-oscuro',
    reservado: 'bg-mantequilla text-mantequilla-oscuro',
    adoptado: 'bg-lavanda text-lavanda-oscuro',
  };
  return (
    <select
      value={cat.status}
      disabled={saving}
      aria-label={`Estado de ${cat.name}`}
      onClick={(event) => event.stopPropagation()}
      onChange={async (event) => {
        setSaving(true);
        try {
          await api(`/admin/gatitos/${cat.id}/estado`, { method: 'PATCH', body: { status: event.target.value } });
          toast(`${cat.name}: ${statusLabel(event.target.value, cat.sex).toLowerCase()}`);
          refreshAfterChange();
          onChanged();
        } catch (error) {
          toast(error.message, { tone: 'error' });
        } finally {
          setSaving(false);
        }
      }}
      className={`min-h-9 appearance-none rounded-full border-0 px-3 text-sm font-bold ${tones[cat.status]}`}
    >
      {CAT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {statusLabel(status, cat.sex)}
        </option>
      ))}
    </select>
  );
}

export default function CatsList() {
  const [params, setParams] = useSearchParams();
  const status = params.get('estado') ?? 'todos';
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useAdminApi('/gatitos');
  const cats = data?.cats ?? [];

  const counts = useMemo(() => Object.fromEntries(CAT_STATUSES.map((s) => [s, cats.filter((c) => c.status === s).length])), [cats]);
  const visible = cats.filter(
    (cat) => (status === 'todos' || cat.status === status) && (!query || normalize(cat.name).includes(normalize(query))),
  );

  return (
    <AdminPage
      title="Gatitos"
      action={
        <ButtonLink to="/admin/gatitos/nuevo" size="sm">
          <Plus className="size-4" /> Nuevo
        </ButtonLink>
      }
    >
      <label className="relative mb-3 block">
        <span className="sr-only">Buscar por nombre</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-cacao-suave" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre"
          className="w-full rounded-full border-2 border-borde bg-nata py-3 pl-12 pr-4 focus:border-fresa focus:outline-none"
        />
      </label>
      <Tabs
        value={status}
        onChange={(value) => setParams(value === 'todos' ? {} : { estado: value }, { replace: true })}
        tabs={[
          { value: 'todos', label: 'Todos' },
          { value: 'disponible', label: 'Disponibles', count: counts.disponible },
          { value: 'reservado', label: 'Reservados', count: counts.reservado },
          { value: 'adoptado', label: 'Adoptados', count: counts.adoptado },
          { value: 'borrador', label: 'Borradores', count: counts.borrador },
        ]}
      />
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && cats.length === 0 && (
        <EmptyState title="Aún no hay gatitos" action={<ButtonLink to="/admin/gatitos/nuevo">Subir el primero</ButtonLink>}>
          Sube el primer gatito: con unas fotos y su nombre ya se puede publicar.
        </EmptyState>
      )}
      {data && cats.length > 0 && visible.length === 0 && <p className="py-8 text-center text-cacao-suave">No hay gatitos aquí.</p>}
      <ul className="grid gap-2">
        {visible.map((cat) => (
          <li key={cat.id} className="flex items-center gap-3 rounded-3xl bg-nata p-2 pr-3 shadow-suave">
            <Link to={`/admin/gatitos/${cat.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <CatPhoto cat={cat} sizes="64px" className="size-16 shrink-0 rounded-2xl" alt="" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-display text-lg font-semibold">
                  <span className="truncate">{cat.name}</span>
                  {cat.featured && <Star className="size-4 shrink-0 text-mantequilla-oscuro" fill="currentColor" aria-label="Destacado" />}
                </span>
                <span className="block truncate text-sm text-cacao-suave">
                  {[ageText(cat.birthDate), cat.photos.length === 1 ? '1 foto' : `${cat.photos.length} fotos`, `${cat.likes} 💕`].filter(Boolean).join(' · ')}
                </span>
                <span className="block text-xs text-cacao-suave">Editado {timeAgo(cat.updatedAt)}</span>
              </span>
            </Link>
            <QuickStatus cat={cat} onChanged={reload} />
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
