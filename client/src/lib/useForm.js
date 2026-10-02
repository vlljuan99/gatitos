import { useState } from 'react';
import { api, ApiError } from './api.js';
import { useDraftState } from './drafts.js';

/**
 * Estado de un formulario público: valores, errores por campo (del servidor)
 * y envío. `field(name)` devuelve { value, onChange, error } para los inputs.
 * Con `draft` (una clave), lo escrito sobrevive a recargar la página hasta que
 * se envía o se cierra la pestaña (ver lib/drafts.js).
 */
export function useForm(initial, { draft, omit, override } = {}) {
  const [pristine] = useState(initial);
  const [values, setValues, draftState] = useDraftState(draft, pristine, { omit, override });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const set = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  const field = (name) => ({ value: values[name], onChange: (value) => set(name, value), error: errors[name] });

  async function submit(path, body = values) {
    setSending(true);
    setFormError('');
    try {
      await api(path, { method: 'POST', body });
      draftState.discard();
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields ?? {});
        setFormError(error.message);
      } else {
        setFormError('Algo ha salido mal. Vuelve a intentarlo.');
      }
      return false;
    } finally {
      setSending(false);
    }
  }

  return {
    values,
    setValues,
    set,
    field,
    errors,
    setErrors,
    formError,
    setFormError,
    sending,
    submit,
    restored: draftState.restored,
  };
}
