import { useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from './ui.jsx';

// Carrusel de fotos como el de Instagram. El navegador se queda con el
// desplazamiento vertical (touch-action: pan-y) y nosotros solo movemos las
// fotos cuando el dedo va claramente de lado: al bajar por el feed tocando
// una foto, la foto no se mueve. Al soltar se pasa a la siguiente si se ha
// arrastrado una quinta parte o con un gesto rápido; en los extremos, rebote.

const LOCK_PX = 8; // lo que hay que mover el dedo para decidir el eje
const SPRING = { type: 'spring', stiffness: 420, damping: 42 };

export function SwipeCarousel({ count, label, renderSlide, onIndexChange, className }) {
  const box = useRef(null);
  const gesture = useRef(null);
  const dragged = useRef(false);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const el = box.current;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Al cambiar de ancho (girar el móvil), la foto actual sigue en su sitio.
  useLayoutEffect(() => x.set(-index * width), [width]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(target) {
    const next = Math.max(0, Math.min(count - 1, target));
    if (next !== index) {
      setIndex(next);
      onIndexChange?.(next);
      box.current.querySelectorAll('video').forEach((video) => video.pause());
    }
    animate(x, -next * width, SPRING);
  }

  function onPointerDown(event) {
    if (count < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    gesture.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, axis: null, samples: [] };
    dragged.current = false;
  }

  function onPointerMove(event) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    if (!g.axis) {
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      // Hacia abajo o arriba: es el feed el que se mueve, no las fotos.
      if (Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      g.axis = 'x';
      dragged.current = true;
      x.stop();
      box.current.setPointerCapture?.(event.pointerId);
    }
    const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
    x.set(-index * width + (atEdge ? dx * 0.3 : dx));
    g.samples = [...g.samples.slice(-4), { dx, t: event.timeStamp }];
  }

  function onPointerUp(event) {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.axis) return;
    const dx = event.clientX - g.x0;
    const first = g.samples[0];
    const last = g.samples.at(-1);
    const velocity = first && last && last.t > first.t ? (last.dx - first.dx) / (last.t - first.t) : 0;
    if (dx < -width * 0.2 || velocity < -0.45) goTo(index + 1);
    else if (dx > width * 0.2 || velocity > 0.45) goTo(index - 1);
    else goTo(index);
  }

  function onPointerCancel() {
    if (gesture.current?.axis) goTo(index);
    gesture.current = null;
  }

  return (
    <div className={cx('group relative overflow-hidden', className)}>
      <div
        ref={box}
        className="size-full touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDragStart={(event) => event.preventDefault()}
        // Tras arrastrar no cuenta como toque (ni para el doble toque ni para enlaces).
        onClickCapture={(event) => {
          if (dragged.current) {
            event.preventDefault();
            event.stopPropagation();
            dragged.current = false;
          }
        }}
        aria-roledescription="carrusel"
        aria-label={label}
      >
        <motion.div className="flex size-full" style={{ x }}>
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="h-full w-full shrink-0"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${count}`}
              aria-hidden={i !== index}
              inert={i !== index ? true : undefined}
            >
              {renderSlide(i, i === index)}
            </div>
          ))}
        </motion.div>
      </div>
      {/* En el ordenador, flechas al pasar el ratón. */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className={cx(
              'absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-nata/90 text-cacao shadow-suave transition md:grid',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              index === 0 && 'md:hidden',
            )}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className={cx(
              'absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-nata/90 text-cacao shadow-suave transition md:grid',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              index === count - 1 && 'md:hidden',
            )}
            aria-label="Foto siguiente"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </div>
  );
}
