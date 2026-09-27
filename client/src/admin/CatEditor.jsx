import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Play,
  Plus,
  Save,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { Checkbox, Choice, FormError, TextArea, TextInput } from '../components/form.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, Chip, ErrorState, Spinner, Tag, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { ageText, gendered, PERSONALITY_TAGS, statusLabel } from '../lib/cats.js';
import { AdminPage, isAdmin, refreshAfterChange, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { uploadPhotos } from './photos.js';
import { checkVideo, formatDuration, MAX_VIDEO_SECONDS, MAX_VIDEOS, uploadVideo } from './videos.js';

const MAX_PHOTOS = 12;

const EMPTY_CAT = {
  name: '',
  sex: 'desconocido',
  birthDate: '',
  coat: '',
  summary: '',
  story: '',
  personality: [],
  goodWith: { kids: 'desconocido', cats: 'desconocido', dogs: 'desconocido' },
  health: { vaccinated: false, dewormed: false, microchipped: false, sterilized: false, fivFelv: 'pendiente' },
  specialNeeds: '',
  location: '',
  status: 'borrador',
  featured: false,
  arrivedAt: '',
  adoptedAt: '',
  happyEnding: '',
};

function toForm(cat) {
  const form = {};
  for (const key of Object.keys(EMPTY_CAT)) form[key] = cat[key] ?? EMPTY_CAT[key];
  return structuredClone(form);
}

/** Actualiza un campo, también anidado: set('goodWith.kids', 'si'). */
function useCatForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (path, value) => {
    setValues((current) => {
      const next = structuredClone(current);
      const keys = path.split('.');
      let target = next;
      for (const key of keys.slice(0, -1)) target = target[key];
      target[keys.at(-1)] = value;
      return next;
    });
    setErrors((current) => ({ ...current, [path]: undefined }));
  };
  return { values, setValues, set, errors, setErrors };
}

const SEX_OPTIONS = [
  { value: 'hembra', label: '♀ Hembra' },
  { value: 'macho', label: '♂ Macho' },
  { value: 'desconocido', label: 'Sin confirmar' },
];
const TRI = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'desconocido', label: 'No lo sabemos' },
];
const FIV_OPTIONS = [
  { value: 'negativo', label: 'Negativo' },
  { value: 'positivo_fiv', label: 'FIV +' },
  { value: 'positivo_felv', label: 'FeLV +' },
  { value: 'pendiente', label: 'Pendiente' },
];

