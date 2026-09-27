import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react';
import { WhatsAppIcon } from '../components/BrandIcons.jsx';
import { Choice, FormError, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, ErrorState, Spinner, buttonClass, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { AdminPage, refreshAfterChange, ROLE_INFO, timeAgo, useAdminApi, useAuth, useConfirm } from './common.jsx';

const ROLE_OPTIONS = ['cuidabigotes', 'admin'].map((role) => ({ value: role, label: ROLE_INFO[role].label, emoji: ROLE_INFO[role].emoji }));
const EMPTY_FORM = { name: '', email: '', role: 'cuidabigotes' };

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

/** Alta de una persona nueva: nombre, email y papel. */
function AddSheet({ open, onClose, onCreated }) {
  const [form, setForm] = useDraftState('alta-equipo', EMPTY_FORM, { storage: 'local' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);

  async function add(event) {
    event.preventDefault();
    setAdding(true);
    setFormError('');
    try {
      const result = await api('/admin/equipo', { method: 'POST', body: form });
      setForm(EMPTY_FORM);
      setErrors({});
      refreshAfterChange();
      onCreated({ name: result.user.name, email: result.user.email, password: result.temporaryPassword });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setFormError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Añadir al equipo">
      <form onSubmit={add} className="grid gap-4" noValidate>
        <TextInput label="Nombre" autoComplete="off" value={form.name} onChange={(v) => setForm({ ...form, name: v })} error={errors.name} />
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="off"
          hint="Con este email entrará al panel."
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
          error={errors.email}
        />
        <Choice label="Papel" columns options={ROLE_OPTIONS} value={form.role} onChange={(v) => setForm({ ...form, role: v })} hint={ROLE_INFO[form.role].can} />
        <FormError>{formError}</FormError>
        <Button type="submit" size="lg" block loading={adding}>
          <UserPlus className="size-5" /> Crear acceso
        </Button>
        <p className="text-center text-sm text-cacao-suave">Te daremos una contraseña temporal para que se la pases.</p>
      </form>
    </Sheet>
  );
}

export default function Team() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useAdminApi('/equipo');
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState(null);
  const [ask, dialog] = useConfirm();

  // Desde el resumen se llega con ?nuevo para abrir directamente el alta.
  useEffect(() => {
    if (!params.has('nuevo')) return;
    setAdding(true);
    setParams({}, { replace: true });
  }, [params, setParams]);

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

  function changeRole(person) {
    const next = person.role === 'admin' ? 'cuidabigotes' : 'admin';
    update(person, { role: next }, `${person.name} ahora es ${ROLE_INFO[next].label.toLowerCase()} ${ROLE_INFO[next].emoji}`);
  }

  return (
    <AdminPage title="Equipo" subtitle="Quién puede entrar al panel. No hay registro público: las altas se hacen aquí.">
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {['admin', 'cuidabigotes'].map((role) => (
          <Card key={role} className={role === 'admin' ? 'bg-canela-claro' : 'bg-lavanda'}>
            <p className="font-display text-lg font-semibold">
              <span aria-hidden>{ROLE_INFO[role].emoji}</span> {ROLE_INFO[role].label}
            </p>
            <p className="text-sm">{ROLE_INFO[role].can}</p>
          </Card>
        ))}
      </div>
      <Button size="lg" block onClick={() => setAdding(true)} className="mb-5">
        <UserPlus className="size-5" /> Añadir a alguien
      </Button>

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
                      person.role === 'admin' ? 'bg-canela-claro text-canela-oscuro' : 'bg-lavanda text-lavanda-oscuro',
                    )}
                  >
                    {ROLE_INFO[person.role]?.emoji} {person.roleLabel}
                  </span>
                </div>
                {person.id !== me.id && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => reset(person)}>
                      <KeyRound className="size-4" /> Nueva contraseña
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => changeRole(person)}>
                      {person.role === 'admin' ? `Pasar a ${ROLE_INFO.cuidabigotes.label.toLowerCase()}` : `Hacer ${ROLE_INFO.admin.label.toLowerCase()}`}
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

      <AddSheet
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(info) => {
          setAdding(false);
          setPassword(info);
        }}
      />
      <PasswordSheet info={password} onClose={() => setPassword(null)} />
      {dialog}
    </AdminPage>
  );
}
