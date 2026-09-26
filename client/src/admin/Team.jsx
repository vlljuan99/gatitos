import { useState } from 'react';
import { Copy, KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react';
import { WhatsAppIcon } from '../components/BrandIcons.jsx';
import { Choice, FormError, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, ErrorState, Spinner, buttonClass, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { AdminPage, refreshAfterChange, timeAgo, useAdminApi, useAuth, useConfirm } from './common.jsx';

const ROLE_OPTIONS = [
  { value: 'cuidabigotes', label: 'Cuidabigotes' },
  { value: 'admin', label: 'Administración' },
];

/** Enseña la contraseña temporal una sola vez, con botones para pasarla. */
function PasswordSheet({ info, onClose }) {
  const toast = useToast();
  if (!info) return <Sheet open={false} onClose={onClose} />;
  const url = `${window.location.origin}/admin`;
  const message = `¡Hola, ${info.name.split(' ')[0]}! 🐾 Ya puedes entrar al panel de Bigotes:\n${url}\nEmail: ${info.email}\nContraseña temporal: ${info.password}\nCámbiala en «Mi cuenta» al entrar.`;
  return (
    <Sheet open onClose={onClose} title="Contraseña temporal">
      <p className="text-cacao-suave">Pásasela a {info.name}. Por seguridad, no se volverá a mostrar.</p>
      <p className="mt-4 rounded-2xl bg-mantequilla p-4 text-center font-mono text-xl font-bold text-mantequilla-oscuro">{info.password}</p>
      <div className="mt-4 grid gap-3">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={cx(buttonClass({ block: true }), 'bg-[#177a41] hover:bg-[#12663a]')}>
          <WhatsAppIcon /> Enviar por WhatsApp
        </a>
        <Button
          variant="secondary"
          block
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              toast('Copiado');
            } catch {
              window.prompt('Copia el mensaje:', message);
            }
          }}
        >
          <Copy className="size-4" /> Copiar mensaje
        </Button>
      </div>
    </Sheet>
  );
}

export default function Team() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useAdminApi('/equipo');
  const [form, setForm] = useState({ name: '', email: '', role: 'cuidabigotes' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState(null);
  const [ask, dialog] = useConfirm();

  async function add(event) {
    event.preventDefault();
    setAdding(true);
    setFormError('');
    try {
      const result = await api('/admin/equipo', { method: 'POST', body: form });
      setPassword({ name: result.user.name, email: result.user.email, password: result.temporaryPassword });
      setForm({ name: '', email: '', role: 'cuidabigotes' });
      setErrors({});
      refreshAfterChange();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setFormError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function update(person, body, message) {
    try {
      await api(`/admin/equipo/${person.id}`, { method: 'PATCH', body });
      refreshAfterChange();
      toast(message);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function reset(person) {
    const ok = await ask({
      title: `¿Nueva contraseña para ${person.name}?`,
      body: 'Se cerrarán sus sesiones abiertas y tendrá que entrar con la nueva.',
      confirmLabel: 'Sí, generar otra',
    });
    if (!ok) return;
    try {
      const result = await api(`/admin/equipo/${person.id}/restablecer`, { method: 'POST' });
      setPassword({ name: person.name, email: person.email, password: result.temporaryPassword });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <AdminPage title="Equipo" subtitle="Las cuidabigotes llevan el día a día: gatitos, solicitudes, mensajes y textos. La administración, además, gestiona el equipo y los datos legales.">
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <ul className="grid gap-2">
          {data.users.map((person) => (
            <li key={person.id}>
              <Card className={cx('grid gap-3', !person.active && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">
                      {person.name} {person.id === me.id && <span className="text-sm text-cacao-suave">(tú)</span>}
                    </p>
                    <p className="truncate text-sm text-cacao-suave">{person.email}</p>
                    <p className="text-xs text-cacao-suave">
                      {person.active ? (person.lastLoginAt ? `Entró ${timeAgo(person.lastLoginAt)}` : 'Todavía no ha entrado') : 'Desactivada'}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold',
                      person.role === 'admin' ? 'bg-fresa-claro text-fresa-oscuro' : 'bg-lavanda text-lavanda-oscuro',
                    )}
                  >
                    {person.roleLabel}
                  </span>
                </div>
                {person.id !== me.id && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => reset(person)}>
                      <KeyRound className="size-4" /> Nueva contraseña
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        update(
                          person,
                          { role: person.role === 'admin' ? 'cuidabigotes' : 'admin' },
                          `${person.name} ahora es ${person.role === 'admin' ? 'cuidabigotes' : 'de administración'}`,
                        )
                      }
                    >
                      {person.role === 'admin' ? 'Pasar a cuidabigotes' : 'Hacer administración'}
                    </Button>
                    <Button
                      variant={person.active ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => update(person, { active: !person.active }, person.active ? `${person.name} ya no puede entrar` : `${person.name} puede volver a entrar`)}
                    >
                      {person.active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                      {person.active ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <UserPlus className="size-5 text-fresa" /> Añadir a alguien
        </h2>
        <form onSubmit={add} className="mt-4 grid gap-4" noValidate>
          <TextInput label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} error={errors.name} />
          <TextInput label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} error={errors.email} />
          <Choice label="Papel" options={ROLE_OPTIONS} value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
          <FormError>{formError}</FormError>
          <Button type="submit" loading={adding}>
            Crear acceso
          </Button>
        </form>
      </Card>
      <PasswordSheet info={password} onClose={() => setPassword(null)} />
      {dialog}
    </AdminPage>
  );
}
