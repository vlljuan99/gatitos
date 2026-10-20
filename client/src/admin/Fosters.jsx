import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { House, Pencil, Phone, Printer, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { Checkbox, FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { gendered } from '../lib/cats.js';
import { AdminPage, isAdmin, refreshAfterChange, shortDate, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { PdfLink } from './Papers.jsx';

// Casas de acogida: personas voluntarias que cuidan gatos en su casa. Sus
// datos (con DNI y dirección) van al acuerdo de acogida y al compromiso de
// confidencialidad; solo los ve el equipo.

const EMPTY = { name: '', dni: '', phone: '', email: '', address: '', notes: '', active: true };

function FosterSheet({ foster, prefill, open, onClose, onSaved }) {
  const isNew = !foster;
  const pristine = foster ? { ...EMPTY, ...foster } : { ...EMPTY, ...prefill };
  const [form, setForm, draft] = useDraftState(isNew ? 'acogida-nueva' : `acogida-${foster.id}`, pristine, {
    storage: 'local',
    checkBase: !isNew,
    omit: ['cats', 'id', 'createdAt'],
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = Object.fromEntries(Object.keys(EMPTY).map((key) => [key, form[key]]));
      const result = await api(isNew ? '/admin/acogidas' : `/admin/acogidas/${foster.id}`, { method: isNew ? 'POST' : 'PUT', body });
      draft.discard();
      if (isNew) setForm(EMPTY);
      refreshAfterChange();
      onSaved(result.foster, isNew);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'Nueva casa de acogida' : foster.name}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <TextInput label="Nombre y apellidos" autoComplete="off" value={form.name} onChange={set('name')} error={errors.name} maxLength={120} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="DNI / NIE" optional autoComplete="off" value={form.dni} onChange={set('dni')} error={errors.dni} maxLength={20} />
          <TextInput label="Teléfono" optional type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} maxLength={30} />
        </div>
        <TextInput label="Email" optional type="email" inputMode="email" value={form.email} onChange={set('email')} error={errors.email} />
        <TextInput label="Dirección" optional value={form.address} onChange={set('address')} error={errors.address} maxLength={300} />
        <TextArea
          label="Notas"
          optional
          rows={3}
          hint="Otros animales en casa, si puede con gatitos bebé, disponibilidad…"
          value={form.notes}
          onChange={set('notes')}
          error={errors.notes}
        />
        {!isNew && (
          <Checkbox checked={form.active} onChange={set('active')}>
            <strong>Disponible para acoger</strong> <span className="text-cacao-suave">Si lo quitas, deja de salir al elegir casa en la ficha de un gato.</span>
          </Checkbox>
        )}
        <p className="text-sm text-cacao-suave">Estos datos salen en el acuerdo de acogida. Solo los ve el equipo.</p>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          {isNew ? 'Añadir casa de acogida' : 'Guardar cambios'}
        </Button>
      </form>
    </Sheet>
  );
}

export default function Fosters() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, error, loading, reload } = useAdminApi('/acogidas');
  // Desde Voluntariado se puede llegar con los datos de alguien ya puestos.
  const [prefill, setPrefill] = useState(() => location.state?.prefill ?? null);
  const [editing, setEditing] = useState(() => (prefill ? 'nueva' : null));
  const [ask, dialog] = useConfirm();

  useEffect(() => {
    if (location.state?.prefill) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const fosters = data?.fosters ?? [];
  const current = typeof editing === 'number' ? fosters.find((f) => f.id === editing) : null;

  async function remove(foster) {
    const ok = await ask({
      title: `¿Borrar a ${foster.name}?`,
      body: 'Se borran sus datos para siempre (si lo pide, es su derecho). Sus gatos se quedan sin casa de acogida asignada.',
      confirmLabel: 'Sí, borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/acogidas/${foster.id}`, { method: 'DELETE' });
      refreshAfterChange();
      toast(`${foster.name} borrada`);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <AdminPage title="Casas de acogida 🏠" subtitle="Personas que cuidan gatos en su casa mientras encuentran familia.">
      <Button size="lg" block onClick={() => setEditing('nueva')} className="mb-5">
        <UserPlus className="size-5" /> Añadir casa de acogida
      </Button>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && fosters.length === 0 && (
        <EmptyState title="Aún no hay casas de acogida" tone="menta">
          Apunta aquí a quien acoge gatos en su casa: así su acuerdo de acogida sale ya relleno.
        </EmptyState>
      )}
      <ul className="grid gap-3">
        {fosters.map((foster) => (
          <li key={foster.id}>
            <Card className={cx('grid gap-3', !foster.active && 'opacity-70')}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-menta text-menta-oscuro">
                  <House className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{foster.name}</p>
                  <p className="text-sm text-cacao-suave">
                    {[foster.phone, foster.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                    {!foster.active && ' · No disponible'}
                  </p>
                  {foster.notes && <p className="mt-1 whitespace-pre-line text-sm">{foster.notes}</p>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditing(foster.id)} aria-label={`Editar ${foster.name}`}>
                  <Pencil className="size-4" />
                </Button>
              </div>
              {foster.cats.length > 0 ? (
                <ul className="grid gap-2">
                  {foster.cats.map((cat) => (
                    <li key={cat.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-crema p-2 pl-3">
                      <Link to={`/admin/gatitos/${cat.id}`} className="min-w-0 flex-1 font-bold underline">
                        {cat.name}
                      </Link>
                      <span className="text-xs text-cacao-suave">
                        {gendered('acogido', cat.sex)} desde {shortDate(cat.since)}
                      </span>
                      <PdfLink path={`/gatito/${cat.id}/acogida`} label={`Acuerdo de acogida de ${cat.name}`}>
                        <Printer className="size-4" /> Acuerdo
                      </PdfLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-cacao-suave">Ahora mismo no tiene gatos. Se le asignan desde la ficha de cada gato.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {foster.phone && (
                  <>
                    <a href={`tel:${foster.phone.replace(/\s/g, '')}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-nata px-3.5 text-sm font-bold shadow-suave">
                      <Phone className="size-4" /> Llamar
                    </a>
                    <a
                      href={whatsappUrl(foster.phone, `¡Hola, ${foster.name.split(' ')[0]}! 🐾`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-nata px-3.5 text-sm font-bold shadow-suave"
                    >
                      <WhatsAppIcon /> WhatsApp
                    </a>
                  </>
                )}
                <PdfLink path={`/confidencialidad/acogida/${foster.id}`} label={`Compromiso de confidencialidad de ${foster.name}`}>
                  <ShieldCheck className="size-4" /> Confidencialidad
                </PdfLink>
                {isAdmin(user) && (
                  <Button size="sm" variant="ghost" onClick={() => remove(foster)} aria-label={`Borrar a ${foster.name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <FosterSheet
        key={editing ?? 'cerrada'}
        foster={current}
        prefill={prefill}
        open={Boolean(editing) && (editing === 'nueva' || Boolean(current))}
        onClose={() => {
          setEditing(null);
          setPrefill(null);
        }}
        onSaved={(foster, isNew) => {
          setEditing(null);
          setPrefill(null);
          toast(isNew ? `${foster.name} ya está en la lista 🏠` : 'Cambios guardados');
        }}
      />
      {dialog}
    </AdminPage>
  );
}
