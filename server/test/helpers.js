// Cada fichero de test corre en su propio proceso con una carpeta de datos
// temporal. Este módulo debe importarse ANTES que cualquier cosa de src/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bigotes-test-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
process.env.DATA_DIR = dataDir;
process.env.PUBLIC_URL = 'https://bigotes.test';
process.env.JWT_SECRET = 'secreto-de-pruebas';

const { runMigrations } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { createUser } = await import('../src/auth.js');

runMigrations();

export { dataDir };

/** Arranca la app en un puerto libre. clientDist permite probar la SPA. */
export async function startServer(options = {}) {
  const app = createApp({ clientDist: path.join(dataDir, 'sin-cliente'), ...options });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** Cliente HTTP mínimo con su propia cookie de sesión. */
export function client(base) {
  let cookie = '';
  async function request(method, url, body, headers = {}) {
    const init = { method, headers: { ...headers } };
    if (cookie) init.headers.cookie = cookie;
    if (body instanceof FormData) {
      init.body = body;
    } else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(base + url, init);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = response.headers.get('content-type') ?? '';
    const data = type.includes('json') ? await response.json() : await response.text();
    return { status: response.status, data, headers: response.headers };
  }
  return {
    get: (url, headers) => request('GET', url, undefined, headers),
    post: (url, body, headers) => request('POST', url, body, headers),
    put: (url, body, headers) => request('PUT', url, body, headers),
    patch: (url, body, headers) => request('PATCH', url, body, headers),
    delete: (url, headers) => request('DELETE', url, undefined, headers),
  };
}

let userCounter = 0;
export async function loggedIn(base, role = 'admin') {
  userCounter += 1;
  const email = `${role}${userCounter}@bigotes.test`;
  createUser({ email, name: `${role} ${userCounter}`, role, password: 'contraseña-segura' });
  const api = client(base);
  const res = await api.post('/api/auth/login', { email, password: 'contraseña-segura' });
  if (res.status !== 200) throw new Error(`Login fallido: ${JSON.stringify(res.data)}`);
  return Object.assign(api, { user: res.data.user });
}

export const validApplication = (overrides = {}) => ({
  name: 'Ana García',
  email: 'Ana@Ejemplo.es',
  phone: '600 123 456',
  adult: true,
  municipality: 'Almendralejo',
  province: 'Badajoz',
  housingType: 'piso',
  tenure: 'propiedad',
  windowsSafe: 'si',
  adults: 2,
  kids: 'no',
  allAgree: 'si',
  allergies: 'no',
  hoursAlone: '4_8',
  why: 'Siempre hemos tenido gatos y nos encantaría darle un hogar a uno más.',
  commitVet: true,
  commitSterilize: true,
  commitFollowUp: true,
  privacy: true,
  ...overrides,
});
