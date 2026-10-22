import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Volume2, VolumeX, X } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { ButtonLink, cx } from '../components/ui.jsx';
import { objectPronoun } from '../lib/cats.js';
import { handle, jumpStory, stepStory, storySegments } from '../lib/miaustagram.js';

// Historias a pantalla completa, con los gestos de Instagram:
// - Cada gatito tiene sus trocitos (vídeos y fotos) con su barra de progreso.
// - Tocar a la derecha: siguiente; a la izquierda: anterior.
// - Mantener pulsado: pausa (y se esconde todo para ver bien la foto).
// - Deslizar de lado: al gatito siguiente o anterior, girando como un cubo.
// - Deslizar hacia abajo: se cierra, encogiéndose con el dedo.

const PHOTO_MS = 5000;
const HOLD_MS = 200;
const LOCK_PX = 10;
const EASE = [0.32, 0.72, 0, 1];

/** Lo que se ve de un trocito: vídeo o foto a pantalla completa. */
function Segment({ cat, segment, active, paused, muted, videoRef, onEnded }) {
  useEffect(() => {
    const video = videoRef?.current;
    if (!active || !video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [active, paused, videoRef]);

  if (segment.video) {
    if (!active) {
      return <img src={segment.video.poster} alt="" className="size-full object-cover" draggable={false} />;
    }
    return (
      <video
        key={segment.key}
        ref={videoRef}
        src={segment.video.url}
        poster={segment.video.poster}
        autoPlay
        muted={muted}
        playsInline
        onEnded={onEnded}
        className="size-full object-cover"
        aria-label={`Vídeo de ${cat.name}`}
      />
    );
  }
  return (
    <CatPhoto
      cat={cat}
      photo={segment.photo ?? undefined}
      eager
      sizes="100vw"
      className="pointer-events-none size-full object-cover"
      alt={cat.name}
    />
  );
}

/** Una cara del cubo: un gatito con su cabecera, su trocito y su botón. */
function Face({ cat, segments, seg, active, progress, paused, hidden, muted, setMuted, videoRef, onEnded, onClose }) {
  const segment = segments[seg] ?? segments[0];
  const ui = cx('transition-opacity duration-200', hidden && 'opacity-0');
  return (
    <div className="relative size-full overflow-hidden bg-cacao">
      <Segment cat={cat} segment={segment} active={active} paused={paused} muted={muted} videoRef={videoRef} onEnded={onEnded} />
      <div
        className={cx('pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cacao/75 to-transparent', ui)}
        aria-hidden
      />
      <div className={cx('absolute inset-x-0 top-0 flex gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]', ui)} aria-hidden>
        {segments.map((s, i) => (
          <span key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
            {i < seg ? (
              <span className="block h-full w-full bg-white" />
            ) : i === seg && active ? (
              <motion.span className="block h-full w-full origin-left bg-white" style={{ scaleX: progress }} />
            ) : null}
          </span>
        ))}
      </div>
      <div
        className={cx(
          'absolute inset-x-0 top-0 flex items-center gap-2.5 px-3 pt-[calc(max(0.5rem,env(safe-area-inset-top))+0.75rem)]',
          ui,
        )}
      >
        <span className="rounded-full bg-crema p-[2px]">
          <CatPhoto cat={cat} sizes="64px" className="size-8 rounded-full" alt="" />
        </span>
        <span className="flex-1 truncate font-bold text-white drop-shadow">{handle(cat)}</span>
        {active && segment.video && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="grid size-11 place-items-center rounded-full text-white"
            aria-label={muted ? 'Activar el sonido' : 'Quitar el sonido'}
          >
            {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
          </button>
        )}
        {active && (
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full text-white" aria-label="Cerrar">
            <X className="size-7" />
          </button>
        )}
      </div>
      <div
        className={cx(
          'absolute inset-x-0 bottom-0 grid gap-2 bg-gradient-to-t from-cacao/90 via-cacao/60 to-transparent p-4 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))] text-white',
          ui,
        )}
      >
        {cat.summary && <p className="line-clamp-3 whitespace-pre-line text-[15px] leading-snug drop-shadow">{cat.summary}</p>}
        {active && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <ButtonLink to={`/adoptar?gatito=${cat.slug}`} block onClick={onClose}>
              Quiero adoptar{objectPronoun(cat.sex)} 💕
            </ButtonLink>
            <ButtonLink to={`/gatitos/${cat.slug}`} variant="secondary" onClick={onClose}>
              Perfil
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}

/** Transformación de cada cara del cubo según lo arrastrado (offset -1, 0, 1). */
function useCubeFace(dragX, width, offset) {
  const transform = useTransform(dragX, (x) => {
    const angle = (x / (width || 1)) * 90 + offset * 90;
    return `translateZ(${-width / 2}px) rotateY(${angle}deg) translateZ(${width / 2}px)`;
  });
  const shade = useTransform(dragX, (x) => Math.min(0.6, Math.abs(x / (width || 1) + offset) * 0.6));
  return { transform, shade };
}

export function StoryViewer({ cats, start, onClose, onSeen }) {
  const reduceMotion = useReducedMotion();
  const stage = useRef(null);
  const videoRef = useRef(null);
  const gesture = useRef(null);
  const holdTimer = useRef(null);
  const elapsed = useRef(0);
  const busy = useRef(false);
  const [pos, setPos] = useState({ cat: start, seg: 0 });
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(true);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const progress = useMotionValue(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const counts = cats.map((cat) => storySegments(cat).length);
  const W = size.w;

  const scale = useTransform(dragY, [0, 600], [1, 0.75]);
  const radius = useTransform(dragY, [0, 80], [0, 24]);
  const backdrop = useTransform(dragY, [0, 500], [1, 0]);
  const prevFace = useCubeFace(dragX, W, -1);
  const currentFace = useCubeFace(dragX, W, 0);
  const nextFace = useCubeFace(dragX, W, 1);

  useLayoutEffect(() => {
    const measure = () => setSize({ w: stage.current?.clientWidth ?? 0, h: stage.current?.clientHeight ?? 0 });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Al cambiar de gatito (también al terminar el giro del cubo) se coloca la
  // cara nueva de frente antes de pintar, para que no parpadee.
  useLayoutEffect(() => {
    dragX.set(0);
    onSeen?.(cats[pos.cat]?.slug);
  }, [pos.cat]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    elapsed.current = 0;
    progress.set(0);
  }, [pos.cat, pos.seg, progress]);

  const close = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    if (reduceMotion) return onClose();
    animate(dragY, Math.max(size.h * 0.5, 300), { duration: 0.22, ease: 'easeIn' }).then(onClose);
  }, [dragY, onClose, reduceMotion, size.h]);

  // Pasar a otro gatito girando el cubo; dentro del mismo gatito, cambio directo.
  const moveTo = useCallback(
    (target, dir) => {
      if (!target) return close();
      // Hacia atrás desde el primer trocito de todos: el mismo vuelve a empezar.
      if (target.cat === pos.cat && target.seg === pos.seg) {
        elapsed.current = 0;
        progress.set(0);
        if (videoRef.current) videoRef.current.currentTime = 0;
        return undefined;
      }
      if (target.cat === pos.cat || reduceMotion || !W) return setPos(target);
      busy.current = true;
      animate(dragX, -dir * W, { duration: 0.4, ease: EASE }).then(() => {
        busy.current = false;
        setPos(target);
      });
    },
    [W, close, dragX, pos.cat, pos.seg, progress, reduceMotion],
  );
  const step = useCallback(
    (dir) => {
      if (busy.current) return;
      const target = stepStory(pos, dir, counts);
      moveTo(target, target && target.cat !== pos.cat ? Math.sign(target.cat - pos.cat) : dir);
    },
    [pos, counts, moveTo], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Reloj de las fotos (5 s) y progreso de los vídeos; se para en pausa.
  const cat = cats[pos.cat];
  const segments = storySegments(cat);
  const segment = segments[pos.seg];
  useEffect(() => {
    if (paused) return undefined;
    let frame;
    let last = performance.now();
    const tick = (now) => {
      if (segment.video) {
        const video = videoRef.current;
        if (video?.duration) progress.set(video.currentTime / video.duration);
      } else {
        elapsed.current += now - last;
        progress.set(Math.min(1, elapsed.current / PHOTO_MS));
        if (elapsed.current >= PHOTO_MS) return step(1);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, segment, step, progress]);

  // Teclado, scroll de la página bloqueado y pausa si se cambia de pestaña.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      document.body.style.overflow = overflow;
    };
  }, [close, step]);

  // --- Gestos ---------------------------------------------------------------
  function onPointerDown(event) {
    if (busy.current || event.target.closest('button, a')) return;
    gesture.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, t0: event.timeStamp, axis: null };
    stage.current.setPointerCapture?.(event.pointerId);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      setPaused(true);
      setHeld(true);
    }, HOLD_MS);
  }

  function onPointerMove(event) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    if (!g.axis) {
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      clearTimeout(holdTimer.current);
      setPaused(true);
      setHeld(false);
    }
    if (g.axis === 'x') {
      // Sin gatito a ese lado, se resiste.
      const blocked = (dx > 0 && pos.cat === 0) || (dx < 0 && pos.cat === cats.length - 1);
      dragX.set(blocked ? dx * 0.25 : Math.max(-W, Math.min(W, dx)));
    } else {
      dragY.set(Math.max(0, dy));
    }
  }

  function onPointerUp(event) {
    const g = gesture.current;
    gesture.current = null;
    clearTimeout(holdTimer.current);
    if (!g) return;
    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    const ms = Math.max(1, event.timeStamp - g.t0);
    if (g.axis === 'x') {
      const dir = dx < 0 ? 1 : -1;
      const target = jumpStory(pos, dir, counts);
      setPaused(false);
      if ((Math.abs(dx) > W * 0.25 || Math.abs(dx) / ms > 0.5) && target) {
        busy.current = true;
        animate(dragX, -dir * W, { duration: 0.3, ease: EASE }).then(() => {
          busy.current = false;
          setPos(target);
        });
      } else if (Math.abs(dx) > W * 0.25 && dir > 0 && !target) {
        close();
      } else {
        animate(dragX, 0, { type: 'spring', stiffness: 380, damping: 36 });
      }
      return;
    }
    if (g.axis === 'y') {
      if (dy > 120 || dy / ms > 0.6) return close();
      animate(dragY, 0, { type: 'spring', stiffness: 380, damping: 34 });
      setPaused(false);
      return;
    }
    // Sin moverse: si se mantuvo pulsado, solo se reanuda; si no, es un toque.
    if (held) {
      setHeld(false);
      setPaused(false);
      return;
    }
    setPaused(false);
    const left = event.clientX - stage.current.getBoundingClientRect().left < W / 3;
    step(left ? -1 : 1);
  }

  function onPointerCancel() {
    gesture.current = null;
    clearTimeout(holdTimer.current);
    setHeld(false);
    setPaused(false);
    animate(dragX, 0, { type: 'spring', stiffness: 380, damping: 36 });
    animate(dragY, 0, { type: 'spring', stiffness: 380, damping: 34 });
  }

  const faces = [
    { offset: -1, index: pos.cat - 1, face: prevFace },
    { offset: 0, index: pos.cat, face: currentFace },
    { offset: 1, index: pos.cat + 1, face: nextFace },
  ].filter(({ index }) => index >= 0 && index < cats.length);

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Historia de ${cat.name}`}>
      <motion.div className="absolute inset-0 bg-[#1d1716]" style={{ opacity: backdrop }} aria-hidden />
      <motion.div
        className="mx-auto h-dvh max-w-md"
        initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <motion.div
          ref={stage}
          className="relative size-full touch-none select-none overflow-hidden"
          style={{ y: dragY, scale, borderRadius: radius, perspective: 1200 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="relative size-full" style={{ transformStyle: 'preserve-3d' }}>
            {faces.map(({ offset, index, face }) => {
              const faceCat = cats[index];
              const faceSegments = storySegments(faceCat);
              const active = offset === 0;
              return (
                <motion.div
                  key={faceCat.slug}
                  className="absolute inset-0"
                  style={{ transform: face.transform, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  aria-hidden={!active}
                >
                  <Face
                    cat={faceCat}
                    segments={faceSegments}
                    seg={active ? pos.seg : 0}
                    active={active}
                    progress={progress}
                    paused={paused}
                    hidden={active && held}
                    muted={muted}
                    setMuted={setMuted}
                    videoRef={active ? videoRef : undefined}
                    onEnded={() => step(1)}
                    onClose={close}
                  />
                  <motion.div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: face.shade }} aria-hidden />
                </motion.div>
              );
            })}
          </div>
          <p className="sr-only" aria-live="polite">
            {cat.name}, {pos.seg + 1} de {segments.length}
          </p>
          {/* Para teclado y lectores de pantalla (el toque se gestiona arriba). */}
          <button type="button" className="sr-only" onClick={() => step(-1)}>
            Historia anterior
          </button>
          <button type="button" className="sr-only" onClick={() => step(1)}>
            Historia siguiente
          </button>
        </motion.div>
      </motion.div>
    </div>,
    document.body,
  );
}
