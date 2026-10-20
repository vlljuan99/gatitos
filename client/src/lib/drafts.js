import { useEffect, useState } from 'react';

// Borradores de formularios guardados en el navegador, para no perder lo
// escrito si la página se recarga (en el móvil pasa a menudo: al cambiar de
// app, al abrir la cámara o al tirar hacia abajo sin querer).
//
// - En la web pública se usa sessionStorage: son datos personales y se borran
//   solos al cerrar la pestaña.
// - En el panel se usa localStorage (hasta 7 días), para poder retomar un
//   gatito a medias aunque el navegador se haya cerrado.

const PREFIX = 'bigotes:borrador:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function storageFor(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Lee un borrador. Con `base`, solo vale si se escribió partiendo de esa misma
 * versión (así no se pisan cambios que otra persona haya guardado después).
 */
export function readDraft(key, { storage = 'session', base } = {}) {
  const store = storageFor(storage);
  try {
    const raw = store?.getItem(PREFIX + key);
    if (!raw) return undefined;
    const draft = JSON.parse(raw);
    if (Date.now() - draft.at > MAX_AGE_MS || (base !== undefined && draft.base !== base)) {
      store.removeItem(PREFIX + key);
      return undefined;
    }
    return draft.value;
  } catch {
    return undefined;
  }
}

export function writeDraft(key, value, { storage = 'session', base } = {}) {
  try {
    storageFor(storage)?.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), base, value }));
  } catch {
    // Sin espacio o sin almacenamiento (modo privado): simplemente no se guarda.
  }
}

export function clearDraft(key, { storage = 'session' } = {}) {
  try {
    storageFor(storage)?.removeItem(PREFIX + key);
  } catch {
    // nada
  }
}

/** Al arrancar: borra los borradores caducados del panel. */
export function purgeOldDrafts() {
  const store = storageFor('local');
  try {
    for (const key of Object.keys(store ?? {})) {
      if (!key.startsWith(PREFIX)) continue;
      const draft = JSON.parse(store.getItem(key) ?? 'null');
      if (!draft || Date.now() - draft.at > MAX_AGE_MS) store.removeItem(key);
    }
  } catch {
    // nada
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function strip(value, omit) {
  if (!omit.length || !isPlainObject(value)) return value;
  const copy = { ...value };
  for (const key of omit) delete copy[key];
  return copy;
}

/**
 * Como useState, pero guardado como borrador mientras sea distinto de
 * `pristine` (el valor de partida). Si vuelve a ser igual, el borrador se
 * borra. Devuelve [valor, setValor, { restored, discard }].
 *
 * Opciones:
 * - storage: 'session' (web pública) o 'local' (panel).
 * - checkBase: solo recupera el borrador si `pristine` no ha cambiado desde
 *   que se escribió (para editar algo que ya existe en el servidor).
 * - omit: campos que no se guardan nunca (p. ej. la casilla de privacidad).
 * - override: campos que mandan sobre el borrador al recuperarlo.
 */
export function useDraftState(key, pristine, { storage = 'session', checkBase = false, omit = [], override } = {}) {
  const pristineJson = JSON.stringify(pristine);
  const base = checkBase ? pristineJson : undefined;
  const [restored] = useState(() => (key ? readDraft(key, { storage, base }) : undefined));
  const [value, setValue] = useState(() => {
    if (restored === undefined) return override ? { ...pristine, ...override } : pristine;
    // Se mezcla con el valor de partida: los campos nuevos de una versión
    // posterior de la web tienen valor aunque el borrador sea anterior.
    return isPlainObject(pristine) ? { ...pristine, ...restored, ...override } : restored;
  });

  useEffect(() => {
    if (!key) return;
    const current = strip(value, omit);
    if (JSON.stringify(current) === JSON.stringify(strip(pristine, omit))) clearDraft(key, { storage });
    else writeDraft(key, current, { storage, base });
    // pristine va por su JSON (pristineJson) y omit es una lista fija.
  }, [key, value, pristineJson, storage, base]);

  /** Borra el borrador (tras enviar o guardar con éxito). */
  function discard() {
    if (key) clearDraft(key, { storage });
  }

  return [value, setValue, { restored: restored !== undefined, discard }];
}
