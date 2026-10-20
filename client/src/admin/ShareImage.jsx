import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Spinner, buttonClass, cx } from '../components/ui.jsx';
import { shareCaption } from '../lib/shareText.js';
import { useApi } from '../lib/useApi.js';
import { FORMATS, renderShareImage } from './drawShareImage.js';

/** Fotos que sirven para la imagen: las del gatito y, si no hay, las portadas de sus vídeos. */
export function sharePhotos(cat) {
  const photos = cat.photos.map((photo) => ({ id: `f${photo.id}`, thumb: photo.sm, src: photo.lg }));
  const posters = cat.videos.filter((v) => v.poster).map((v) => ({ id: `v${v.id}`, thumb: v.poster, src: v.poster }));
  return photos.length ? photos : posters;
}

/**
 * Hoja para crear la imagen de redes de un gatito: se elige formato y foto
 * principal, se ve la imagen y se comparte (o se descarga) junto a un texto
 * listo para pegar.
 */
export function ShareImageSheet({ cat, open, onClose }) {
  const toast = useToast();
  const { data: site } = useApi('/sitio');
  const contact = site?.content.contact;
  const photos = useMemo(() => sharePhotos(cat), [cat]);
  const [format, setFormat] = useState('post');
  const [main, setMain] = useState(0);
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');

  const catUrl = `${window.location.origin}/gatitos/${cat.slug}`;
  const webUrl = `${window.location.host}/gatitos/${cat.slug}`;
  const caption = shareCaption(cat, contact, catUrl);
  const ordered = useMemo(() => (photos.length ? [photos[main], ...photos.filter((_, i) => i !== main)] : []), [photos, main]);
  const key = JSON.stringify([format, ordered.map((p) => p.src), cat.name, cat.sex, cat.birthDate, cat.personality, cat.health, contact]);

  useEffect(() => {
    if (!open || !site || ordered.length === 0) return undefined;
    let alive = true;
    let url;
    setImage(null);
    setError('');
    renderShareImage({ cat, contact, webUrl, format, photos: ordered.map((p) => p.src) })
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => alive && setError('No se ha podido crear la imagen. Vuelve a intentarlo.'));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // `key` resume todo lo que cambia el dibujo.
  }, [open, key]);

  const fileName = `bigotes-${cat.slug}${format === 'historia' ? '-historia' : ''}.jpg`;
  const file = image ? new File([image.blob], fileName, { type: 'image/jpeg' }) : null;
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }));

  async function share() {
    try {
      await navigator.share({ files: [file], title: `${cat.name} busca hogar`, text: caption });
    } catch (err) {
      if (err?.name !== 'AbortError') toast('No se ha podido compartir. Descárgala y súbela desde la app.', { tone: 'error' });
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      toast('Texto copiado 📋');
    } catch {
      window.prompt('Copia el texto:', caption);
    }
  }

  const noContact = contact && !contact.whatsapp && !contact.phone;

  return (
    <Sheet open={open} onClose={onClose} title="Compártelo en redes 📣">
      {photos.length === 0 ? (
        <p className="text-cacao-suave">Añade al menos una foto de {cat.name} para crear la imagen.</p>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato">
            {Object.entries(FORMATS).map(([value, f]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={format === value}
                onClick={() => setFormat(value)}
                className={cx(
                  'min-h-12 rounded-2xl border-2 px-3 py-2 text-left font-bold transition',
                  format === value ? 'border-canela bg-canela-claro text-canela-oscuro' : 'border-borde bg-nata',
                )}
              >
                {f.label}
                <span className="block text-xs font-semibold text-cacao-suave">{f.hint}</span>
              </button>
            ))}
          </div>

          {photos.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-bold">Foto principal</p>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setMain(i)}
                    aria-label={`Usar la foto ${i + 1} como principal`}
                    aria-pressed={main === i}
                    className={cx('size-16 shrink-0 overflow-hidden rounded-2xl border-4 transition', main === i ? 'border-canela' : 'border-transparent')}
                  >
                    <img src={photo.thumb} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={cx('grid place-items-center overflow-hidden rounded-3xl bg-canela-claro', format === 'post' ? 'aspect-[4/5]' : 'aspect-[9/16]')}>
            {image ? (
              <img src={image.url} alt={`Imagen para redes de ${cat.name}`} className="size-full object-contain" />
            ) : error ? (
              <p className="p-4 text-center font-bold text-canela-oscuro">{error}</p>
            ) : (
              <Spinner label="Preparando la imagen…" />
            )}
          </div>

          {noContact && (
            <p className="rounded-2xl bg-mantequilla p-3 text-sm text-mantequilla-oscuro">
              Todavía no hay WhatsApp ni teléfono en <strong>Textos de la web → Contacto</strong>: la imagen solo lleva la dirección de la web.
            </p>
          )}
          {cat.status === 'borrador' && (
            <p className="rounded-2xl bg-mantequilla p-3 text-sm text-mantequilla-oscuro">
              {cat.name} está en borrador: publícalo para que el enlace de la web funcione.
            </p>
          )}

          <div className="grid gap-2">
            {canShare && (
              <Button size="lg" block onClick={share}>
                <Share2 className="size-5" /> Compartir
              </Button>
            )}
            <a
              href={image?.url}
              download={fileName}
              aria-disabled={!image}
              className={cx(buttonClass({ variant: canShare ? 'secondary' : 'primary', size: 'lg', block: true }), !image && 'pointer-events-none opacity-50')}
            >
              <Download className="size-5" /> Descargar imagen
            </a>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Texto para acompañarla</p>
            <p className="max-h-40 overflow-y-auto whitespace-pre-line rounded-2xl bg-nata p-3 text-sm shadow-suave">{caption}</p>
            <Button variant="soft" block onClick={copyCaption} className="mt-2">
              <Copy className="size-4" /> Copiar texto
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
