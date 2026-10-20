import { Link } from 'react-router-dom';
import { Mars, Play, Venus } from 'lucide-react';
import { ageText, gendered, statusLabel } from '../lib/cats.js';
import { CatPhoto } from './CatPhoto.jsx';
import { FavoriteButton } from './FavoriteButton.jsx';
import { Tag } from './ui.jsx';

export function SexIcon({ sex, className = 'size-4' }) {
  if (sex === 'hembra') return <Venus className={`${className} text-canela`} aria-label="Hembra" />;
  if (sex === 'macho') return <Mars className={`${className} text-cielo-oscuro`} aria-label="Macho" />;
  return null;
}

/** Distintivo «▶ Vídeo» para los gatitos que tienen vídeo. */
export function VideoBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-cacao/75 px-2 py-0.5 text-xs font-bold text-white backdrop-blur ${className}`}>
      <Play className="size-3" fill="currentColor" aria-hidden /> Vídeo
    </span>
  );
}

export function CatCard({ cat, sizes }) {
  // El corazón va fuera del enlace (un botón no puede ir dentro de un enlace).
  return (
    <div className="relative">
      <Link
        to={`/gatitos/${cat.slug}`}
        className="group block overflow-hidden rounded-3xl bg-nata shadow-suave transition active:scale-[0.98]"
      >
        <div className="relative aspect-[4/5] overflow-hidden">
          <CatPhoto cat={cat} sizes={sizes} className="size-full transition duration-500 group-hover:scale-105" />
          {cat.status === 'reservado' && (
            <span className="absolute left-2 top-2 rounded-full bg-mantequilla px-2.5 py-1 text-xs font-bold text-mantequilla-oscuro">
              {statusLabel('reservado', cat.sex)} 💛
            </span>
          )}
          {cat.videos?.length > 0 && <VideoBadge className="absolute bottom-2 left-2" />}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-display text-lg font-semibold leading-tight">{cat.name}</h3>
            <SexIcon sex={cat.sex} />
          </div>
          <p className="text-sm text-cacao-suave">{ageText(cat.birthDate) || 'Edad por confirmar'}</p>
          {cat.personality.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {cat.personality.slice(0, 2).map((tag) => (
                <Tag key={tag} tone="lavanda" className="px-2 py-0.5 text-xs">
                  {gendered(tag, cat.sex)}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </Link>
      {cat.status !== 'adoptado' && <FavoriteButton cat={cat} className="absolute right-2 top-2" />}
    </div>
  );
}

export function CatGrid({ cats }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {cats.map((cat) => (
        <li key={cat.id}>
          <CatCard cat={cat} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
        </li>
      ))}
    </ul>
  );
}
