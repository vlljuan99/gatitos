import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { buttonClass, cx } from '../components/ui.jsx';

// Papeles en PDF (los genera el servidor en /api/papeles). Se abren en una
// pestaña nueva o en el visor del móvil, donde no siempre viaja la cookie
// de sesión (sobre todo con el panel instalado como app), así que cada
// enlace lleva un permiso de media hora que se renueva solo.

let cached = null;
let pending = null;
const MARGIN = 5 * 60 * 1000;

function fresh() {
  return cached && cached.expires - Date.now() > MARGIN ? cached.token : null;
}

async function getToken() {
  if (fresh()) return cached.token;
  pending ??= api('/admin/papeles/permiso', { method: 'POST' })
    .then((result) => {
      cached = { token: result.token, expires: Date.parse(result.expiresAt) };
      return result.token;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Permiso vigente para abrir papeles (null mientras llega). */
export function usePaperToken() {
  const [token, setToken] = useState(fresh);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getToken()
        .then((value) => alive && setToken(value))
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return token;
}

export function paperUrl(path, token, { twoUp = false, download = false } = {}) {
  const params = new URLSearchParams();
  if (twoUp) params.set('hoja', 'a4');
  if (download) params.set('descargar', '1');
  if (token) params.set('t', token);
  return `/api/papeles${path}?${params}`;
}

/**
 * Botón que abre un PDF. twoUp: dos medias hojas A5 en un folio. download: lo
 * guarda como archivo (en el móvil va a «Descargas») sin salir del panel.
 */
export function PdfLink({ path, twoUp, download, children, variant = 'secondary', size = 'sm', block, className, label }) {
  const token = usePaperToken();
  return (
    <a
      href={token ? paperUrl(path, token, { twoUp, download }) : undefined}
      target={download ? undefined : '_blank'}
      download={download ? '' : undefined}
      rel="noopener"
      aria-disabled={!token}
      aria-label={label}
      className={cx(buttonClass({ variant, size, block }), !token && 'pointer-events-none opacity-60', className)}
    >
      {children}
    </a>
  );
}
