import { CatIllustration } from './CatIllustration.jsx';
import { toneFor } from '../lib/cats.js';

// Fondo pastel mientras la foto carga (clases estáticas para Tailwind).
const LOADING_BG = {
  fresa: 'bg-fresa-claro',
  lavanda: 'bg-lavanda',
  menta: 'bg-menta',
  mantequilla: 'bg-mantequilla',
  melocoton: 'bg-melocoton',
  cielo: 'bg-cielo',
};

/**
 * Foto de un gatito. La versión pequeña pesa poco para listados en datos
 * móviles; el navegador elige la grande solo si hace falta. Sin foto, ilustración.
 */
export function CatPhoto({ cat, photo = cat.photos?.[0], sizes = '(min-width: 768px) 33vw, 50vw', className = '', eager = false, alt }) {
  if (!photo) {
    return <CatIllustration tone={toneFor(cat.id)} seed={cat.id} className={className} label={alt ?? `Ilustración de ${cat.name}`} />;
  }
  return (
    <img
      src={photo.sm}
      srcSet={`${photo.sm} 640w, ${photo.lg} 1600w`}
      sizes={sizes}
      alt={alt ?? `Foto de ${cat.name}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`object-cover ${LOADING_BG[toneFor(cat.id)]} ${className}`}
    />
  );
}
