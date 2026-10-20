// Fotos y vídeos elegidos en el alta de un gatito, guardados en el navegador
// (IndexedDB admite ficheros) para no perderlos si la página se recarga antes
// de publicar. Si el navegador no deja guardarlos (modo privado, sin espacio),
// no pasa nada: solo se pierde esa comodidad.

const DB_NAME = 'bigotes';
const STORE = 'borradores';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveFiles(key, files) {
  try {
    // Se guardan como Blob con su nombre: algunos Safari no guardan File tal cual.
    const items = files.map((file) => ({ name: file.name, type: file.type, lastModified: file.lastModified, blob: file }));
    await run('readwrite', (store) => (items.length ? store.put(items, key) : store.delete(key)));
  } catch {
    // nada
  }
}

export async function loadFiles(key) {
  try {
    const items = (await run('readonly', (store) => store.get(key))) ?? [];
    return items.map((item) => new File([item.blob], item.name, { type: item.type, lastModified: item.lastModified }));
  } catch {
    return [];
  }
}

export async function clearFiles(key) {
  try {
    await run('readwrite', (store) => store.delete(key));
  } catch {
    // nada
  }
}
