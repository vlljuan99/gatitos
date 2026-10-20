import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { Choice, Field, FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, EmptyState, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { AdminPage, isAdmin, refreshAfterChange, shortDate, Tabs, todayIso, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { PdfLink } from './Papers.jsx';

// Registro de donaciones de dinero y de material. Las formas de pago deben
// coincidir con server/src/routes/adminDonations.js (DONATION_METHODS).

export const DONATION_METHODS = {
  efectivo: 'Efectivo',
  bizum: 'Bizum',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta / TPV',
  paypal: 'PayPal',
  teaming: 'Teaming',
  otro: 'Otra',
};

const EMPTY = { date: '', kind: 'dinero', donorName: '', donorContact: '', amount: '', method: 'bizum', description: '', notes: '' };
export const euros = (value) =>
  value === null || value === undefined ? '' : `${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function DonationSheet({ donation, open, onClose, onSaved, onDelete, canDelete }) {
  const isNew = !donation;
  const pristine = donation
    ? { ...EMPTY, ...donation, amount: donation.amount === null ? '' : String(donation.amount).replace('.', ','), method: donation.method || 'bizum' }
    : EMPTY;
  const [form, setForm, draft] = useDraftState(isNew ? 'donacion-nueva' : `donacion-${donation.id}`, pristine, {
    storage: 'local',
    checkBase: !isNew,
    omit: ['id', 'createdAt'],
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const money = form.kind === 'dinero';

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, form[key]])), date: form.date || todayIso() };
      const result = await api(isNew ? '/admin/donaciones' : `/admin/donaciones/${donation.id}`, { method: isNew ? 'POST' : 'PUT', body });
      draft.discard();
      if (isNew) setForm(EMPTY);
      refreshAfterChange();
      onSaved(result.donation, isNew);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'Nueva donación 💝' : 'Donación'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <Choice
          label="¿Qué han donado?"
          columns
          options={[
            { value: 'dinero', label: 'Dinero', emoji: '💶' },
            { value: 'material', label: 'Material', emoji: '🎁' },
          ]}
          value={form.kind}
          onChange={set('kind')}
        />
        {money ? (
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Importe (€)" inputMode="decimal" placeholder="20" value={form.amount} onChange={set('amount')} error={errors.amount} />
            <Field label="Forma de pago" error={errors.method}>
              {({ id }) => (
                <select
                  id={id}
                  value={form.method}
                  onChange={(event) => set('method')(event.target.value)}
                  className="w-full appearance-none rounded-2xl border-2 border-borde bg-nata px-4 py-3 text-base focus:border-canela focus:outline-none"
                >
                  {Object.entries(DONATION_METHODS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        ) : (
          <TextInput
            label="¿Qué es?"
            placeholder="3 sacos de pienso kitten, mantas, un transportín…"
            value={form.description}
            onChange={set('description')}
            error={errors.description}
            maxLength={300}
          />
        )}
        <TextInput label="Fecha" type="date" value={form.date || todayIso()} onChange={set('date')} error={errors.date} max={todayIso()} />
        <TextInput label="Quién lo dona" optional hint="Déjalo vacío si es anónimo." value={form.donorName} onChange={set('donorName')} error={errors.donorName} maxLength={120} />
        <TextInput
          label="Contacto"
          optional
          hint="Teléfono o email, para darle las gracias."
          value={form.donorContact}
          onChange={set('donorContact')}
          error={errors.donorContact}
          maxLength={120}
        />
        {money && (
          <TextInput label="Concepto" optional placeholder="Para la esterilización de la colonia…" value={form.description} onChange={set('description')} maxLength={300} />
        )}
        <TextArea label="Notas" optional rows={2} value={form.notes} onChange={set('notes')} error={errors.notes} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          {isNew ? 'Apuntar donación' : 'Guardar cambios'}
        </Button>
        {!isNew && canDelete && (
          <Button variant="danger" block onClick={() => onDelete(donation)}>
            <Trash2 className="size-4" /> Borrar donación
          </Button>
        )}
      </form>
    </Sheet>
  );
}

export default function Donations() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const year = /^\d{4}$/.test(params.get('anio') ?? '') ? Number(params.get('anio')) : new Date().getFullYear();
  const { data, error, loading, reload } = useAdminApi(`/donaciones?anio=${year}`);
  const [editing, setEditing] = useState(null);
  const [ask, dialog] = useConfirm();
  const donations = data?.donations ?? [];
  const current = typeof editing === 'number' ? donations.find((d) => d.id === editing) : null;

  async function remove(donation) {
    const ok = await ask({ title: '¿Borrar esta donación?', body: 'Desaparece del registro y de las cuentas del año.', confirmLabel: 'Sí, borrar', danger: true });
    if (!ok) return;
    try {
      await api(`/admin/donaciones/${donation.id}`, { method: 'DELETE' });
      refreshAfterChange();
      setEditing(null);
      toast('Donación borrada');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <AdminPage
      title="Donaciones 💝"
      subtitle="Lo que nos dan, en dinero o en material. Para rendir cuentas y dar las gracias."
      action={
        <PdfLink path={`/donaciones?desde=${year}-01-01&hasta=${year}-12-31`} label={`Donaciones de ${year} en PDF`}>
          <Printer className="size-4" /> PDF
        </PdfLink>
      }
    >
      {data && data.years.length > 1 && (
        <Tabs
          value={String(year)}
          onChange={(value) => setParams(Number(value) === new Date().getFullYear() ? {} : { anio: value }, { replace: true })}
          tabs={data.years.map((y) => ({ value: String(y), label: String(y) }))}
        />
      )}
      <Button size="lg" block onClick={() => setEditing('nueva')} className="mb-5">
        <Plus className="size-5" /> Apuntar donación
      </Button>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="mb-5 grid grid-cols-3 gap-2">
          {[
            ['Dinero en ' + year, euros(data.totals.money)],
            ['Donaciones de dinero', data.totals.moneyCount],
            ['De material', data.totals.materialCount],
          ].map(([label, value]) => (
            <Card key={label} className="bg-menta p-3 text-menta-oscuro">
              <p className="font-display text-xl font-semibold leading-tight">{value}</p>
              <p className="text-xs font-bold">{label}</p>
            </Card>
          ))}
        </div>
      )}
      {data && donations.length === 0 && (
        <EmptyState title={`Sin donaciones en ${year}`} tone="menta">
          Apunta cada donación, aunque sea pequeña: al final de año tendréis las cuentas hechas.
        </EmptyState>
      )}
      <ul className="grid gap-2">
        {donations.map((donation) => (
          <li key={donation.id}>
            <button type="button" onClick={() => setEditing(donation.id)} className="flex w-full items-center gap-3 rounded-3xl bg-nata p-3 text-left shadow-suave">
              <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl text-xl', donation.kind === 'dinero' ? 'bg-menta' : 'bg-lavanda')} aria-hidden>
                {donation.kind === 'dinero' ? '💶' : '🎁'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{donation.donorName || 'Anónimo'}</span>
                <span className="block truncate text-sm text-cacao-suave">
                  {[shortDate(donation.date), donation.kind === 'dinero' ? DONATION_METHODS[donation.method] : null, donation.description]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {donation.kind === 'dinero' && <span className="shrink-0 font-display text-lg font-semibold">{euros(donation.amount)}</span>}
            </button>
          </li>
        ))}
      </ul>

      <DonationSheet
        key={editing ?? 'cerrada'}
        donation={current}
        open={editing === 'nueva' || Boolean(current)}
        onClose={() => setEditing(null)}
        onDelete={remove}
        canDelete={isAdmin(user)}
        onSaved={(donation, isNew) => {
          setEditing(null);
          toast(isNew ? '¡Apuntada! Gracias a quien la ha hecho 💝' : 'Cambios guardados');
        }}
      />
      {dialog}
    </AdminPage>
  );
}

