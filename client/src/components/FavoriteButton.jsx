import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFavorites } from '../lib/favorites.js';
import { cx } from './ui.jsx';

export function FavoriteButton({ cat, className, size = 'md' }) {
  const { has, toggle } = useFavorites();
  const active = has(cat.slug);
  const dims = size === 'lg' ? 'size-12' : 'size-10';
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(cat.slug);
      }}
      aria-pressed={active}
      aria-label={active ? `Quitar a ${cat.name} de favoritos` : `Me encanta ${cat.name}`}
      className={cx(
        'grid place-items-center rounded-full shadow-suave backdrop-blur transition',
        active ? 'bg-fresa text-white' : 'bg-nata/90 text-fresa',
        dims,
        className,
      )}
    >
      <Heart className={size === 'lg' ? 'size-6' : 'size-5'} fill={active ? 'currentColor' : 'none'} strokeWidth={2.4} />
    </motion.button>
  );
}
