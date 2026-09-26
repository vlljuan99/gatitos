import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(() => {});

/** Avisos cortos que aparecen encima de la barra inferior. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const show = useCallback((message, { action, tone = 'default', duration = 3500 } = {}) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((list) => [...list.slice(-2), { id, message, action, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-5 py-3 font-semibold shadow-flotante ${
                toast.tone === 'error' ? 'bg-fresa-oscuro text-white' : 'bg-cacao text-white'
              }`}
            >
              <span>{toast.message}</span>
              {toast.action}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
