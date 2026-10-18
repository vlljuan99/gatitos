import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { Spinner } from '../components/ui.jsx';
import { paperUrl, PdfLink, usePaperToken } from './paperLinks.jsx';

// Vista previa de un papel dentro del panel, antes de imprimirlo. El móvil
// (sobre todo Android) no enseña los PDF dentro de la página, así que se
// dibujan con pdf.js, que solo se descarga la primera vez que se abre una.

let pdfjsPromise = null;
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

/** Dibuja todas las páginas del PDF en lienzos, al ancho del contenedor. */
function Pages({ url }) {
  const box = useRef(null);
  const [state, setState] = useState({ loading: true, error: null, pages: 0 });

  useEffect(() => {
    let cancelled = false;
    let task = null;
    (async () => {
      try {
        const [pdfjs, response] = await Promise.all([loadPdfjs(), fetch(url, { credentials: 'same-origin' })]);
        if (!response.ok) throw new Error(response.status === 401 ? 'El permiso ha caducado: cierra y vuelve a abrirlo.' : 'No se ha podido preparar el papel.');
        if (cancelled) return;
        task = pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()), isEvalSupported: false });
        const doc = await task.promise;
        if (cancelled) return;
        setState({ loading: false, error: null, pages: doc.numPages });
        const width = box.current?.clientWidth || 360;
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        for (let n = 1; n <= doc.numPages && !cancelled; n += 1) {
          const page = await doc.getPage(n);
          const scale = width / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: scale * ratio });
          const canvas = box.current?.querySelector(`[data-page="${n}"]`);
          if (!canvas) break;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvas, viewport }).promise;
        }
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message || 'No se ha podido enseñar el papel.', pages: 0 });
      }
    })();
    return () => {
      cancelled = true;
      // Al cerrar a medio dibujar se cancela todo (y se libera el worker).
      task?.destroy().catch(() => {});
    };
  }, [url]);

  return (
    <div ref={box} className="grid gap-3">
      {state.loading && <Spinner label="Preparando la vista previa…" />}
      {state.error && <p className="rounded-2xl bg-canela-claro p-4 font-semibold text-canela-oscuro">{state.error}</p>}
      {Array.from({ length: state.pages }, (_, i) => (
        <canvas
          key={i}
          data-page={i + 1}
          className="h-auto w-full rounded-lg bg-white shadow-suave"
          aria-label={state.pages > 1 ? `Página ${i + 1} de ${state.pages}` : 'Vista previa'}
        />
      ))}
    </div>
  );
}

/**
 * Hoja con la vista previa y, debajo, los botones para abrirlo e imprimirlo
 * (también dos por folio en los A5).
 */
export function PdfPreview({ path, title, a5, open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Preview path={path} title={title} a5={a5} />
    </Sheet>
  );
}

/** Lo de dentro de la hoja: solo existe (y pide permiso) mientras está abierta. */
function Preview({ path, title, a5 }) {
  const token = usePaperToken();
  return (
    <>
      {token ? <Pages url={paperUrl(path, token)} /> : <Spinner />}
      <div className="sticky bottom-0 -mx-5 mt-4 flex flex-wrap gap-2 bg-crema/95 px-5 pt-3 pb-1 backdrop-blur">
        <PdfLink path={path} variant="primary" size="md" className="flex-1" label={`Abrir ${title} para imprimir o guardar`}>
          <Printer className="size-5" /> Imprimir o guardar
        </PdfLink>
        {a5 && (
          <PdfLink path={path} twoUp size="md" label={`${title}: dos por folio A4`}>
            2 por folio
          </PdfLink>
        )}
      </div>
    </>
  );
}
