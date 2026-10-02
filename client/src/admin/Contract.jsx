import { useState } from 'react';
import { FileSignature, Printer } from 'lucide-react';
import { Field, FormError, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { refreshAfterChange, shortDate, useAdminApi } from './common.jsx';
import { PdfLink } from './Papers.jsx';

// Contrato de adopción desde la solicitud: sale relleno con lo que ya dio la
// familia en el formulario más lo que se pide aquí (DNI, dirección…). Al
// guardarlo por primera vez se le da número (A-2026-001).

const FIELDS = ['dni', 'birthDate', 'address', 'postalCode', 'altContactName', 'altContactPhone', 'altContactRelation', 'contractDate'];

function ContractSheet({ app, open, onClose }) {
  const toast = useToast();
  const pristine = { ...Object.fromEntries(FIELDS.map((key) => [key, app.contract[key === 'contractDate' ? 'date' : key] ?? ''])), catId: app.catId ?? null };
  const [form, setForm, draft] = useDraftState(`contrato-${app.id}`, pristine, { storage: 'local', checkBase: true });
  const { data: catsData } = useAdminApi(app.catId ? null : '/gatitos');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const candidates = (catsData?.cats ?? []).filter((c) => ['disponible', 'reservado', 'borrador'].includes(c.status));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(`/admin/solicitudes/${app.id}/contrato`, { method: 'PUT', body: form });
      draft.discard();
      refreshAfterChange();
      toast(app.contract.number ? 'Datos del contrato guardados' : 'Contrato preparado ✍️');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Datos para el contrato">
      <form onSubmit={save} className="grid gap-4" noValidate>
        <p className="text-sm text-cacao-suave">
          Nombre, teléfono, email y localidad ya vienen de la solicitud. Lo que dejes vacío saldrá en blanco para escribirlo a mano.
        </p>
        {!app.catId && (
          <Field label="Gatito que adopta" error={errors.catId}>
            {({ id }) => (
              <select
                id={id}
                value={form.catId ?? ''}
                onChange={(event) => set('catId')(Number(event.target.value) || null)}
                className="w-full appearance-none rounded-2xl border-2 border-borde bg-nata px-4 py-3 text-base focus:border-canela focus:outline-none"
              >
                <option value="">Sin elegir (en blanco)</option>
                {candidates.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                    {cat.record?.fileNumber ? ` · ${cat.record.fileNumber}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="DNI / NIE" optional autoComplete="off" value={form.dni} onChange={set('dni')} error={errors.dni} maxLength={20} />
          <TextInput label="Fecha de nacimiento" optional type="date" value={form.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
        </div>
        <TextInput label="Dirección" optional autoComplete="off" value={form.address} onChange={set('address')} error={errors.address} maxLength={200} />
        <TextInput label="Código postal" optional inputMode="numeric" maxLength={5} value={form.postalCode} onChange={set('postalCode')} error={errors.postalCode} />
        <fieldset className="grid gap-3 rounded-3xl bg-crema p-4">
          <legend className="px-1 font-display text-lg font-semibold">Contacto alternativo</legend>
          <TextInput label="Nombre y apellidos" optional value={form.altContactName} onChange={set('altContactName')} error={errors.altContactName} maxLength={120} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Teléfono" optional type="tel" inputMode="tel" value={form.altContactPhone} onChange={set('altContactPhone')} error={errors.altContactPhone} />
            <TextInput label="Relación" optional placeholder="Hermana, pareja…" value={form.altContactRelation} onChange={set('altContactRelation')} maxLength={60} />
          </div>
        </fieldset>
        <TextInput
          label="Fecha del contrato"
          type="date"
          optional
          hint="Si la dejas vacía, se usa la de hoy."
          value={form.contractDate}
          onChange={set('contractDate')}
          error={errors.contractDate}
        />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          {app.contract.number ? 'Guardar' : 'Preparar contrato'}
        </Button>
      </form>
    </Sheet>
  );
}

export function ContractCard({ app }) {
  const [open, setOpen] = useState(false);
  const { contract } = app;
  return (
    <Card className="grid gap-3 bg-menta">
      <div className="flex items-start gap-3">
        <FileSignature className="size-8 shrink-0 text-menta-oscuro" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Contrato de adopción</h2>
          <p className="text-sm">
            {contract.number
              ? `N.º ${contract.number} · ${shortDate(contract.date)}. Imprime dos copias: una para la familia y otra para la asociación.`
              : 'Añade DNI y dirección y sale relleno, listo para firmar.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {contract.number && (
          <PdfLink path={`/contrato/${app.id}`} variant="primary" size="md" label={`Contrato ${contract.number} en PDF`}>
            <Printer className="size-5" /> Abrir contrato
          </PdfLink>
        )}
        <Button variant={contract.number ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
          {contract.number ? 'Editar datos' : 'Preparar contrato'}
        </Button>
      </div>
      <ContractSheet key={`${app.id}-${open}`} app={app} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
