import { useState } from 'react';
import { Eye, Pencil, Printer, Stethoscope, Trash2 } from 'lucide-react';
import { Checkbox, FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, Spinner, Tag } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { gendered } from '../lib/cats.js';
import { useDraftState } from '../lib/drafts.js';
import { refreshAfterChange, shortDate, todayIso as today, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { PdfLink } from './paperLinks.jsx';
import { PdfPreview } from './PdfPreview.jsx';

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

/**
 * Atajos para lo que más se apunta. Con mark, al guardar se marca también en
 * su ficha (vacunado, esterilizado…), que es lo que sale en la web.
 */
export const NOTE_PRESETS = [
  { key: 'nota', emoji: '📝', label: 'Nota', text: '', placeholder: 'Ya come solo, se deja coger, toca segunda vacuna…' },
  { key: 'vacuna', emoji: '💉', label: 'Vacuna', text: 'Vacuna: ', placeholder: 'Vacuna: trivalente, 1.ª dosis', mark: 'vaccinated', flag: 'vacunado' },
  { key: 'desparasitacion', emoji: '🛡️', label: 'Desparasitación', text: 'Desparasitación: ', placeholder: 'Desparasitación: interna y externa', mark: 'dewormed', flag: 'desparasitado' },
  { key: 'esterilizacion', emoji: '✂️', label: 'Esterilización', text: 'Esterilización', mark: 'sterilized', flag: 'esterilizado' },
  { key: 'microchip', emoji: '🔖', label: 'Microchip', text: 'Microchip puesto', mark: 'microchipped', flag: 'con microchip' },
  { key: 'peso', emoji: '⚖️', label: 'Peso', text: 'Peso: ', placeholder: 'Peso: 1,2 kg' },
  { key: 'medicacion', emoji: '💊', label: 'Medicación', text: 'Medicación: ', placeholder: 'Medicación: antibiótico 5 días' },
];

/** Nota con fecha (la de hoy por defecto), con el texto del atajo ya escrito. */
function NoteSheet({ cat, preset = NOTE_PRESETS[0], open, onClose, onSaved }) {
  const [form, setForm, draft] = useDraftState(
    `nota-gato-${cat.id}${preset.key === 'nota' ? '' : `-${preset.key}`}`,
    { date: '', body: preset.text, mark: true },
    { storage: 'local' },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Solo se ofrece marcarlo si aún no lo está.
  const canMark = Boolean(preset.mark) && !cat.health?.[preset.mark];

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { date: form.date || today(), body: form.body, ...(canMark && form.mark ? { mark: preset.mark } : {}) };
      const result = await api(`/admin/gatitos/${cat.id}/historial`, { method: 'POST', body });
      draft.discard();
      setForm({ date: '', body: preset.text, mark: true });
      onSaved(result);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={preset.key === 'nota' ? 'Apuntar en su seguimiento' : `${preset.emoji} ${preset.label}`}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <TextArea
          label={preset.key === 'nota' ? '¿Qué ha pasado?' : 'Detalles'}
          rows={3}
          placeholder={preset.placeholder}
          value={form.body}
          onChange={(v) => setForm({ ...form, body: v })}
          error={errors.body}
          autoFocus
          onFocus={(event) => event.target.setSelectionRange(event.target.value.length, event.target.value.length)}
        />
        <TextInput label="Fecha" type="date" value={form.date || today()} onChange={(v) => setForm({ ...form, date: v })} error={errors.date} max={today()} />
        {canMark && (
          <Checkbox checked={form.mark} onChange={(v) => setForm({ ...form, mark: v })}>
            Marcar a {cat.name} como <strong>{gendered(preset.flag, cat.sex)}</strong> en su ficha
          </Checkbox>
        )}
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          Guardar
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

/**
 * Seguimiento del gato: atajos para apuntar, la línea de tiempo con notas y
 * visitas al veterinario, y la ficha de seguimiento para verla o imprimirla.
 * El parte y las notas se pueden abrir también desde fuera (noting/reportOpen).
 */
export function CatHistory({ cat, reportOpen, onReportOpen, onReportClose, carrier, noting, onNote, onNoteClose, onMarked }) {
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi(`/gatitos/${cat.id}/historial`);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(false);
  const [ask, dialog] = useConfirm();
  const preset = NOTE_PRESETS.find((p) => p.key === noting) ?? NOTE_PRESETS[0];

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

  const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-crema px-3.5 font-bold transition hover:bg-canela-claro';

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">Seguimiento e historial</h2>
          <p className="text-sm text-cacao-suave">Solo lo ve el equipo. Todo sale en su ficha de seguimiento.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setViewing(true)} aria-label="Ver la ficha de seguimiento">
          <Eye className="size-4" /> Ver ficha
        </Button>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-cacao-suave">Apuntar con un toque</p>
        <div className="flex flex-wrap gap-2">
          {NOTE_PRESETS.map((p) => (
            <button key={p.key} type="button" className={chip} onClick={() => onNote(p.key)}>
              <span aria-hidden>{p.emoji}</span> {p.label}
            </button>
          ))}
          <button type="button" className={chip} onClick={onReportOpen}>
            <span aria-hidden>🩺</span> Nuevo parte
          </button>
        </div>
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
        key={preset.key}
        cat={cat}
        preset={preset}
        open={Boolean(noting)}
        onClose={onNoteClose}
        onSaved={(result) => {
          onNoteClose();
          reload();
          if (result.marked) onMarked?.(result.marked);
          toast(result.marked ? `Apuntado y marcado en su ficha ✍️` : 'Apuntado en su seguimiento ✍️');
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
      <PdfPreview
        path={`/gatito/${cat.id}/seguimiento`}
        title="Ficha de seguimiento"
        a5
        open={viewing}
        onClose={() => setViewing(false)}
      />
      {dialog}
    </Card>
  );
}