function Section({ title, hint, children }) {
  return (
    <Card className="grid gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {hint && <p className="text-sm text-cacao-suave">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function BasicsFields({ form }) {
  const { values, set, errors } = form;
  return (
    <>
      <TextInput label="Nombre" value={values.name} onChange={(v) => set('name', v)} error={errors.name} maxLength={60} placeholder="Luna" />
      <Choice label="Sexo" options={SEX_OPTIONS} value={values.sex} onChange={(v) => set('sex', v)} />
      <TextInput
        label="Fecha de nacimiento aproximada"
        type="month"
        optional
        hint={values.birthDate ? `Tiene ${ageText(values.birthDate)}. La edad se actualiza sola.` : 'Con el mes vale: la edad se calcula sola.'}
        value={values.birthDate}
        onChange={(v) => set('birthDate', v)}
        error={errors.birthDate}
        max={new Date().toISOString().slice(0, 7)}
      />
      <TextInput label="Pelaje" optional placeholder="Atigrado gris, carey, negro…" value={values.coat} onChange={(v) => set('coat', v)} />
      <TextInput
        label="¿Dónde está ahora?"
        optional
        placeholder="Casa de acogida en Almendralejo"
        hint="Sin direcciones exactas: esto se ve en la web."
        value={values.location}
        onChange={(v) => set('location', v)}
      />
      <TextInput label="Llegó a la asociación el" type="date" optional value={values.arrivedAt} onChange={(v) => set('arrivedAt', v)} error={errors.arrivedAt} />
    </>
  );
}

function PersonalityFields({ form }) {
  const { values, set, errors } = form;
  const [custom, setCustom] = useState('');
  const toggle = (tag) =>
    set('personality', values.personality.includes(tag) ? values.personality.filter((t) => t !== tag) : [...values.personality, tag]);
  const extra = values.personality.filter((tag) => !PERSONALITY_TAGS.includes(tag));
  function addCustom() {
    const tag = custom.trim().toLowerCase();
    if (tag && !values.personality.includes(tag)) set('personality', [...values.personality, tag]);
    setCustom('');
  }
  return (
    <>
      <fieldset>
        <legend className="mb-1 font-bold">¿Cómo es?</legend>
        <p className="mb-2 text-sm text-cacao-suave">Toca las que encajen (hasta 8). Las tres primeras salen en el match.</p>
        <div className="flex flex-wrap gap-2">
          {[...PERSONALITY_TAGS, ...extra].map((tag) => (
            <Chip key={tag} selected={values.personality.includes(tag)} onClick={() => toggle(tag)}>
              {gendered(tag, values.sex)}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustom();
              }
            }}
            maxLength={30}
            placeholder="Otra: «le encantan las cajas»"
            aria-label="Añadir otra etiqueta"
            className="min-w-0 flex-1 rounded-full border-2 border-borde bg-nata px-4 py-2 focus:border-canela focus:outline-none"
          />
          <Button variant="soft" size="sm" onClick={addCustom} aria-label="Añadir etiqueta">
            <Plus className="size-4" />
          </Button>
        </div>
        {errors.personality && <p className="mt-2 text-sm font-semibold text-canela-oscuro">{errors.personality}</p>}
      </fieldset>
      <TextInput
        label="Frase corta"
        hint={`Sale en su tarjeta y en el match (${values.summary.length}/220).`}
        placeholder="Una bolita de mimos que ronronea en cuanto la coges."
        maxLength={220}
        value={values.summary}
        onChange={(v) => set('summary', v)}
        error={errors.summary}
      />
      <TextArea
        label="Su historia"
        optional
        rows={5}
        hint="Cómo llegó, cómo es en casa, qué le gusta… Contada con cariño."
        value={values.story}
        onChange={(v) => set('story', v)}
        error={errors.story}
      />
    </>
  );
}

function HealthFields({ form }) {
  const { values, set } = form;
  const g = (word) => gendered(word, values.sex);
  const toggles = [
    ['vaccinated', g('Vacunado')],
    ['dewormed', g('Desparasitado')],
    ['microchipped', 'Con microchip'],
    ['sterilized', g('Esterilizado')],
  ];
  return (
    <>
      <div className="grid gap-4">
        <Choice label="¿Se lleva bien con niños?" options={TRI} value={values.goodWith.kids} onChange={(v) => set('goodWith.kids', v)} />
        <Choice label="¿Y con otros gatos?" options={TRI} value={values.goodWith.cats} onChange={(v) => set('goodWith.cats', v)} />
        <Choice label="¿Y con perros?" options={TRI} value={values.goodWith.dogs} onChange={(v) => set('goodWith.dogs', v)} />
      </div>
      <fieldset>
        <legend className="mb-2 font-bold">Salud</legend>
        <div className="grid grid-cols-2 gap-2">
          {toggles.map(([key, label]) => (
            <Chip
              key={key}
              selected={values.health[key]}
              onClick={() => set(`health.${key}`, !values.health[key])}
              className="min-h-12 justify-center"
            >
              {values.health[key] && <Check className="size-4" strokeWidth={3} />} {label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Choice label="Test FIV/FeLV" options={FIV_OPTIONS} value={values.health.fivFelv} onChange={(v) => set('health.fivFelv', v)} />
      <TextArea
        label="Necesidades especiales"
        optional
        rows={3}
        hint="Medicación, dieta, si debe ser único gato… Se muestra destacado en su ficha."
        value={values.specialNeeds}
        onChange={(v) => set('specialNeeds', v)}
      />
    </>
  );
}

function PublishFields({ form, showStatus = true }) {
  const { values, set, errors } = form;
  const options = ['borrador', 'disponible', 'reservado', 'adoptado'].map((status) => ({
    value: status,
    label: status === 'borrador' ? 'Borrador (oculto)' : statusLabel(status, values.sex),
  }));
  return (
    <>
      {showStatus && <Choice label="Estado" options={options} columns value={values.status} onChange={(v) => set('status', v)} />}
      <Checkbox checked={values.featured} onChange={(v) => set('featured', v)}>
        <strong>Destacar en la portada</strong> ⭐ <span className="text-cacao-suave">Sale entre los primeros en «Te están esperando».</span>
      </Checkbox>
      {values.status === 'adoptado' && (
        <>
          <TextInput
            label="Fecha de adopción"
            type="date"
            optional
            hint="Si la dejas vacía, se usa la de hoy."
            value={values.adoptedAt}
            onChange={(v) => set('adoptedAt', v)}
            error={errors.adoptedAt}
          />
          <TextArea
            label="Su final feliz 💕"
            optional
            rows={4}
            hint="Sale en «Finales felices». Sin apellidos ni direcciones de la familia."
            value={values.happyEnding}
            onChange={(v) => set('happyEnding', v)}
          />
        </>
      )}
    </>
  );
}

/** Botón grande para elegir fotos de la galería o hacerlas con la cámara. */
function PhotoPicker({ onFiles, disabled, remaining }) {
  const input = useRef(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled || remaining <= 0}
        onClick={() => input.current?.click()}
        className="flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-3xl border-4 border-dashed border-canela-pastel bg-canela-claro/40 p-4 font-bold text-canela-oscuro transition hover:bg-canela-claro disabled:opacity-50"
      >
        <ImagePlus className="size-8" aria-hidden />
        {remaining > 0 ? 'Añadir fotos' : `Máximo ${MAX_PHOTOS} fotos`}
        <span className="text-sm font-semibold text-cacao-suave">De la galería o con la cámara</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...event.target.files].slice(0, remaining);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

function PhotoTile({ src, index, total, onMove, onRemove, alt }) {
  return (
    <li className="relative overflow-hidden rounded-2xl bg-nata shadow-suave">
      <img src={src} alt={alt} className="aspect-square w-full object-cover" />
      {index === 0 && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-mantequilla px-2 py-0.5 text-xs font-bold text-mantequilla-oscuro">
          <Star className="size-3" fill="currentColor" /> Portada
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-cacao/70 to-transparent p-1.5 pt-6">
        <div className="flex gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} className="grid size-9 place-items-center rounded-full bg-nata/90 disabled:opacity-40" aria-label="Mover antes">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)} className="grid size-9 place-items-center rounded-full bg-nata/90 disabled:opacity-40" aria-label="Mover después">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button type="button" onClick={() => onRemove(index)} className="grid size-9 place-items-center rounded-full bg-nata/90 text-canela-oscuro" aria-label="Quitar foto">
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

const PHOTO_TIP = 'La primera es la portada. Mejor con luz natural, a su altura y con la cara bien visible.';

/** Barra de progreso de subida: progress = { label, value } con value entre 0 y 1. */
function Progress({ progress }) {
  if (!progress) return null;
  return (
    <div className="rounded-2xl bg-cielo p-3 text-sm font-bold text-cielo-oscuro" role="status">
      {progress.label}
      <div className="mt-2 h-2 rounded-full bg-nata">
        <div className="h-2 rounded-full bg-cielo-oscuro transition-all" style={{ width: `${Math.round(progress.value * 100)}%` }} />
      </div>
    </div>
  );
}

const photoProgress = (done, total) => ({ label: `Subiendo foto ${Math.min(done + 1, total)} de ${total}…`, value: done / total });

function videoProgress(index, total, value) {
  const which = total > 1 ? `vídeo ${index + 1} de ${total}` : 'vídeo';
  return { label: `Subiendo ${which}… ${Math.round(value * 100)}%`, value };
}

/** Avisa antes de cerrar la pestaña mientras algo se está subiendo. */
function useWarnOnClose(active) {
  useEffect(() => {
    if (!active) return undefined;
    const onBeforeUnload = (event) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}

const VIDEO_TIP = `Un vídeo jugando o ronroneando enamora más que mil fotos. Hasta ${MAX_VIDEO_SECONDS / 60} minuto cada uno; en vertical queda genial.`;

/** Botón para elegir vídeos de la galería o grabarlos. */
function VideoPicker({ onFiles, disabled, remaining }) {
  const input = useRef(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled || remaining <= 0}
        onClick={() => input.current?.click()}
        className="flex min-h-16 w-full items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-lavanda-oscuro/25 bg-lavanda/40 p-3 font-bold text-lavanda-oscuro transition hover:bg-lavanda disabled:opacity-50"
      >
        <Clapperboard className="size-6" aria-hidden />
        {remaining > 0 ? 'Añadir vídeo' : `Máximo ${MAX_VIDEOS} vídeos`}
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...event.target.files].slice(0, remaining);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/** Vídeo ya subido: portada con ▶ (se reproduce ahí mismo), o su estado si aún no está listo. */
function VideoTile({ video, index, catName, onRemove }) {
  const [playing, setPlaying] = useState(false);
  const box = 'aspect-[3/4] w-full';
  let body;
  if (video.status === 'listo' && playing) {
    body = <video src={video.url} poster={video.poster} controls autoPlay playsInline className={cx(box, 'bg-cacao object-contain')} />;
  } else if (video.status === 'listo') {
    body = (
      <button type="button" onClick={() => setPlaying(true)} className="relative block w-full" aria-label={`Ver vídeo ${index + 1} de ${catName}`}>
        <img src={video.poster} alt="" className={cx(box, 'object-cover')} />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-nata/90 text-cacao shadow-suave">
            <Play className="size-6 translate-x-0.5" fill="currentColor" />
          </span>
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-cacao/75 px-2 py-0.5 text-xs font-bold text-white">{formatDuration(video.duration)}</span>
      </button>
    );
  } else if (video.status === 'procesando') {
    body = (
      <div className={cx(box, 'grid place-content-center justify-items-center gap-2 bg-cielo p-3 text-center text-sm font-bold text-cielo-oscuro')} role="status">
        <LoaderCircle className="size-8 animate-spin" aria-hidden />
        Preparando el vídeo…
        <span className="font-semibold">Tarda un poco. Puedes seguir con otras cosas.</span>
      </div>
    );
  } else {
    body = (
      <div className={cx(box, 'grid place-content-center justify-items-center gap-2 bg-canela-claro p-3 text-center text-sm font-bold text-canela-oscuro')}>
        <TriangleAlert className="size-8" aria-hidden />
        {video.error || 'No se ha podido preparar'}
      </div>
    );
  }
  return (
    <li className="relative overflow-hidden rounded-2xl bg-nata shadow-suave">
      {body}
      <button type="button" onClick={() => onRemove(video)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-nata/90 text-canela-oscuro" aria-label={`Quitar vídeo ${index + 1}`}>
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Alta: asistente por pasos («nuevo gatito en un minuto»)
// ---------------------------------------------------------------------------

const WIZARD = ['Fotos y vídeos', 'Lo básico', 'Carácter', 'Salud', 'Publicar'];

function NewCat() {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useCatForm(structuredClone(EMPTY_CAT));
  const { values, setErrors } = form;
  const [files, setFiles] = useState([]);
  const [videos, setVideos] = useState([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  useWarnOnClose(saving);

  async function addVideos(list) {
    const accepted = [];
    for (const file of list) {
      const check = await checkVideo(file);
      if (check.error) toast(check.error, { tone: 'error', duration: 8000 });
      else {
        if (check.warning) toast(check.warning, { duration: 6000 });
        accepted.push(file);
      }
    }
    setVideos((current) => [...current, ...accepted].slice(0, MAX_VIDEOS));
  }

  const move = (index, delta) =>
    setFiles((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });

  function go(next) {
    if (step === 1 && next > 1 && !values.name.trim()) {
      setErrors({ name: 'Ponle un nombre' });
      return;
    }
    setError('');
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(status) {
    setSaving(true);
    setError('');
    try {
      const { cat } = await api('/admin/gatitos', { method: 'POST', body: { ...values, status } });
      let failed = [];
      if (files.length) {
        const result = await uploadPhotos(cat.id, files, (done, total) => setProgress(photoProgress(done, total)));
        failed = result.failed;
      }
      let failedVideos = 0;
      for (const [i, file] of videos.entries()) {
        setProgress(videoProgress(i, videos.length, 0));
        try {
          await uploadVideo(cat.id, file, (value) => setProgress(videoProgress(i, videos.length, value)));
        } catch {
          failedVideos += 1;
        }
      }
      refreshAfterChange();
      toast(status === 'disponible' ? `¡${cat.name} ya está en la web! 🎉` : `${cat.name} guardado como borrador`);
      if (failed.length) toast(`No se pudieron subir ${failed.length} fotos. Prueba de nuevo desde su ficha.`, { tone: 'error', duration: 6000 });
      if (failedVideos) toast(`No se pudo subir ${failedVideos === 1 ? 'un vídeo' : `${failedVideos} vídeos`}. Prueba de nuevo desde su ficha.`, { tone: 'error', duration: 6000 });
      navigate(`/admin/gatitos/${cat.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        if (err.fields.name) setStep(1);
      }
      setError(err.message);
      setSaving(false);
      setProgress(null);
    }
  }

  const g = (word) => gendered(word, values.sex);
  return (
    <AdminPage title="Nuevo gatito" back="/admin/gatitos" subtitle={`Paso ${step + 1} de ${WIZARD.length} · ${WIZARD[step]}`}>
      <div className="mb-5 flex gap-1.5" aria-hidden>
        {WIZARD.map((label, i) => (
          <span key={label} className={cx('h-2 flex-1 rounded-full transition', i <= step ? 'bg-canela' : 'bg-canela-claro')} />
        ))}
      </div>

      <div className="grid gap-5">
        {step === 0 && (
          <Section title="Empieza por las fotos 📸" hint={PHOTO_TIP}>
            <PhotoPicker remaining={MAX_PHOTOS - files.length} onFiles={(list) => setFiles((current) => [...current, ...list])} />
            {files.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {files.map((file, i) => (
                  <PhotoTile
                    key={previews[i]}
                    src={previews[i]}
                    alt={`Foto ${i + 1}`}
                    index={i}
                    total={files.length}
                    onMove={move}
                    onRemove={(index) => setFiles((list) => list.filter((_, j) => j !== index))}
                  />
                ))}
              </ul>
            )}
            <div className="grid gap-3 border-t-2 border-dashed border-borde pt-5">
              <div>
                <h3 className="font-display text-lg font-semibold">¿Tienes algún vídeo? 🎬</h3>
                <p className="text-sm text-cacao-suave">{VIDEO_TIP}</p>
              </div>
              {videos.length > 0 && (
                <ul className="grid gap-2">
                  {videos.map((file, i) => (
                    <li key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-3 rounded-2xl bg-lavanda/50 p-2 pl-4">
                      <Clapperboard className="size-5 shrink-0 text-lavanda-oscuro" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span>
                      <span className="shrink-0 text-sm text-cacao-suave">{Math.max(1, Math.round(file.size / 1024 / 1024))} MB</span>
                      <button
                        type="button"
                        onClick={() => setVideos((list) => list.filter((_, j) => j !== i))}
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-nata text-canela-oscuro"
                        aria-label={`Quitar ${file.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <VideoPicker remaining={MAX_VIDEOS - videos.length} onFiles={addVideos} />
            </div>
          </Section>
        )}
        {step === 1 && (
          <Section title="Lo básico">
            <BasicsFields form={form} />
          </Section>
        )}
        {step === 2 && (
          <Section title="Su carácter" hint="Lo que hace que alguien se enamore de él.">
            <PersonalityFields form={form} />
          </Section>
        )}
        {step === 3 && (
          <Section title="Convivencia y salud">
            <HealthFields form={form} />
          </Section>
        )}
        {step === 4 && (
          <>
            <Card className="flex gap-4">
              {previews[0] ? (
                <img src={previews[0]} alt="" className="size-24 shrink-0 rounded-2xl object-cover" />
              ) : (
                <CatPhoto cat={{ id: 0, name: values.name }} className="size-24 shrink-0 rounded-2xl" />
              )}
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold">{values.name}</h2>
                <p className="text-sm text-cacao-suave">
                  {[
                    ageText(values.birthDate),
                    files.length === 1 ? '1 foto' : `${files.length} fotos`,
                    videos.length > 0 && (videos.length === 1 ? '1 vídeo' : `${videos.length} vídeos`),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {values.personality.slice(0, 3).map((tag) => (
                    <Tag key={tag} tone="lavanda" className="px-2 py-0.5 text-xs">
                      {g(tag)}
                    </Tag>
                  ))}
                </div>
              </div>
            </Card>
            <Section title="¿Lo publicamos?">
              <PublishFields form={form} showStatus={false} />
            </Section>
          </>
        )}

        <Progress progress={progress} />
        <FormError>{error}</FormError>

        {step < WIZARD.length - 1 ? (
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="secondary" size="lg" onClick={() => go(step - 1)} aria-label="Paso anterior">
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <Button size="lg" block onClick={() => go(step + 1)}>
              {step === 0 && files.length === 0 && videos.length === 0 ? 'Seguir sin fotos' : 'Siguiente'} <ArrowRight className="size-5" />
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <Button size="lg" block loading={saving} onClick={() => save('disponible')}>
              Publicar ya 🎉
            </Button>
            <Button variant="secondary" size="lg" block disabled={saving} onClick={() => save('borrador')}>
              Guardar como borrador
            </Button>
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={saving}>
              <ArrowLeft className="size-5" /> Volver
            </Button>
          </div>
        )}
      </div>
    </AdminPage>
  );
}

// ---------------------------------------------------------------------------
// Edición: todo en una pantalla, con guardado abajo
// ---------------------------------------------------------------------------

function EditPhotos({ cat, onChange }) {
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [ask, dialog] = useConfirm();

  async function add(files) {
    const result = await uploadPhotos(cat.id, files, (done, total) => setProgress(photoProgress(done, total)));
    setProgress(null);
    if (result.cat) onChange(result.cat);
    if (result.failed.length) toast(result.lastError || `No se pudieron subir ${result.failed.length} fotos`, { tone: 'error', duration: 6000 });
    else toast(files.length === 1 ? 'Foto subida 📸' : `${files.length} fotos subidas 📸`);
    refreshAfterChange();
  }

  async function move(index, delta) {
    const ids = cat.photos.map((p) => p.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    try {
      const result = await api(`/admin/gatitos/${cat.id}/fotos/orden`, { method: 'PUT', body: { ids } });
      onChange(result.cat);
      refreshAfterChange();
    } catch (error) {
      toast(error.message, { tone: 'error' });
    }
  }

  async function remove(index) {
    const photo = cat.photos[index];
    const ok = await ask({ title: '¿Quitar esta foto?', body: 'Se borrará de la web.', confirmLabel: 'Sí, quitarla', danger: true });
    if (!ok) return;
    try {
      const result = await api(`/admin/gatitos/${cat.id}/fotos/${photo.id}`, { method: 'DELETE' });
      onChange(result.cat);
      refreshAfterChange();
    } catch (error) {
      toast(error.message, { tone: 'error' });
    }
  }

  return (
    <Section title="Fotos" hint={PHOTO_TIP}>
      {cat.photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cat.photos.map((photo, i) => (
            <PhotoTile key={photo.id} src={photo.sm} alt={`Foto ${i + 1} de ${cat.name}`} index={i} total={cat.photos.length} onMove={move} onRemove={remove} />
          ))}
        </ul>
      )}
      <Progress progress={progress} />
      <PhotoPicker remaining={MAX_PHOTOS - cat.photos.length} disabled={Boolean(progress)} onFiles={add} />
      {dialog}
    </Section>
  );
}

function EditVideos({ cat, onChange }) {
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [ask, dialog] = useConfirm();
  const processing = cat.videos.filter((v) => v.status === 'procesando').map((v) => v.id);
  const waiting = processing.join(',');
  useWarnOnClose(Boolean(progress));

  // Mientras se prepara algún vídeo, se pregunta cada pocos segundos cómo va.
  useEffect(() => {
    if (!waiting) return undefined;
    const ids = waiting.split(',').map(Number);
    const timer = setInterval(async () => {
      try {
        const { cat: fresh } = await api(`/admin/gatitos/${cat.id}`);
        const finished = fresh.videos.filter((v) => ids.includes(v.id) && v.status !== 'procesando');
        if (finished.length === 0) return;
        onChange(fresh);
        refreshAfterChange();
        if (finished.some((v) => v.status === 'listo')) toast('¡Vídeo listo! Ya se ve en la web 🎬');
        if (finished.some((v) => v.status === 'error')) toast('Un vídeo no se ha podido preparar', { tone: 'error', duration: 6000 });
      } catch {
        // Sin conexión un momento: se vuelve a preguntar en el siguiente intento.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, cat.id, onChange, toast]);

  async function add(files) {
    let uploaded = 0;
    for (const [i, file] of files.entries()) {
      const check = await checkVideo(file);
      if (check.error) {
        toast(check.error, { tone: 'error', duration: 8000 });
        continue;
      }
      if (check.warning) toast(check.warning, { duration: 6000 });
      setProgress(videoProgress(i, files.length, 0));
      try {
        const result = await uploadVideo(cat.id, file, (value) => setProgress(videoProgress(i, files.length, value)));
        onChange(result.cat);
        uploaded += 1;
      } catch (error) {
        toast(error.message, { tone: 'error', duration: 8000 });
      }
    }
    setProgress(null);
    if (uploaded) {
      toast(uploaded === 1 ? 'Vídeo subido. Lo estamos preparando…' : `${uploaded} vídeos subidos. Los estamos preparando…`);
      refreshAfterChange();
    }
  }

  async function remove(video) {
    const ok = await ask({ title: '¿Quitar este vídeo?', body: 'Se borrará de la web.', confirmLabel: 'Sí, quitarlo', danger: true });
    if (!ok) return;
    try {
      const result = await api(`/admin/gatitos/${cat.id}/videos/${video.id}`, { method: 'DELETE' });
      onChange(result.cat);
      refreshAfterChange();
    } catch (error) {
      toast(error.message, { tone: 'error' });
    }
  }

  return (
    <Section title="Vídeos 🎬" hint={VIDEO_TIP}>
      {cat.videos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cat.videos.map((video, i) => (
            <VideoTile key={video.id} video={video} index={i} catName={cat.name} onRemove={remove} />
          ))}
        </ul>
      )}
      <Progress progress={progress} />
      <VideoPicker remaining={MAX_VIDEOS - cat.videos.length} disabled={Boolean(progress)} onFiles={add} />
      {dialog}
    </Section>
  );
}

function EditCat({ initial }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [cat, setCat] = useState(initial);
  const form = useCatForm(toForm(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(toForm(initial)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ask, dialog] = useConfirm();
  const leaving = useRef(false);
  const dirty = JSON.stringify(form.values) !== saved;

  // Aviso al salir con cambios sin guardar.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const result = await api(`/admin/gatitos/${cat.id}`, { method: 'PUT', body: form.values });
      setCat(result.cat);
      const next = toForm(result.cat);
      form.setValues(next);
      setSaved(JSON.stringify(next));
      refreshAfterChange();
      toast('Cambios guardados ✨');
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    const ok = await ask({
      title: `¿Borrar a ${cat.name}?`,
      body: 'Se borran su ficha, sus fotos y sus vídeos para siempre. Si ha sido adoptado, mejor márcalo como «Adoptado» para que salga en Finales felices.',
      confirmLabel: 'Sí, borrar para siempre',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/gatitos/${cat.id}`, { method: 'DELETE' });
      refreshAfterChange();
      leaving.current = true;
      toast(`${cat.name} borrado`);
      navigate('/admin/gatitos', { replace: true });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  const publicLink = cat.status !== 'borrador' && (
    <a href={`/gatitos/${cat.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-full bg-nata px-3 text-sm font-bold shadow-suave">
      <ExternalLink className="size-4" /> Ver en la web
    </a>
  );

  return (
    <AdminPage title={cat.name} back="/admin/gatitos" subtitle={`${statusLabel(cat.status, cat.sex)} · ${cat.likes} 💕 en la web`} action={publicLink}>
      <div className="grid gap-4">
        <EditPhotos cat={cat} onChange={setCat} />
        <EditVideos cat={cat} onChange={setCat} />
        <Section title="Estado y portada">
          <PublishFields form={form} />
        </Section>
        <Section title="Lo básico">
          <BasicsFields form={form} />
        </Section>
        <Section title="Su carácter">
          <PersonalityFields form={form} />
        </Section>
        <Section title="Convivencia y salud">
          <HealthFields form={form} />
        </Section>
        <FormError>{error}</FormError>
        {isAdmin(user) && (
          <Button variant="danger" onClick={destroy} className="justify-self-start">
            <Trash2 className="size-4" /> Borrar gatito
          </Button>
        )}
      </div>

      <div
        className={cx(
          'fixed inset-x-0 bottom-sobre-barra z-30 px-4 transition md:bottom-6 md:left-64',
          dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full bg-cacao p-2 pl-5 text-white shadow-flotante">
          <span className="flex-1 text-sm font-bold">Cambios sin guardar</span>
          <button
            type="button"
            onClick={() => {
              form.setValues(JSON.parse(saved));
              form.setErrors({});
            }}
            className="grid size-11 place-items-center rounded-full hover:bg-white/10"
            aria-label="Descartar cambios"
          >
            <X className="size-5" />
          </button>
          <Button onClick={save} loading={saving}>
            <Save className="size-5" /> Guardar
          </Button>
        </div>
      </div>
      {dialog}
    </AdminPage>
  );
}

export default function CatEditor() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAdminApi(id ? `/gatitos/${id}` : null);
  if (!id) return <NewCat />;
  if (loading) return <Spinner />;
  if (error) {
    return (
      <AdminPage title="Gatito" back="/admin/gatitos">
        <ErrorState error={error} onRetry={reload} />
        <Link to="/admin/gatitos" className="font-bold underline">
          Volver a la lista
        </Link>
      </AdminPage>
    );
  }
  return <EditCat key={data.cat.id} initial={data.cat} />;
}
