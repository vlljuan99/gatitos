import { createContext, useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { Button, cx } from '../components/ui.jsx';
import { useApi, invalidate } from '../lib/useApi.js';

export const AuthContext = createContext({ user: null, setUser: () => {} });
export const useAuth = () => useContext(AuthContext);
export const isAdmin = (user) => user?.role === 'admin';

// Los dos papeles del equipo, con nombre gatuno (el servidor usa los mismos
// en server/src/auth.js). Las claves internas no cambian: admin y cuidabigotes.
export const ROLE_INFO = {
  admin: {
    label: 'Bigote mayor',
    emoji: '👑',
    can: 'Lo puede todo: además del día a día, da de alta al equipo, cambia los datos legales y puede borrar.',
  },
  cuidabigotes: {
    label: 'Cuidabigotes',
    emoji: '🐾',
    can: 'Lleva el día a día: gatitos, solicitudes, mensajes, voluntariado y textos de la web.',
  },
};

/** Lecturas del panel: siempre se refrescan al entrar, pero enseñan lo último que había mientras. */
export const useAdminApi = (path) => useApi(path ? `/admin${path}` : null, { maxAge: 0 });

/** Tras un cambio en el panel: refrescar el panel y lo que ve el público. */
export function refreshAfterChange() {
  invalidate('/admin');
  invalidate('/gatitos');
  invalidate('/finales-felices');
  invalidate('/sitio');
}

export function AdminPage({ title, back, action, children, subtitle }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-32 md:pb-12">
      {back && (
        <Link to={back} className="mb-2 inline-flex min-h-10 items-center gap-1 font-bold text-cacao-suave">
          <ArrowLeft className="size-5" /> Volver
        </Link>
      )}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-cacao-suave">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Pestañas en fila desplazable (estados, filtros). */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cx(
            'flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition',
            value === tab.value ? 'border-cacao bg-cacao text-white' : 'border-borde bg-nata',
          )}
        >
          {tab.label}
          {tab.count > 0 && (
            <span className={cx('rounded-full px-1.5 text-xs', value === tab.value ? 'bg-white/20' : 'bg-canela-claro text-canela-oscuro')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const STATUS_TONES = {
  borrador: 'bg-cacao/10 text-cacao-suave',
  disponible: 'bg-menta text-menta-oscuro',
  reservado: 'bg-mantequilla text-mantequilla-oscuro',
  adoptado: 'bg-lavanda text-lavanda-oscuro',
  nueva: 'bg-canela-claro text-canela-oscuro',
  nuevo: 'bg-canela-claro text-canela-oscuro',
  entrevista: 'bg-cielo text-cielo-oscuro',
  visita: 'bg-melocoton text-melocoton-oscuro',
  aprobada: 'bg-menta text-menta-oscuro',
  descartada: 'bg-cacao/10 text-cacao-suave',
  leido: 'bg-cielo text-cielo-oscuro',
  contactado: 'bg-menta text-menta-oscuro',
  archivado: 'bg-cacao/10 text-cacao-suave',
};

export function StatusPill({ status, children, className }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_TONES[status], className)}>
      {children}
    </span>
  );
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** «hace 2 días», «ayer», «hace 5 minutos». Las fechas de SQLite vienen en UTC. */
export function timeAgo(value, now = Date.now()) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  const seconds = Math.round((date.getTime() - now) / 1000);
  const steps = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'ahora mismo';
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value.includes('T') || value.length === 10 ? value : `${value.replace(' ', 'T')}Z`);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Confirmación en hoja inferior (más cómoda que window.confirm en el móvil). */
export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (options) => new Promise((resolve) => setState({ ...options, resolve }));
  const close = (value) => {
    state?.resolve(value);
    setState(null);
  };
  const dialog = (
    <Sheet open={Boolean(state)} onClose={() => close(null)} title={state?.title}>
      {state?.body && <p className="text-lg text-cacao-suave">{state.body}</p>}
      <div className="mt-6 grid gap-3">
        {(state?.options ?? [{ value: true, label: state?.confirmLabel ?? 'Sí' }]).map((option, i) => (
          <Button
            key={String(option.value)}
            size="lg"
            block
            variant={option.variant ?? (i === 0 ? (state?.danger ? 'danger' : 'primary') : 'secondary')}
            onClick={() => close(option.value)}
          >
            {option.label}
          </Button>
        ))}
        <Button variant="ghost" block onClick={() => close(null)}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
  return [ask, dialog];
}
