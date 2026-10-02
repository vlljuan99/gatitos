import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, MessageSquareText } from 'lucide-react';
import { EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { AdminPage, StatusPill, Tabs, timeAgo, useAdminApi } from './common.jsx';

export const APPLICATION_STATUSES = [
  { value: 'nueva', label: 'Nuevas', single: 'Nueva' },
  { value: 'entrevista', label: 'Entrevista', single: 'Entrevista' },
  { value: 'visita', label: 'Visita', single: 'Visita' },
  { value: 'aprobada', label: 'Aprobadas', single: 'Aprobada' },
  { value: 'adoptado', label: 'Adoptados', single: 'Adoptado' },
  { value: 'descartada', label: 'Descartadas', single: 'Descartada' },
];

export default function Applications() {
  const [params, setParams] = useSearchParams();
  const status = params.get('estado') ?? 'nueva';
  const { data, error, loading, reload } = useAdminApi(`/solicitudes?estado=${status}`);

  return (
    <AdminPage title="Solicitudes" subtitle="Cada adopción pasa por estas etapas. Toca una solicitud para verla entera.">
      <Tabs
        value={status}
        onChange={(value) => setParams({ estado: value }, { replace: true })}
        tabs={APPLICATION_STATUSES.map((s) => ({ ...s, count: s.value === 'adoptado' || s.value === 'descartada' ? 0 : data?.counts[s.value] }))}
      />
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.applications.length === 0 && (
        <EmptyState title="Nada por aquí" tone="menta">
          {status === 'nueva' ? 'No hay solicitudes nuevas. ¡Todo al día! 🎉' : 'No hay solicitudes en esta etapa.'}
        </EmptyState>
      )}
      <ul className="grid gap-2">
        {data?.applications.map((app) => (
          <li key={app.id}>
            <Link to={`/admin/solicitudes/${app.id}`} className="flex items-center gap-3 rounded-3xl bg-nata p-4 shadow-suave transition active:scale-[0.99]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-lg font-semibold">{app.name}</span>
                  {app.status === 'nueva' && <StatusPill status="nueva">Nueva</StatusPill>}
                </div>
                <p className="truncate text-sm text-cacao-suave">
                  {app.catName ? `Para ${app.catName}` : 'Sin gatito elegido'} · {app.municipality}
                </p>
                {app.outsideExtremadura && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full bg-mantequilla px-2 py-0.5 text-xs font-bold text-mantequilla-oscuro">📍 {app.province}</span>
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        app.transportCount ? 'bg-menta text-menta-oscuro' : 'bg-cacao/10 text-cacao-suave',
                      )}
                    >
                      🚗 {app.transportCount ? `${app.transportCount} viaja${app.transportCount === 1 ? '' : 'n'} allí` : 'Sin transporte aún'}
                    </span>
                  </p>
                )}
                <p className="flex items-center gap-2 text-xs text-cacao-suave">
                  {timeAgo(app.createdAt)}
                  {app.notesCount > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquareText className="size-3.5" aria-hidden /> {app.notesCount}
                    </span>
                  )}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-cacao-suave" />
            </Link>
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
