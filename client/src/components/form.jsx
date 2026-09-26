import { useId } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { cx } from './ui.jsx';

// Campos de formulario grandes y cómodos para el dedo (mínimo 48 px).

export function Field({ label, hint, error, optional, children, id: givenId, as = 'div' }) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const Wrapper = as;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <Wrapper className="grid gap-1.5">
      {as === 'fieldset' ? (
        <legend className="mb-1.5 font-bold">
          {label} {optional && <span className="font-normal text-cacao-suave">(opcional)</span>}
        </legend>
      ) : (
        <label htmlFor={id} className="font-bold">
          {label} {optional && <span className="font-normal text-cacao-suave">(opcional)</span>}
        </label>
      )}
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-cacao-suave">
          {hint}
        </p>
      )}
      {typeof children === 'function' ? children({ id, describedBy, invalid: Boolean(error) }) : children}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm font-semibold text-canela-oscuro" role="alert">
          <CircleAlert className="size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </Wrapper>
  );
}

const inputClass = (invalid) =>
  cx(
    'w-full rounded-2xl border-2 bg-nata px-4 py-3 text-base text-cacao placeholder:text-cacao-suave/70 transition',
    'focus:border-canela focus:outline-none',
    invalid ? 'border-canela-oscuro' : 'border-borde',
  );

export function TextInput({ label, hint, error, optional, value, onChange, type = 'text', ...props }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClass(invalid)}
          {...props}
        />
      )}
    </Field>
  );
}

export function TextArea({ label, hint, error, optional, value, onChange, rows = 4, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(inputClass(invalid), 'resize-y')}
          {...props}
        />
      )}
    </Field>
  );
}

/** Opciones en píldoras (radio accesible). */
export function Choice({ label, hint, error, optional, options, value, onChange, columns }) {
  const name = useId();
  return (
    <Field label={label} hint={hint} error={error} optional={optional} as="fieldset">
      {() => (
        <div className={cx('flex flex-wrap gap-2', columns && 'grid grid-cols-2')}>
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <label
                key={option.value}
                className={cx(
                  'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-center font-bold transition',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-canela',
                  selected ? 'border-canela bg-canela-claro text-canela-oscuro' : 'border-borde bg-nata hover:border-canela-pastel',
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="sr-only"
                />
                {option.emoji && <span aria-hidden>{option.emoji}</span>}
                {option.label}
              </label>
            );
          })}
        </div>
      )}
    </Field>
  );
}

/** Varias opciones a la vez (casillas en píldora). */
export function MultiChoice({ label, hint, error, options, value = [], onChange }) {
  return (
    <Field label={label} hint={hint} error={error} as="fieldset">
      {() => (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const selected = value.includes(option.value);
            return (
              <label
                key={option.value}
                className={cx(
                  'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2 font-bold transition',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-canela',
                  selected ? 'border-canela bg-canela-claro text-canela-oscuro' : 'border-borde bg-nata hover:border-canela-pastel',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    onChange(selected ? value.filter((v) => v !== option.value) : [...value, option.value])
                  }
                  className="sr-only"
                />
                <span aria-hidden>{option.emoji}</span>
                <span className="flex-1">{option.label}</span>
                {selected && <Check className="size-5" aria-hidden />}
              </label>
            );
          })}
        </div>
      )}
    </Field>
  );
}

export function Checkbox({ checked, onChange, error, children }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label
        htmlFor={id}
        className={cx(
          'flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-nata p-4 transition',
          'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-canela',
          checked ? 'border-canela' : error ? 'border-canela-oscuro' : 'border-borde',
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error) || undefined}
          className="sr-only"
        />
        <span
          className={cx(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition',
            checked ? 'border-canela bg-canela text-white' : 'border-cacao/30 bg-nata',
          )}
          aria-hidden
        >
          {checked && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="text-[15px] leading-snug">{children}</span>
      </label>
      {error && (
        <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-canela-oscuro" role="alert">
          <CircleAlert className="size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

/** Campo trampa para bots: invisible para las personas y para los lectores de pantalla. */
export function Honeypot({ value, onChange }) {
  return (
    <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
      <label>
        No rellenes este campo
        <input type="text" tabIndex={-1} autoComplete="off" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-canela-claro p-4 font-semibold text-canela-oscuro" role="alert">
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
