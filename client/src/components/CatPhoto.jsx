import { CatIllustration } from './CatIllustration.jsx';
import { toneFor } from '../lib/cats.js';

// Fondo pastel mientras la foto carga (clases estáticas para Tailwind).
const LOADING_BG = {
  canela: 'bg-canela-claro',
  lavanda: 'bg-lavanda',
  menta: 'bg-menta',
  mantequilla: 'bg-mantequilla',
  melocoton: 'bg-melocoton',
  cielo: 'bg-cielo',
};

/** Sin fotos pero con vídeo: su portada hace de foto. */
function videoPoster(cat) {
  const video = cat.videos?.find((v) => v.poster);
  return video ? { sm: video.poster } : undefined;
}

/**
 * Foto de un gatito. La versión pequeña pesa poco para listados en datos
 * móviles; el navegador elige la grande solo si hace falta. Sin foto, ilustración.
 */
export function CatPhoto({ cat, photo = cat.photos?.[0] ?? videoPoster(cat), sizes = '(min-width: 768px) 33vw, 50vw', className = '', eager = false, alt }) {
  if (!photo) {
    return <CatIllustration tone={toneFor(cat.id)} seed={cat.id} className={className} label={alt ?? `Ilustración de ${cat.name}`} />;
  }
  return (
    <img
      src={photo.sm}
      srcSet={photo.lg ? `${photo.sm} 640w, ${photo.lg} 1600w` : undefined}
      sizes={photo.lg ? sizes : undefined}
      alt={alt ?? `Foto de ${cat.name}`}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`object-cover ${LOADING_BG[toneFor(cat.id)]} ${className}`}
    />
  );
}
