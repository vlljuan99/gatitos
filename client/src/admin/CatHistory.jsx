import { useState } from 'react';
import { NotebookPen, Pencil, Printer, Stethoscope, Trash2 } from 'lucide-react';
import { FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, Spinner, Tag } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { refreshAfterChange, shortDate, todayIso as today, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { PdfLink } from './Papers.jsx';

// Historial de un gato en su ficha del panel: notas con fecha y visitas al
// veterinario. Cada visita nace con su parte numerado (sin parte, la clínica
// no atiende a cargo de la asociación) y al volver se completa con lo que
// hizo la clínica. Todo sale en la ficha de seguimiento y en la ficha del gato.

const EMPTY_VISIT = {
  date: '',
  carrierName: '',
  carrierPhone: '',
  clinic: '',
  diagnosis: '',
  tests: '',
  treatment: '',
  medication: '',
  nextCheck: '',
  amount: '',
};

const visitDone = (visit) => Boolean(visit.clinic || visit.diagnosis || visit.treatment || visit.tests);

/** Nota con fecha (la de hoy por defecto). */
function NoteSheet({ catId, open, onClose, onSaved }) {
  const [form, setForm, draft] = useDraftState(`nota-gato-${catId}`, { date: '', body: '' }, { storage: 'local' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api(`/admin/gatitos/${catId}/historial`, { method: 'POST', body: { ...form, date: form.date || today() } });
      draft.discard();
      setForm({ date: '', body: '' });
      onSaved(result);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Apuntar en su historial">
      <form onSubmit={save} className="grid gap-4" noValidate>
        <TextArea
          label="¿Qué ha pasado?"
          rows={4}
          placeholder="Ya come solo, se deja coger, toca segunda vacuna…"
          value={form.body}
          onChange={(v) => setForm({ ...form, body: v })}
          error={errors.body}
        />
        <TextInput label="Fecha" type="date" value={form.date || today()} onChange={(v) => setForm({ ...form, date: v })} error={errors.date} max={today()} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          Guardar nota
        </Button>
      </form>
    </Sheet>
  );
}

/** Nuevo parte veterinario: quién lleva al gato. Al crearlo se ofrece el PDF. */
export function NewReportSheet({ cat, open, onClose, onCreated, defaults }) {
  const [form, setForm] = useState(null);
  const [created, setCreated] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const values = form ?? { date: today(), carrierName: defaults?.name ?? '', carrierPhone: defaults?.phone ?? '' };

  function close() {
    setForm(null);
    setCreated(null);
    setErrors({});
    setError('');
    onClose();
  }

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api(`/admin/gatitos/${cat.id}/veterinario`, { method: 'POST', body: values });
      setCreated(result.visit);
      onCreated(result);
      refreshAfterChange();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title={created ? `Parte ${created.number} listo 🩺` : 'Nuevo parte veterinario'}>
      {created ? (
        <div className="grid gap-3">
          <p className="text-cacao-suave">
            Imprímelo y que vaya con {cat.name} a la clínica. Sin parte, la clínica no atiende a cargo de la asociación. Al volver,
            completa en su historial lo que le han hecho.
          </p>
          <PdfLink path={`/parte/${created.id}`} variant="primary" size="lg" block>
            <Printer className="size-5" /> Abrir el parte
          </PdfLink>
          <PdfLink path={`/parte/${created.id}`} twoUp size="md" block>
            Dos por folio A4
          </PdfLink>
          <Button variant="ghost" block onClick={close}>
            Hecho
          </Button>
        </div>
      ) : (
        <form onSubmit={create} className="grid gap-4" noValidate>
          <p className="text-sm text-cacao-suave">Se le dará el siguiente número de parte del año.</p>
          <TextInput
            label="¿Quién lo lleva?"
            autoComplete="off"
            value={values.carrierName}
            onChange={(v) => setForm({ ...values, carrierName: v })}
            error={errors.carrierName}
          />
          <TextInput
            label="Su teléfono"
            type="tel"
            inputMode="tel"
            optional
            value={values.carrierPhone}
            onChange={(v) => setForm({ ...values, carrierPhone: v })}
            error={errors.carrierPhone}
          />
          <TextInput label="Fecha" type="date" value={values.date} onChange={(v) => setForm({ ...values, date: v })} error={errors.date} />
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" block loading={saving}>
            <Stethoscope className="size-5" /> Crear parte
          </Button>
        </form>
      )}
    </Sheet>
  );
}

/** Lo que hizo la clínica (y los datos del parte, por si hay que corregirlos). */
function VisitSheet({ cat, visit, onClose, onSaved }) {
  const [form, setForm, draft] = useDraftState(
    visit ? `visita-${visit.id}` : null,
    visit ? { ...EMPTY_VISIT, ...visit, amount: visit.amount === null ? '' : String(visit.amount).replace('.', ',') } : EMPTY_VISIT,
    { storage: 'local', checkBase: true },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const set = (key) => (value) => setForm({ ...form, [key]: value });

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api(`/admin/gatitos/${cat.id}/veterinario/${visit.id}`, { method: 'PUT', body: form });
      draft.discard();
      onSaved(result);
      refreshAfterChange();
      toast('Visita guardada 🩺');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(visit)} onClose={onClose} title={visit ? `Visita del parte ${visit.number}` : ''}>
      {visit && (
        <form onSubmit={save} className="grid gap-4" noValidate>
          <TextInput label="Clínica" value={form.clinic} onChange={set('clinic')} error={errors.clinic} />
          <TextArea label="Estado general / diagnóstico" rows={2} value={form.diagnosis} onChange={set('diagnosis')} error={errors.diagnosis} />
          <TextArea label="Pruebas realizadas" optional rows={2} value={form.tests} onChange={set('tests')} error={errors.tests} />
          <TextArea label="Tratamiento" optional rows={2} value={form.treatment} onChange={set('treatment')} error={errors.treatment} />
          <TextArea label="Medicación y pauta" optional rows={2} value={form.medication} onChange={set('medication')} error={errors.medication} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Próxima revisión" optional type="date" value={form.nextCheck} onChange={set('nextCheck')} error={errors.nextCheck} />
            <TextInput label="Importe (€)" optional inputMode="decimal" placeholder="35,50" value={form.amount} onChange={set('amount')} error={errors.amount} />
          </div>
          <details className="rounded-2xl bg-crema p-3">
            <summary className="cursor-pointer font-bold">Datos del parte</summary>
            <div className="mt-3 grid gap-3">
              <TextInput label="Fecha" type="date" value={form.date} onChange={set('date')} error={errors.date} />
              <TextInput label="Quién lo llevó" value={form.carrierName} onChange={set('carrierName')} error={errors.carrierName} />
              <TextInput label="Su teléfono" type="tel" value={form.carrierPhone} onChange={set('carrierPhone')} error={errors.carrierPhone} />
            </div>
          </details>
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" block loading={saving}>
            Guardar
          </Button>
        </form>
      )}
    </Sheet>
  );
}

