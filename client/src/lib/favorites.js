import { useSyncExternalStore } from 'react';
import { api } from './api.js';

// Favoritos («Me encanta») guardados en el navegador, sin registro. Si el
// almacenamiento no está disponible (modo privado), funcionan en memoria.

const KEY = 'bigotes:favoritos';
const listeners = new Set();

function read() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((slug) => typeof slug === 'string') : [];
  } catch {
    return [];
  }
}

let state = read();

function write(next) {
  state = next;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento: se quedan en memoria hasta cerrar la pestaña.
  }
  for (const listener of listeners) listener();
}

export const favorites = {
  get: () => state,
  has: (slug) => state.includes(slug),
  add(slug, { count = true } = {}) {
    if (state.includes(slug)) return;
    write([slug, ...state]);
    // El contador anónimo de «Me encanta» ayuda al equipo a ver qué gatitos gustan.
    if (count) api(`/gatitos/${encodeURIComponent(slug)}/me-encanta`, { method: 'POST' }).catch(() => {});
  },
  remove(slug) {
    write(state.filter((s) => s !== slug));
  },
  toggle(slug) {
    if (state.includes(slug)) favorites.remove(slug);
    else favorites.add(slug);
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
      state = read();
      for (const listener of listeners) listener();
    }
  });
}

export function useFavorites() {
  const slugs = useSyncExternalStore(favorites.subscribe, favorites.get, favorites.get);
  return { slugs, has: (slug) => slugs.includes(slug), toggle: favorites.toggle, add: favorites.add, remove: favorites.remove };
}
