import { useEffect, useReducer } from 'react';
import { api } from './api.js';

// Caché mínima en memoria para las lecturas: al volver a una página se pinta
// al instante lo que ya teníamos y se refresca por detrás si es viejo.
const cache = new Map();
const listeners = new Map();

function notify(path) {
  for (const listener of listeners.get(path) ?? []) listener();
}

function load(path) {
  const entry = cache.get(path) ?? {};
  if (entry.promise) return entry.promise;
  const promise = api(path)
    .then((data) => cache.set(path, { data, time: Date.now() }))
    .catch((error) => cache.set(path, { ...cache.get(path), error, promise: null, time: Date.now() }))
    .finally(() => notify(path));
  cache.set(path, { ...entry, promise });
  return promise;
}

export function useApi(path, { maxAge = 60_000 } = {}) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!path) return undefined;
    const set = listeners.get(path) ?? new Set();
    set.add(rerender);
    listeners.set(path, set);
    const entry = cache.get(path);
    if (!entry || entry.error || Date.now() - entry.time > maxAge) load(path);
    return () => set.delete(rerender);
  }, [path, maxAge]);

  const entry = path ? cache.get(path) : undefined;
  return {
    data: entry?.data,
    error: entry?.data ? null : entry?.error,
    loading: Boolean(path) && !entry?.data && !entry?.error,
    reload: () => {
      cache.set(path, { ...cache.get(path), time: 0, error: null });
      return load(path);
    },
  };
}

/** Marca como viejas las lecturas que empiezan por un prefijo (p. ej. tras editar en el panel). */
export function invalidate(prefix) {
  // Copia de las claves: load() vuelve a insertar la entrada y un Map sí
  // visita lo que se añade durante el recorrido (sería un bucle infinito).
  for (const path of [...cache.keys()]) {
    if (path.startsWith(prefix)) {
      cache.delete(path);
      if (listeners.get(path)?.size) load(path);
    }
  }
}
