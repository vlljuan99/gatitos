import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { FormError, TextArea, TextInput } from '../components/form.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, ErrorState, Spinner } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { AdminPage, isAdmin, refreshAfterChange, useAdminApi, useAuth } from './common.jsx';

/** Lista editable (pasos, requisitos, preguntas): añadir, quitar y reordenar. */
function ListEditor({ items, onChange, empty, render, addLabel }) {
  const move = (index, delta) => {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-2xl border-2 border-borde bg-crema p-3">
          {render(item, (value) => onChange(items.map((it, i) => (i === index ? value : it))), index)}
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Subir">
              <ArrowUp className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="Bajar">
              <ArrowDown className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto text-fresa-oscuro" onClick={() => onChange(items.filter((_, i) => i !== index))}>
              <Trash2 className="size-4" /> Quitar
            </Button>
          </div>
        </div>
      ))}
      <Button variant="soft" onClick={() => onChange([...items, empty])}>
        <Plus className="size-4" /> {addLabel}
      </Button>
    </div>
  );
}

const SECTIONS = [
  {
    key: 'home',
    title: 'Portada',
    emoji: '🏠',
    render: (v, set) => (
      <>
        <TextInput label="Titular" value={v.heroTitle} onChange={(x) => set({ ...v, heroTitle: x })} maxLength={120} />
        <TextArea label="Texto de bienvenida" rows={3} value={v.heroText} onChange={(x) => set({ ...v, heroText: x })} maxLength={400} />
        <TextInput
          label="Gatitos rescatados antes de la web"
          type="number"
          inputMode="numeric"
          min={0}
          hint="Se suma a los gatitos subidos a la web en el contador de «gatitos rescatados»."
          value={v.rescuedBase}
          onChange={(x) => set({ ...v, rescuedBase: x === '' ? 0 : Number(x) })}
        />
      </>
    ),
  },
  {
    key: 'about',
    title: 'Quiénes somos',
    emoji: '💕',
    render: (v, set) => <TextArea label="Presentación (sale en «Cómo trabajamos»)" rows={5} value={v.intro} onChange={(x) => set({ ...v, intro: x })} />,
  },
  {
    key: 'process',
    title: 'Cómo trabajamos',
    emoji: '🩺',
    render: (v, set) => (
      <ListEditor
        items={v.steps}
        onChange={(steps) => set({ ...v, steps })}
        empty={{ title: '', text: '' }}
        addLabel="Añadir paso"
        render={(step, update, i) => (
          <>
            <TextInput label={`Paso ${i + 1}`} value={step.title} onChange={(x) => update({ ...step, title: x })} maxLength={80} />
            <TextArea label="Explicación" rows={3} value={step.text} onChange={(x) => update({ ...step, text: x })} />
          </>
        )}
      />
    ),
  },
  {
    key: 'adoption',
    title: 'Requisitos y cuota',
    emoji: '📝',
    render: (v, set) => (
      <>
        <div>
          <p className="mb-2 font-bold">Requisitos para adoptar</p>
          <ListEditor
            items={v.requirements}
            onChange={(requirements) => set({ ...v, requirements })}
            empty=""
            addLabel="Añadir requisito"
            render={(req, update, i) => <TextInput label={`Requisito ${i + 1}`} value={req} onChange={update} />}
          />
        </div>
        <TextArea label="¿Cómo se van a casa?" rows={3} value={v.delivery} onChange={(x) => set({ ...v, delivery: x })} />
        <TextArea label="Cuota de adopción" rows={3} value={v.fee} onChange={(x) => set({ ...v, fee: x })} />
      </>
    ),
  },
  {
    key: 'faq',
    title: 'Preguntas frecuentes',
    emoji: '❓',
    render: (v, set) => (
      <ListEditor
        items={v.items}
        onChange={(items) => set({ ...v, items })}
        empty={{ q: '', a: '' }}
        addLabel="Añadir pregunta"
        render={(item, update) => (
          <>
            <TextInput label="Pregunta" value={item.q} onChange={(x) => update({ ...item, q: x })} />
            <TextArea label="Respuesta" rows={3} value={item.a} onChange={(x) => update({ ...item, a: x })} />
          </>
        )}
      />
    ),
  },
  {
    key: 'contact',
    title: 'Contacto y redes',
    emoji: '✉️',
    render: (v, set) => (
      <>
        <p className="text-sm text-cacao-suave">Lo que dejes vacío no aparece en la web.</p>
        <TextInput label="Email" type="email" value={v.email} onChange={(x) => set({ ...v, email: x })} />
        <TextInput label="Teléfono" type="tel" value={v.phone} onChange={(x) => set({ ...v, phone: x })} />
        <TextInput label="WhatsApp" type="tel" hint="Número con el que se abrirá el chat." value={v.whatsapp} onChange={(x) => set({ ...v, whatsapp: x })} />
        <TextInput label="Instagram" placeholder="@bigotes_almendralejo" value={v.instagram} onChange={(x) => set({ ...v, instagram: x })} />
        <TextInput label="Facebook (enlace)" placeholder="https://facebook.com/…" value={v.facebook} onChange={(x) => set({ ...v, facebook: x })} />
        <TextInput label="Dónde estamos" value={v.address} onChange={(x) => set({ ...v, address: x })} />
        <TextInput label="Horario de atención" value={v.hours} onChange={(x) => set({ ...v, hours: x })} />
      </>
    ),
  },
  {
    key: 'volunteering',
    title: 'Voluntariado',
    emoji: '🙋',
    render: (v, set) => <TextArea label="Texto de la sección de voluntariado" rows={4} value={v.intro} onChange={(x) => set({ ...v, intro: x })} />,
  },
  {
    key: 'donations',
    title: 'Donaciones',
    emoji: '🐷',
    render: (v, set) => (
      <>
        <p className="text-sm text-cacao-suave">Mientras un método esté vacío, en la web sale como «Muy pronto».</p>
        <TextArea label="Texto de la sección" rows={3} value={v.intro} onChange={(x) => set({ ...v, intro: x })} />
        <TextInput label="Bizum (número o código ONG)" value={v.bizum} onChange={(x) => set({ ...v, bizum: x })} />
        <TextInput label="IBAN para transferencias" value={v.iban} onChange={(x) => set({ ...v, iban: x })} />
        <TextInput label="Enlace de Teaming" type="url" value={v.teaming} onChange={(x) => set({ ...v, teaming: x })} />
        <TextInput label="Enlace de PayPal" type="url" value={v.paypal} onChange={(x) => set({ ...v, paypal: x })} />
      </>
    ),
  },
  {
    key: 'legal',
    title: 'Datos legales',
    emoji: '⚖️',
    render: (v, set) => (
      <>
        <p className="text-sm text-cacao-suave">Aparecen en el aviso legal y la política de privacidad. Mientras falten, allí sale «[pendiente]».</p>
        <TextInput label="Nombre legal de la asociación" value={v.holder} onChange={(x) => set({ ...v, holder: x })} />
        <TextInput label="CIF" value={v.cif} onChange={(x) => set({ ...v, cif: x })} />
        <TextInput label="Registro de asociaciones y número" placeholder="Registro de Asociaciones de Extremadura, n.º …" value={v.registry} onChange={(x) => set({ ...v, registry: x })} />
        <TextInput label="Domicilio social" value={v.address} onChange={(x) => set({ ...v, address: x })} />
        <TextInput label="Email para temas de privacidad" type="email" value={v.email} onChange={(x) => set({ ...v, email: x })} />
      </>
    ),
  },
];

