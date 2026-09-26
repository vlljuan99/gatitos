import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { CatIllustration } from './CatIllustration.jsx';

const cx = (...classes) => classes.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-canela text-white shadow-suave hover:bg-canela-oscuro active:scale-[0.98]',
  secondary: 'bg-nata text-cacao border-2 border-borde hover:border-canela-pastel active:scale-[0.98]',
  soft: 'bg-canela-claro text-canela-oscuro hover:bg-canela-pastel/50 active:scale-[0.98]',
  ghost: 'text-cacao hover:bg-cacao/5',
  danger: 'bg-nata text-canela-oscuro border-2 border-canela-claro hover:bg-canela-claro',
};
const SIZES = {
  sm: 'min-h-9 px-3.5 text-sm gap-1.5',
  md: 'min-h-12 px-5 text-base gap-2',
  lg: 'min-h-14 px-6 text-lg gap-2.5',
};

export function buttonClass({ variant = 'primary', size = 'md', block = false, className } = {}) {
  return cx(
    'inline-flex items-center justify-center rounded-full font-display font-medium transition',
    'disabled:opacity-50 disabled:pointer-events-none select-none',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
}

export function Button({ variant, size, block, className, loading, children, ...props }) {
  return (
    <button type="button" className={buttonClass({ variant, size, block, className })} disabled={loading || props.disabled} {...props}>
      {loading && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, block, className, children, ...props }) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...props}>
      {children}
    </Link>
  );
}

const TONE_CLASSES = {
  canela: 'bg-canela-claro text-canela-oscuro',
  lavanda: 'bg-lavanda text-lavanda-oscuro',
  menta: 'bg-menta text-menta-oscuro',
  mantequilla: 'bg-mantequilla text-mantequilla-oscuro',
  melocoton: 'bg-melocoton text-melocoton-oscuro',
  cielo: 'bg-cielo text-cielo-oscuro',
  neutro: 'bg-cacao/5 text-cacao-suave',
};
export const toneClass = (tone) => TONE_CLASSES[tone] ?? TONE_CLASSES.neutro;

export function Tag({ tone = 'canela', className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold', toneClass(tone), className)}>
      {children}
    </span>
  );
}

/** Píldora seleccionable (filtros, opciones de formulario). */
export function Chip({ selected, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition',
        selected
          ? 'border-canela bg-canela text-white'
          : 'border-borde bg-nata text-cacao hover:border-canela-pastel',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-3xl bg-nata p-5 shadow-suave', className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, emoji, children, className }) {
  return (
    <header className={cx('px-4 pt-6 pb-4 md:pt-10', className)}>
      <h1 className="font-display text-3xl font-semibold leading-tight md:text-4xl">
        {title} {emoji && <span aria-hidden>{emoji}</span>}
      </h1>
      {children && <div className="mt-2 max-w-2xl text-lg text-cacao-suave">{children}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, className }) {
  return (
    <div className={cx('mb-4 flex items-end justify-between gap-4', className)}>
      <h2 className="font-display text-2xl font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-cacao-suave" role="status">
      <LoaderCircle className="size-8 animate-spin text-canela" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action, tone = 'lavanda' }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-10 text-center">
      <CatIllustration tone={tone} className="mb-4 size-36 rounded-full" />
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {children && <div className="mt-2 text-cacao-suave">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState title="¡Vaya! Algo se ha enredado" tone="melocoton" action={onRetry && <Button onClick={onRetry}>Reintentar</Button>}>
      {error?.message ?? 'No hemos podido cargar esto.'}
    </EmptyState>
  );
}

/** Dato que la asociación todavía no ha rellenado (textos legales). */
export function Pending({ children = 'pendiente' }) {
  return <mark className="rounded bg-mantequilla px-1 text-mantequilla-oscuro">[{children}]</mark>;
}
