import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Hoja que sube desde abajo (en escritorio, ventana centrada). Se cierra con
 * Escape, tocando fuera o deslizando hacia abajo desde la barrita de arriba.
 * El arrastre empieza solo en la cabecera: así el contenido se desplaza con
 * el dedo con normalidad (en el iPhone, si toda la hoja era arrastrable, no
 * se podía bajar hasta los botones del final).
 */
export function Sheet({ open, onClose, title, children, labelledBy }) {
  const panel = useRef(null);
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.div
            className="absolute inset-0 bg-cacao/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={labelledBy ? undefined : title}
            aria-labelledby={labelledBy}
            tabIndex={-1}
            // Margen de sobra abajo: la barra flotante de Safari (iPhone) tapa
            // el final de la hoja aunque la zona segura diga 0.
            className="relative max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-[2rem] bg-crema px-5 pt-3 pb-[calc(var(--zona-segura)+4.5rem)] shadow-flotante outline-none md:max-w-lg md:rounded-[2rem] md:pb-6"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(event, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="-mx-5 -mt-3 touch-none px-5 pt-3" onPointerDown={(event) => drag.start(event)}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-cacao/15 md:hidden" aria-hidden />
              <div className="mb-3 flex items-center justify-between gap-4">
                {title && <h2 className="font-display text-xl font-semibold">{title}</h2>}
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto grid size-10 place-items-center rounded-full bg-cacao/5 text-cacao"
                  aria-label="Cerrar"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="pb-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