function SectionEditor({ section, value, open, onToggle }) {
  const toast = useToast();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api(`/admin/contenidos/${section.key}`, { method: 'PUT', body: draft });
      refreshAfterChange();
      toast(`«${section.title}» guardado ✨`);
    } catch (err) {
      const fields = err instanceof ApiError ? Object.values(err.fields) : [];
      setError(fields.length ? `${err.message}: ${fields[0]}` : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-3xl bg-nata shadow-suave">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 px-5 text-left">
        <span className="text-2xl" aria-hidden>
          {section.emoji}
        </span>
        <span className="flex-1 font-display text-lg font-semibold">{section.title}</span>
        {dirty && <span className="rounded-full bg-mantequilla px-2 py-0.5 text-xs font-bold text-mantequilla-oscuro">Sin guardar</span>}
        <ChevronDown className={`size-5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-borde p-5">
          {section.render(draft, setDraft)}
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <Button onClick={save} loading={saving} disabled={!dirty}>
              Guardar
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(value)}>
                Deshacer cambios
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function Contents() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi('/contenidos');
  const [open, setOpen] = useState(null);
  const sections = SECTIONS.filter((s) => isAdmin(user) || !data?.adminOnly.includes(s.key));

  return (
    <AdminPage title="Textos de la web" subtitle="Cambia lo que se lee en la web sin tocar código. Se publica al guardar.">
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <ul className="grid gap-2">
          {sections.map((section) => (
            <SectionEditor
              key={section.key}
              section={section}
              value={data.content[section.key]}
              open={open === section.key}
              onToggle={() => setOpen(open === section.key ? null : section.key)}
            />
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
