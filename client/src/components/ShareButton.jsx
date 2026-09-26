import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Sheet } from './Sheet.jsx';
import { WhatsAppIcon } from './BrandIcons.jsx';
import { buttonClass, cx } from './ui.jsx';

/** Compartir: usa el menú nativo del móvil y, si no hay, ofrece WhatsApp o copiar enlace. */
export function ShareButton({ title, text, path, className, label = 'Compartir' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
  }

  return (
    <>
      <button type="button" onClick={share} className={className} aria-label={label}>
        <Share2 className="size-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Compartir">
        <div className="grid gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
            target="_blank"
            rel="noreferrer"
            className={cx(buttonClass({ block: true }), 'bg-[#177a41] hover:bg-[#12663a]')}
          >
            <WhatsAppIcon /> Enviar por WhatsApp
          </a>
          <button type="button" onClick={copy} className={buttonClass({ variant: 'secondary', block: true })}>
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
          </button>
        </div>
      </Sheet>
    </>
  );
}