export function CatHistory({ cat, reportOpen, onReportOpen, onReportClose, carrier }) {
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi(`/gatitos/${cat.id}/historial`);
  const [noting, setNoting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [ask, dialog] = useConfirm();

  const items = data
    ? [
        ...data.entries.map((entry) => ({ type: 'nota', key: `n${entry.id}`, date: entry.date, created: entry.createdAt, entry })),
        ...data.visits.map((visit) => ({ type: 'visita', key: `v${visit.id}`, date: visit.date, created: visit.createdAt, visit })),
      ].sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created))
    : [];

  async function removeEntry(entry) {
    const ok = await ask({ title: '¿Borrar esta nota?', confirmLabel: 'Sí, borrarla', danger: true });
    if (!ok) return;
    try {
      await api(`/admin/gatitos/${cat.id}/historial/${entry.id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function removeVisit(visit) {
    const ok = await ask({
      title: `¿Borrar el parte ${visit.number}?`,
      body: 'Si ya se imprimió y se usó en la clínica, mejor déjalo: es el registro de lo que se ha pagado.',
      confirmLabel: 'Sí, borrarlo',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/gatitos/${cat.id}/veterinario/${visit.id}`, { method: 'DELETE' });
      reload();
      refreshAfterChange();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Historial y veterinario</h2>
        <p className="text-sm text-cacao-suave">Solo lo ve el equipo. Sale en su ficha de seguimiento.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => setNoting(true)}>
          <NotebookPen className="size-5" /> Apuntar
        </Button>
        <Button variant="soft" onClick={onReportOpen}>
          <Stethoscope className="size-5" /> Nuevo parte
        </Button>
      </div>
      {loading && <Spinner />}
      {error && <p className="text-canela-oscuro">{error.message}</p>}
      {data && items.length === 0 && <p className="text-cacao-suave">Todavía no hay nada apuntado.</p>}
      {items.length > 0 && (
        <ol className="grid gap-3 border-l-2 border-canela-claro pl-4">
          {items.map((item) =>
            item.type === 'nota' ? (
              <li key={item.key} className="grid gap-1">
                <p className="flex items-center gap-2 text-xs font-bold text-cacao-suave">
                  {shortDate(item.date)} · {item.entry.author}
                  <button
                    type="button"
                    onClick={() => removeEntry(item.entry)}
                    className="ml-auto grid size-9 place-items-center rounded-full text-cacao-suave hover:bg-cacao/5"
                    aria-label="Borrar nota"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </p>
                <p className="whitespace-pre-line">{item.entry.body}</p>
              </li>
            ) : (
              <li key={item.key} className="grid gap-2 rounded-2xl bg-crema p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Stethoscope className="size-4 text-melocoton-oscuro" aria-hidden />
                  <span className="font-bold">Parte {item.visit.number}</span>
                  <span className="text-sm text-cacao-suave">{shortDate(item.date)}</span>
                  {!visitDone(item.visit) && (
                    <Tag tone="mantequilla" className="px-2 py-0.5 text-xs">
                      Falta completar
                    </Tag>
                  )}
                </div>
                {visitDone(item.visit) && (
                  <p className="text-sm">
                    {[item.visit.clinic, item.visit.diagnosis, item.visit.treatment && `Tratamiento: ${item.visit.treatment}`]
                      .filter(Boolean)
                      .join(' · ')}
                    {item.visit.nextCheck && <strong className="block">Próxima revisión: {shortDate(item.visit.nextCheck)}</strong>}
                  </p>
                )}
                {item.visit.carrierName && <p className="text-xs text-cacao-suave">Lo llevó {item.visit.carrierName}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={visitDone(item.visit) ? 'secondary' : 'primary'} onClick={() => setEditing(item.visit)}>
                    <Pencil className="size-4" /> {visitDone(item.visit) ? 'Editar' : 'Completar'}
                  </Button>
                  <PdfLink path={`/parte/${item.visit.id}`} label={`Parte ${item.visit.number} en PDF`}>
                    <Printer className="size-4" /> Parte
                  </PdfLink>
                  <Button size="sm" variant="ghost" onClick={() => removeVisit(item.visit)} aria-label={`Borrar parte ${item.visit.number}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      <NoteSheet
        catId={cat.id}
        open={noting}
        onClose={() => setNoting(false)}
        onSaved={() => {
          setNoting(false);
          reload();
          toast('Apuntado en su historial ✍️');
        }}
      />
      <NewReportSheet
        cat={cat}
        open={reportOpen}
        onClose={onReportClose}
        defaults={carrier ?? { name: user.name }}
        onCreated={() => reload()}
      />
      <VisitSheet
        key={editing?.id ?? 'ninguna'}
        cat={cat}
        visit={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      {dialog}
    </Card>
  );
}
