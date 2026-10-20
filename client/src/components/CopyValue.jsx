import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cx } from './ui.jsx';

/** Dato para copiar con un toque (Bizum, IBAN, concepto…). */
export function CopyValue({ value, label, className }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copia el dato:', value);
        }
      }}
      aria-label={label ? `Copiar ${label}: ${value}` : undefined}
      className={cx('mt-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-crema px-4 py-3 text-left font-mono text-sm font-bold', className)}
    >
      <span className="break-all">{value}</span>
      {copied ? <Check className="size-5 shrink-0 text-menta-oscuro" aria-label="Copiado" /> : <Copy className="size-5 shrink-0" aria-label="Copiar" />}
    </button>
  );
}
