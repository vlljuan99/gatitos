export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Llama a /api y devuelve el JSON. Los errores traen mensaje en castellano y, en formularios, un error por campo. */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const init = { method, headers: {}, credentials: 'same-origin', signal };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'No hay conexión. Revisa tu internet y vuelve a probar.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path.startsWith('/admin')) {
      window.dispatchEvent(new Event('bigotes:sesion-caducada'));
    }
    throw new ApiError(response.status, data.error ?? 'Algo ha salido mal. Vuelve a intentarlo.', data.fields ?? {});
  }
  return data;
}
