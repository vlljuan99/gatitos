import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { FormError, TextInput } from '../components/form.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { AdminPage, useAuth } from './common.jsx';

export default function Account() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (next !== repeat) {
      setErrors({ repeat: 'No coincide con la nueva contraseña' });
      return;
    }
    setSaving(true);
    try {
      await api('/auth/password', { method: 'PUT', body: { current, next } });
      setCurrent('');
      setNext('');
      setRepeat('');
      setErrors({});
      toast('Contraseña cambiada 🔐');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage title="Mi cuenta">
      <Card>
        <p className="font-display text-xl font-semibold">{user.name}</p>
        <p className="text-cacao-suave">{user.email}</p>
        <p className="mt-2 inline-block rounded-full bg-lavanda px-3 py-1 text-sm font-bold text-lavanda-oscuro">{user.roleLabel}</p>
      </Card>
      <Card className="mt-4">
        <h2 className="font-display text-xl font-semibold">Cambiar contraseña</h2>
        <p className="text-sm text-cacao-suave">Al cambiarla se cierra tu sesión en los demás dispositivos.</p>
        <form onSubmit={submit} className="mt-4 grid gap-4" noValidate>
          <TextInput label="Contraseña actual" type="password" autoComplete="current-password" value={current} onChange={setCurrent} error={errors.current} />
          <TextInput label="Nueva contraseña" type="password" autoComplete="new-password" hint="Al menos 8 caracteres." value={next} onChange={setNext} error={errors.next} />
          <TextInput label="Repite la nueva" type="password" autoComplete="new-password" value={repeat} onChange={setRepeat} error={errors.repeat} />
          <FormError>{error}</FormError>
          <Button type="submit" loading={saving}>
            Guardar contraseña
          </Button>
        </form>
      </Card>
      <Button variant="secondary" className="mt-6" onClick={logout}>
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </AdminPage>
  );
}
