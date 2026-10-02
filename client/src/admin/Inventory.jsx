import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Minus, Package, Pill, Plus, Printer, Trash2 } from 'lucide-react';
import { Field, FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, EmptyState, ErrorState, Spinner, Tag, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { AdminPage, refreshAfterChange, shortDate, Tabs, todayIso, useAdminApi, useConfirm } from './common.jsx';
import { PdfLink } from './Papers.jsx';

// Inventario en dos listas: medicación (con caducidad e instrucciones) e
// inventario general. Las categorías deben coincidir con
// server/src/routes/adminInventory.js (INVENTORY_CATEGORIES).

export const INVENTORY_CATEGORIES = {
  comida: 'Comida',
  arena: 'Arena',
  higiene: 'Higiene y limpieza',
  veterinario: 'Material veterinario',
  transporte: 'Transportines y jaulas',
  trampas: 'Trampas',
  descanso: 'Camas y mantas',
  juguetes: 'Juguetes y rascadores',
  otros: 'Otros',
};

const EMPTY = {
  name: '',
  category: 'comida',
  quantity: '',
  unit: '',
  minQuantity: '',
  expiresOn: '',
  instructions: '',
  location: '',
  notes: '',
};

const number = (value) => (value === null || value === undefined || value === '' ? '' : Number(value).toLocaleString('es-ES', { maximumFractionDigits: 2 }));
const toInput = (value) => (value === null || value === undefined ? '' : String(value).replace('.', ','));

function daysUntil(date, today) {
  return Math.round((new Date(`${date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86_400_000);
}

/** Etiqueta de caducidad: caducado, caduca pronto o la fecha. */
function Expiry({ date, today }) {
  if (!date) return null;
  const days = daysUntil(date, today);
  if (days < 0) {
    return (
      <Tag tone="melocoton" className="px-2 py-0.5 text-xs">
        Caducado el {shortDate(date)}
      </Tag>
    );
  }
  if (days <= 30) {
    return (
      <Tag tone="mantequilla" className="px-2 py-0.5 text-xs">
        Caduca {days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}
      </Tag>
    );
  }
  return <span className="text-xs text-cacao-suave">Caduca el {shortDate(date)}</span>;
}

function ItemSheet({ kind, item, open, onClose, onSaved, onDelete }) {
  const isNew = !item;
  const pristine = item
    ? {
        ...EMPTY,
        ...item,
        category: item.category || 'otros',
        quantity: toInput(item.quantity),
        minQuantity: toInput(item.minQuantity),
      }
    : EMPTY;
  const [form, setForm, draft] = useDraftState(isNew ? `inventario-nuevo-${kind}` : `inventario-${item.id}`, pristine, {
    storage: 'local',
    checkBase: !isNew,
    omit: ['id', 'kind', 'updatedAt'],
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const medication = kind === 'medicacion';

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, form[key]])), kind };
      const result = await api(isNew ? '/admin/inventario' : `/admin/inventario/${item.id}`, { method: isNew ? 'POST' : 'PUT', body });
      draft.discard();
      if (isNew) setForm(EMPTY);
      refreshAfterChange();
      onSaved(result.item, isNew);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={isNew ? (medication ? 'Nueva medicación' : 'Añadir al inventario') : item.name}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <TextInput
          label={medication ? 'Medicamento' : 'Qué es'}
          placeholder={medication ? 'Milbemax gatitos, Tobrex colirio…' : 'Pienso kitten 2 kg, arena, transportín…'}
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          maxLength={120}
        />
        {!medication && (
          <Field label="Categoría" error={errors.category}>
            {({ id }) => (
              <select
                id={id}
                value={form.category}
                onChange={(event) => set('category')(event.target.value)}
                className="w-full appearance-none rounded-2xl border-2 border-borde bg-nata px-4 py-3 text-base focus:border-canela focus:outline-none"
              >
                {Object.entries(INVENTORY_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Cantidad" inputMode="decimal" placeholder="2" value={form.quantity} onChange={set('quantity')} error={errors.quantity} />
          <TextInput
            label="Unidad"
            optional
            placeholder={medication ? 'comprimidos' : 'sacos'}
            value={form.unit}
            onChange={set('unit')}
            error={errors.unit}
            maxLength={30}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Caduca"
            type="date"
            optional={!medication}
            value={form.expiresOn}
            onChange={set('expiresOn')}
            error={errors.expiresOn}
          />
          <TextInput
            label="Avisar si quedan"
            optional
            inputMode="decimal"
            placeholder="1"
            hint="Sale en «Avisos» del resumen."
            value={form.minQuantity}
            onChange={set('minQuantity')}
            error={errors.minQuantity}
          />
        </div>
        {medication && (
          <TextArea
            label="Instrucciones / pauta"
            rows={3}
            placeholder="Dosis, cada cuánto, con comida o no, cómo se conserva…"
            value={form.instructions}
            onChange={set('instructions')}
            error={errors.instructions}
          />
        )}
        <TextInput label="Dónde está" optional placeholder="Botiquín, almacén, casa de Marta…" value={form.location} onChange={set('location')} maxLength={120} />
        <TextArea label="Notas" optional rows={2} value={form.notes} onChange={set('notes')} error={errors.notes} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          {isNew ? 'Añadir' : 'Guardar cambios'}
        </Button>
        {!isNew && (
          <Button variant="danger" block onClick={() => onDelete(item)}>
            <Trash2 className="size-4" /> Quitar del inventario
          </Button>
        )}
      </form>
    </Sheet>
  );
}

function Stepper({ item, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function change(delta) {
    setBusy(true);
    try {
      const result = await api(`/admin/inventario/${item.id}/cantidad`, { method: 'PATCH', body: { delta } });
      onChange(result.item);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={busy || item.quantity <= 0}
        onClick={() => change(-1)}
        className="grid size-11 place-items-center rounded-full bg-crema disabled:opacity-40"
        aria-label={`Quitar uno de ${item.name}`}
      >
        <Minus className="size-5" />
      </button>
      <span className="min-w-12 text-center font-display text-xl font-semibold" aria-live="polite">
        {number(item.quantity)}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => change(1)}
        className="grid size-11 place-items-center rounded-full bg-crema"
        aria-label={`Añadir uno de ${item.name}`}
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

export default function Inventory() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const kind = params.get('tipo') === 'general' ? 'general' : 'medicacion';
  const { data, error, loading, reload } = useAdminApi(`/inventario?tipo=${kind}`);
  const [editing, setEditing] = useState(null);
  const [ask, dialog] = useConfirm();
  const items = data?.items ?? [];
  const today = data?.today ?? todayIso();
  const current = typeof editing === 'number' ? items.find((i) => i.id === editing) : null;
  const medication = kind === 'medicacion';

  async function remove(item) {
    const ok = await ask({ title: `¿Quitar «${item.name}» del inventario?`, confirmLabel: 'Sí, quitar', danger: true });
    if (!ok) return;
    try {
      await api(`/admin/inventario/${item.id}`, { method: 'DELETE' });
      refreshAfterChange();
      setEditing(null);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  let group = null;
  return (
    <AdminPage
      title="Inventario 📦"
      subtitle="Lo que tiene la asociación: medicación con su caducidad y todo lo demás."
      action={
        <PdfLink path={kind === 'medicacion' ? '/medicacion' : '/inventario'} label="Inventario en PDF">
          <Printer className="size-4" /> PDF
        </PdfLink>
      }
    >
      <Tabs
        value={kind}
        onChange={(value) => setParams(value === 'medicacion' ? {} : { tipo: value }, { replace: true })}
        tabs={[
          { value: 'medicacion', label: '💊 Medicación', count: data?.counts.medicacion },
          { value: 'general', label: '📦 General', count: data?.counts.general },
        ]}
      />
      <Button size="lg" block onClick={() => setEditing('nuevo')} className="mb-5">
        <Plus className="size-5" /> {medication ? 'Añadir medicación' : 'Añadir al inventario'}
      </Button>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && items.length === 0 && (
        <EmptyState title={medication ? 'El botiquín está vacío' : 'Aún no hay nada apuntado'} tone={medication ? 'melocoton' : 'mantequilla'}>
          {medication
            ? 'Apunta cada medicamento con su caducidad y cómo se da: te avisaremos antes de que caduque.'
            : 'Apunta comida, arena, transportines o trampas para saber qué hay y qué falta.'}
        </EmptyState>
      )}
      <ul className="grid gap-2">
        {items.map((item) => {
          const low = item.minQuantity !== null && item.quantity <= item.minQuantity;
          const header = !medication && item.category !== group;
          group = item.category;
          return (
            <li key={item.id} className="grid gap-2">
              {header && <h2 className="mt-3 font-display text-lg font-semibold">{INVENTORY_CATEGORIES[item.category] ?? 'Otros'}</h2>}
              <Card className={cx('flex items-center gap-3 p-3', low && 'ring-2 ring-mantequilla-oscuro/30')}>
                <span className={cx('hidden size-11 shrink-0 place-items-center rounded-2xl sm:grid', medication ? 'bg-melocoton text-melocoton-oscuro' : 'bg-mantequilla text-mantequilla-oscuro')}>
                  {medication ? <Pill className="size-5" aria-hidden /> : <Package className="size-5" aria-hidden />}
                </span>
                <button type="button" onClick={() => setEditing(item.id)} className="min-w-0 flex-1 text-left">
                  <span className="block font-bold leading-tight">{item.name}</span>
                  <span className="block text-sm text-cacao-suave">
                    {[item.unit, item.location].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Expiry date={item.expiresOn} today={today} />
                    {low && (
                      <Tag tone="mantequilla" className="px-2 py-0.5 text-xs">
                        Queda poco
                      </Tag>
                    )}
                  </span>
                  {medication && item.instructions && <span className="mt-1 line-clamp-2 block text-sm">{item.instructions}</span>}
                </button>
                <Stepper item={item} onChange={() => refreshAfterChange()} />
              </Card>
            </li>
          );
        })}
      </ul>

      <ItemSheet
        key={`${kind}-${editing ?? 'cerrada'}`}
        kind={kind}
        item={current}
        open={editing === 'nuevo' || Boolean(current)}
        onClose={() => setEditing(null)}
        onDelete={remove}
        onSaved={(item, isNew) => {
          setEditing(null);
          toast(isNew ? `«${item.name}» añadido` : 'Cambios guardados');
        }}
      />
      {dialog}
    </AdminPage>
  );
}
