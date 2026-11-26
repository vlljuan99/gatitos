import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Copy, Download, Minus, Pencil, Plus, Search, Share2, Ticket, Trash2, Trophy } from 'lucide-react';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { Checkbox, Choice, FormError, TextArea, TextInput } from '../components/form.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, EmptyState, ErrorState, Spinner, Tag, buttonClass, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { useDraftState } from '../lib/drafts.js';
import { entriesLabel, formatNumber, raffleEuros, ticketSummary, ticketText } from '../lib/raffles.js';
import { AdminPage, formatDate, isAdmin, refreshAfterChange, shortDate, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { renderRaffleTicket } from './drawRaffleTicket.js';

// Sorteos benéficos (la cesta de Navidad…): se da una papeleta con sus
// números al azar, se manda la imagen por WhatsApp y, el día del sorteo, el
// ganador se saca aquí mismo entre los números dados (y pagados). Las reglas
// están en server/src/routes/adminRaffles.js.

const EMPTY_RAFFLE = {
  title: 'Sorteo de la cesta',
  prize: '',
  price: '3',
  numbersPerEntry: '5',
  totalNumbers: '1000',
  drawInfo: '',
  design: 'cesta',
};

const DESIGNS = [
  { value: 'cesta', label: 'Cesta de Navidad', emoji: '🎁' },
  { value: 'sencillo', label: 'Sencillo (logo)', emoji: '🐾' },
];

function rangeLabel(total, digits) {
  return `del ${formatNumber(0, digits)} al ${formatNumber(total - 1, digits)}`;
}

function RaffleSheet({ raffle, open, onClose, onSaved, onDelete, canDelete }) {
  const isNew = !raffle;
  const locked = Boolean(raffle && (raffle.stats.tickets > 0 || raffle.closed));
  const pristine = raffle
    ? {
        title: raffle.title,
        prize: raffle.prize,
        price: String(raffle.price).replace('.', ','),
        numbersPerEntry: String(raffle.numbersPerEntry),
        totalNumbers: String(raffle.totalNumbers),
        drawInfo: raffle.drawInfo,
        design: raffle.design,
      }
    : EMPTY_RAFFLE;
  const [form, setForm, draft] = useDraftState(isNew ? 'sorteo-nuevo' : `sorteo-${raffle.id}`, pristine, { storage: 'local', checkBase: !isNew });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const total = Number(form.totalNumbers) || 0;
  const per = Number(form.numbersPerEntry) || 0;
  const digits = String(Math.max(1, total - 1)).length;

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setErrors({});
    try {
      const result = await api(isNew ? '/admin/sorteos' : `/admin/sorteos/${raffle.id}`, { method: isNew ? 'POST' : 'PUT', body: form });
      draft.discard();
      refreshAfterChange();
      onSaved(result.raffle, isNew);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'Nuevo sorteo 🎁' : 'Ajustes del sorteo'}>
      <form onSubmit={save} className="grid gap-4" noValidate>
        <TextInput label="Nombre del sorteo" value={form.title} onChange={set('title')} error={errors.title} maxLength={80} />
        <TextArea
          label="Premio"
          optional
          rows={3}
          placeholder="Cesta con décimo de lotería, lomo, turrones, flor de Pascua…"
          value={form.prize}
          onChange={set('prize')}
          error={errors.prize}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Precio (€)"
            hint="Por participación"
            inputMode="decimal"
            value={form.price}
            onChange={set('price')}
            error={errors.price}
            disabled={locked}
          />
          <TextInput
            label="Números"
            hint="Por participación"
            inputMode="numeric"
            value={form.numbersPerEntry}
            onChange={set('numbersPerEntry')}
            error={errors.numbersPerEntry}
            disabled={locked}
          />
        </div>
        <TextInput
          label="¿Cuántos números hay?"
          inputMode="numeric"
          hint={total >= 10 ? `Van ${rangeLabel(total, digits)}${per ? `: da para ${Math.floor(total / per)} participaciones` : ''}.` : 'Por ejemplo, 1000.'}
          value={form.totalNumbers}
          onChange={set('totalNumbers')}
          error={errors.totalNumbers}
          disabled={locked}
        />
        {locked && <p className="-mt-2 text-sm text-cacao-suave">Ya hay papeletas dadas: el precio y los números no se pueden cambiar.</p>}
        <TextInput
          label="¿Cuándo y cómo se sortea?"
          optional
          hint="Sale en la papeleta como «Se sortea …»."
          placeholder="en directo en Instagram el 20 de diciembre"
          value={form.drawInfo}
          onChange={set('drawInfo')}
          error={errors.drawInfo}
          maxLength={160}
        />
        <Choice label="Diseño de la papeleta" columns options={DESIGNS} value={form.design} onChange={set('design')} error={errors.design} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          {isNew ? 'Crear sorteo' : 'Guardar cambios'}
        </Button>
        {!isNew && canDelete && (
          <Button variant="danger" block onClick={() => onDelete(raffle)}>
            <Trash2 className="size-4" /> Borrar sorteo
          </Button>
        )}
      </form>
    </Sheet>
  );
}

function Progress({ raffle }) {
  const pct = raffle.totalNumbers ? Math.round((raffle.stats.sold / raffle.totalNumbers) * 100) : 0;
  return (
    <div>
      <div className="h-3 overflow-hidden rounded-full bg-canela-claro" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Números dados">
        <div className="h-full rounded-full bg-canela transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-sm text-cacao-suave">
        {raffle.stats.sold} de {raffle.totalNumbers} números dados ({pct} %)
      </p>
    </div>
  );
}

export default function Raffles() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAdminApi('/sorteos');
  const [creating, setCreating] = useState(false);
  const raffles = data?.raffles ?? [];

  return (
    <AdminPage title="Sorteos 🎁" subtitle="Papeletas con números al azar, para mandar por WhatsApp, y el ganador sacado aquí mismo.">
      <Button size="lg" block onClick={() => setCreating(true)} className="mb-5">
        <Plus className="size-5" /> Nuevo sorteo
      </Button>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && raffles.length === 0 && (
        <EmptyState title="Aún no hay sorteos" tone="mantequilla">
          Crea el de la cesta: cada participación lleva sus números al azar, sin repetir, y la papeleta sale lista para WhatsApp.
        </EmptyState>
      )}
      <ul className="grid gap-3">
        {raffles.map((raffle) => (
          <li key={raffle.id}>
            <Link to={`/admin/sorteos/${raffle.id}`} className="grid gap-3 rounded-3xl bg-nata p-4 shadow-suave">
              <span className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mantequilla text-xl" aria-hidden>
                  {raffle.closed ? '🏆' : '🎟️'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{raffle.title}</span>
                  <span className="block truncate text-sm text-cacao-suave">
                    {raffle.closed
                      ? `Ganador: ${formatNumber(raffle.draws[0].number, raffle.digits)} · ${raffle.draws[0].winnerName}`
                      : `${raffle.stats.tickets} papeletas · ${raffleEuros(raffle.stats.paid)} cobrados`}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-cacao-suave" aria-hidden />
              </span>
              <Progress raffle={raffle} />
            </Link>
          </li>
        ))}
      </ul>
      <RaffleSheet
        key={creating ? 'nuevo' : 'cerrado'}
        open={creating}
        onClose={() => setCreating(false)}
        canDelete={isAdmin(user)}
        onSaved={(raffle) => {
          setCreating(false);
          toast('¡Sorteo creado! Ya puedes dar papeletas 🎟️');
          navigate(`/admin/sorteos/${raffle.id}`);
        }}
      />
    </AdminPage>
  );
}

/** Hoja para dar una papeleta nueva. */
function NewTicketSheet({ raffle, open, onClose, onCreated }) {
  const empty = { name: '', phone: '', entries: 1, paid: true, wanted: '', notes: '' };
  const [form, setForm, draft] = useDraftState(`papeleta-nueva-${raffle.id}`, empty, { storage: 'local' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm({ ...form, [key]: value });
  const entries = Number(form.entries) || 1;
  const maxEntries = Math.max(1, Math.floor(raffle.stats.free / raffle.numbersPerEntry));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setErrors({});
    try {
      const wanted = (String(form.wanted).match(/\d+/g) ?? []).map(Number);
      const result = await api(`/admin/sorteos/${raffle.id}/papeletas`, {
        method: 'POST',
        body: { name: form.name, phone: form.phone, entries, paid: form.paid, notes: form.notes, wanted },
      });
      draft.discard();
      setForm(empty);
      refreshAfterChange();
      onCreated(result.ticket);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva papeleta 🎟️">
      <form onSubmit={save} className="grid gap-4" noValidate>
        <TextInput label="Nombre" placeholder="María (la de la frutería)" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} />
        <div>
          <p className="mb-2 font-bold">Participaciones</p>
          <div className="flex items-center gap-4">
            <Button variant="secondary" className="size-14 !px-0" aria-label="Una menos" onClick={() => set('entries')(Math.max(1, entries - 1))} disabled={entries <= 1}>
              <Minus className="size-6" />
            </Button>
            <output className="min-w-12 text-center font-display text-4xl font-semibold tabular-nums" aria-live="polite">
              {entries}
            </output>
            <Button variant="secondary" className="size-14 !px-0" aria-label="Una más" onClick={() => set('entries')(Math.min(maxEntries, entries + 1))} disabled={entries >= maxEntries}>
              <Plus className="size-6" />
            </Button>
          </div>
          <p className="mt-2 rounded-2xl bg-canela-claro px-4 py-2 font-bold text-canela-oscuro">
            {entriesLabel(entries)} · {entries * raffle.numbersPerEntry} números · {raffleEuros(entries * raffle.price)}
          </p>
          {errors.entries && <p className="mt-1 text-sm font-semibold text-canela-oscuro">{errors.entries}</p>}
        </div>
        <TextInput
          label="Teléfono"
          optional
          type="tel"
          inputMode="tel"
          hint="Para mandarle la papeleta por WhatsApp y avisarle si gana."
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone}
          maxLength={30}
        />
        <TextInput
          label="Números que pide"
          optional
          inputMode="numeric"
          hint="Si quiere alguno en concreto. El resto salen al azar."
          placeholder="027, 412"
          value={form.wanted}
          onChange={set('wanted')}
          error={errors.wanted}
        />
        <Checkbox checked={form.paid} onChange={set('paid')}>
          <strong>Ya ha pagado</strong>
          <span className="block text-sm text-cacao-suave">Al sortear solo entran las papeletas pagadas (salvo que digas lo contrario).</span>
        </Checkbox>
        <TextArea label="Notas" optional rows={2} value={form.notes} onChange={set('notes')} error={errors.notes} />
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" block loading={saving}>
          🎲 Dar números al azar
        </Button>
      </form>
    </Sheet>
  );
}

/** Imagen de la papeleta y formas de mandarla. */
function TicketImage({ raffle, ticket }) {
  const toast = useToast();
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const key = JSON.stringify([raffle.title, raffle.design, raffle.drawInfo, ticket.name, ticket.numbers, ticket.amount]);

  useEffect(() => {
    let alive = true;
    let url;
    setImage(null);
    setError('');
    renderRaffleTicket(raffle, ticket)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => alive && setError('No se ha podido crear la imagen. Vuelve a intentarlo.'));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // `key` resume todo lo que cambia el dibujo.
  }, [key]);

  const text = ticketText(raffle, ticket);
  const fileName = `papeleta-${ticket.ticketNumber}-${ticket.name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.jpg`;
  const file = image ? new File([image.blob], fileName, { type: 'image/jpeg' }) : null;
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }));

  async function share() {
    try {
      await navigator.share({ files: [file], text });
    } catch (err) {
      if (err?.name !== 'AbortError') toast('No se ha podido compartir. Descárgala y mándala desde WhatsApp.', { tone: 'error' });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Texto copiado 📋');
    } catch {
      window.prompt('Copia el texto:', text);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid min-h-60 place-items-center overflow-hidden rounded-3xl bg-canela-claro">
        {image ? (
          <img src={image.url} alt={`Papeleta de ${ticket.name}`} className="w-full" />
        ) : error ? (
          <p className="p-4 text-center font-bold text-canela-oscuro">{error}</p>
        ) : (
          <Spinner label="Preparando la papeleta…" />
        )}
      </div>
      {canShare && (
        <Button size="lg" block onClick={share}>
          <Share2 className="size-5" /> Mandar la papeleta
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        {image && (
          <a href={image.url} download={fileName} className={buttonClass({ variant: 'secondary', block: true })}>
            <Download className="size-4" /> Descargar
          </a>
        )}
        <Button variant="secondary" block onClick={copy}>
          <Copy className="size-4" /> Copiar texto
        </Button>
      </div>
      {ticket.phone && (
        <a href={whatsappUrl(ticket.phone, text)} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'soft', block: true })}>
          <WhatsAppIcon className="size-5" /> Abrir su chat con los números
        </a>
      )}
    </div>
  );
}

/** Hoja de una papeleta: la imagen, sus datos y anularla. */
function TicketSheet({ raffle, ticket, open, onClose, canDelete }) {
  const toast = useToast();
  const [ask, dialog] = useConfirm();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setErrors({});
    if (ticket) setForm({ name: ticket.name, phone: ticket.phone, paid: ticket.paid, notes: ticket.notes });
  }, [ticket?.id]);

  if (!ticket) return <Sheet open={false} onClose={onClose} title="Papeleta" />;

  async function update(body, done) {
    setSaving(true);
    try {
      await api(`/admin/sorteos/${raffle.id}/papeletas/${ticket.id}`, { method: 'PUT', body });
      refreshAfterChange();
      done?.();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(err.message, { tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    const ok = await ask({
      title: '¿Anular esta papeleta?',
      body: `Los ${ticket.numbers.length} números de ${ticket.name} vuelven a quedar libres para otra persona.`,
      confirmLabel: 'Sí, anular',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/sorteos/${raffle.id}/papeletas/${ticket.id}`, { method: 'DELETE' });
      refreshAfterChange();
      onClose();
      toast('Papeleta anulada');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Papeleta n.º ${ticket.ticketNumber}`}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold">{ticket.name}</span>
          <Tag tone={ticket.paid ? 'menta' : 'mantequilla'}>{ticket.paid ? 'Pagada' : `Debe ${raffleEuros(ticket.amount)}`}</Tag>
        </div>
        <p className="-mt-2 text-sm text-cacao-suave">
          {ticketSummary(ticket)} · {shortDate(ticket.createdAt)}
        </p>
        <TicketImage raffle={raffle} ticket={ticket} />
        {!ticket.paid && (
          <Button size="lg" block loading={saving} onClick={() => update({ ...form, paid: true }, () => toast('Apuntado: ya ha pagado 💶'))}>
            Ya ha pagado
          </Button>
        )}
        {editing && form ? (
          <form
            className="grid gap-3 rounded-3xl bg-canela-claro/50 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              update(form, () => {
                setEditing(false);
                toast('Cambios guardados');
              });
            }}
            noValidate
          >
            <TextInput label="Nombre" value={form.name} onChange={(name) => setForm({ ...form, name })} error={errors.name} maxLength={80} />
            <TextInput label="Teléfono" optional type="tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} error={errors.phone} />
            <Checkbox checked={form.paid} onChange={(paid) => setForm({ ...form, paid })}>
              Ha pagado
            </Checkbox>
            <TextArea label="Notas" optional rows={2} value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
            <Button type="submit" block loading={saving}>
              Guardar
            </Button>
          </form>
        ) : (
          <Button variant="secondary" block onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Cambiar nombre, teléfono o pago
          </Button>
        )}
        {ticket.notes && !editing && <p className="rounded-2xl bg-nata p-3 text-sm">{ticket.notes}</p>}
        {canDelete && !raffle.closed && (
          <Button variant="danger" block onClick={cancel}>
            <Trash2 className="size-4" /> Anular papeleta
          </Button>
        )}
      </div>
      {dialog}
    </Sheet>
  );
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * El momento del sorteo, a pantalla grande para enseñarlo en directo: los
 * números dados pasan cada vez más despacio hasta pararse en el que ha salido
 * (que ya ha elegido el servidor).
 */
function DrawReveal({ raffle, pool, draw, onClose }) {
  const [shown, setShown] = useState(null);
  const [done, setDone] = useState(false);
  const timer = useRef();

  useEffect(() => {
    if (!draw) return undefined;
    setDone(false);
    if (prefersReducedMotion() || pool.length < 2) {
      setShown(draw.number);
      setDone(true);
      return undefined;
    }
    let delay = 40;
    const tick = () => {
      if (delay > 420) {
        setShown(draw.number);
        setDone(true);
        return;
      }
      setShown(pool[Math.floor(Math.random() * pool.length)]);
      delay *= 1.12;
      timer.current = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(timer.current);
  }, [draw]);

  const title = draw ? (draw.position === 1 ? '¡Y el número ganador es…!' : `Suplente ${draw.position - 1}…`) : '';
  return (
    <Sheet open={Boolean(draw)} onClose={done ? onClose : () => {}} title={title}>
      {draw && (
        <div className="grid gap-5 pb-2 text-center">
          <p
            className={cx(
              'rounded-[2rem] py-8 font-display text-7xl font-semibold tabular-nums transition sm:text-8xl',
              done ? 'bg-mantequilla text-mantequilla-oscuro' : 'bg-canela-claro text-canela-oscuro',
            )}
            aria-live="polite"
          >
            {shown === null ? '…' : formatNumber(shown, raffle.digits)}
          </p>
          {done && (
            <>
              <p className="font-display text-3xl font-semibold">{draw.position === 1 ? `🎉 ${draw.winnerName} 🎉` : draw.winnerName}</p>
              <p className="text-cacao-suave">
                Sacado entre {draw.poolSize} números {draw.includeUnpaid ? 'dados' : 'pagados'}.
              </p>
              <Button size="lg" block onClick={onClose}>
                ¡Hecho!
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function DrawSection({ raffle, tickets }) {
  const toast = useToast();
  const [ask, dialog] = useConfirm();
  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [reveal, setReveal] = useState(null);
  const drawn = new Set(raffle.draws.map((d) => d.number));
  const pool = tickets.filter((t) => includeUnpaid || t.paid).flatMap((t) => t.numbers).filter((n) => !drawn.has(n));
  const unpaidNumbers = tickets.filter((t) => !t.paid).reduce((sum, t) => sum + t.numbers.length, 0);
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const first = raffle.draws.length === 0;

  async function draw() {
    const ok = await ask({
      title: first ? '¿Sacamos el número ganador?' : '¿Sacamos un suplente?',
      body: first
        ? `Sale uno al azar entre los ${pool.length} números ${includeUnpaid ? 'dados' : 'pagados'}. Queda apuntado y, desde ese momento, ya no se pueden dar ni anular papeletas.`
        : `Por si no se puede entregar el premio: sale otro número entre los ${pool.length} que quedan. Queda apuntado.`,
      confirmLabel: first ? '🎲 ¡Sí, a sortear!' : 'Sí, sacar suplente',
    });
    if (!ok) return;
    setDrawing(true);
    try {
      const result = await api(`/admin/sorteos/${raffle.id}/sortear`, { method: 'POST', body: { includeUnpaid } });
      setReveal({ draw: result.raffle.draws.find((d) => d.position === result.position), pool });
      refreshAfterChange();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setDrawing(false);
    }
  }

  return (
    <Card className="mt-6 grid gap-4 p-5">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Trophy className="size-5" aria-hidden /> El sorteo
      </h2>
      {first ? (
        <p className="text-cacao-suave">
          Cuando acabéis de vender, sacad aquí el ganador (mejor en directo, enseñando la pantalla): sale al azar entre los números dados, así
          siempre hay premio aunque no se vendan todos.
        </p>
      ) : (
        <ol className="grid gap-2">
          {raffle.draws.map((d) => {
            const ticket = byId.get(d.ticketId);
            return (
              <li key={d.position} className={cx('rounded-2xl p-3', d.position === 1 ? 'bg-mantequilla text-mantequilla-oscuro' : 'bg-nata')}>
                <p className="font-bold">
                  {d.position === 1 ? '🏆 Ganador' : `Suplente ${d.position - 1}`}: {formatNumber(d.number, raffle.digits)} · {d.winnerName}
                </p>
                <p className="text-sm">
                  {ticket ? `Papeleta n.º ${ticket.ticketNumber}${ticket.phone ? ` · ${ticket.phone}` : ''} · ` : ''}
                  {formatDate(d.drawnAt)}, entre {d.poolSize} números
                </p>
                {ticket?.phone && d.position === 1 && (
                  <a
                    href={whatsappUrl(ticket.phone, `🎉 ¡Hola, ${ticket.name}! Ha salido el ${formatNumber(d.number, raffle.digits)} en el ${raffle.title} de Bigotes: ¡te ha tocado! 🐾`)}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass({ variant: 'secondary', size: 'sm', className: 'mt-2' })}
                  >
                    <WhatsAppIcon className="size-4" /> Darle la noticia
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {unpaidNumbers > 0 && (
        <Checkbox checked={includeUnpaid} onChange={setIncludeUnpaid}>
          <strong>Que entren también las papeletas sin pagar</strong>
          <span className="block text-sm text-cacao-suave">Hay {unpaidNumbers} números de papeletas sin pagar. Si no, no entran.</span>
        </Checkbox>
      )}
      <Button size="lg" block variant={first ? 'primary' : 'secondary'} loading={drawing} disabled={pool.length === 0} onClick={draw}>
        {first ? '🎲 Sacar el número ganador' : 'Sacar un suplente'}
      </Button>
      {pool.length === 0 && <p className="text-sm text-cacao-suave">No hay números {includeUnpaid ? 'dados' : 'pagados'} entre los que sortear.</p>}
      <DrawReveal raffle={raffle} pool={reveal?.pool ?? []} draw={reveal?.draw} onClose={() => setReveal(null)} />
      {dialog}
    </Card>
  );
}

export function RaffleDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAdminApi(`/sorteos/${id}`);
  const [sheet, setSheet] = useState(null); // 'nueva' | 'ajustes' | id de papeleta
  const [query, setQuery] = useState('');
  const [find, setFind] = useState('');
  // La papeleta recién dada, para enseñarla mientras se recarga la lista.
  const [fresh, setFresh] = useState(null);
  const [ask, dialog] = useConfirm();
  const raffle = data?.raffle;
  const tickets = data?.tickets ?? [];

  const owners = useMemo(() => {
    const map = new Map();
    for (const t of tickets) for (const n of t.numbers) map.set(n, t);
    return map;
  }, [tickets]);

  if (!raffle) {
    return (
      <AdminPage title="Sorteo" back="/admin/sorteos">
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
      </AdminPage>
    );
  }

  const current = typeof sheet === 'number' ? (tickets.find((t) => t.id === sheet) ?? (fresh?.id === sheet ? fresh : null)) : null;
  const q = query.trim().toLowerCase();
  const digitsQ = q.replace(/\D/g, '');
  const filtered = q
    ? tickets.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (digitsQ && t.phone.replace(/\D/g, '').includes(digitsQ)) ||
          (digitsQ.length === raffle.digits && t.numbers.includes(Number(digitsQ))),
      )
    : tickets;
  const findValid = find.length === raffle.digits;
  const found = findValid ? owners.get(Number(find)) : null;

  async function removeRaffle() {
    const ok = await ask({
      title: '¿Borrar este sorteo?',
      body: `Se borran también sus ${raffle.stats.tickets} papeletas y el resultado. No se puede deshacer.`,
      confirmLabel: 'Sí, borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/sorteos/${raffle.id}`, { method: 'DELETE' });
      refreshAfterChange();
      navigate('/admin/sorteos');
      toast('Sorteo borrado');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <AdminPage
      title={raffle.title}
      back="/admin/sorteos"
      subtitle={`${raffleEuros(raffle.price)} = ${raffle.numbersPerEntry} números · ${rangeLabel(raffle.totalNumbers, raffle.digits)}${raffle.drawInfo ? ` · se sortea ${raffle.drawInfo}` : ''}`}
      action={
        <Button variant="secondary" size="sm" onClick={() => setSheet('ajustes')} aria-label="Ajustes del sorteo">
          <Pencil className="size-4" /> Ajustes
        </Button>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          ['Números dados', raffle.stats.sold],
          ['Quedan libres', raffle.stats.free],
          [raffle.stats.unpaid ? `Cobrado · faltan ${raffleEuros(raffle.stats.unpaid)}` : 'Cobrado', raffleEuros(raffle.stats.paid)],
        ].map(([label, value]) => (
          <Card key={label} className="bg-mantequilla p-3 text-mantequilla-oscuro">
            <p className="font-display text-xl font-semibold leading-tight tabular-nums">{value}</p>
            <p className="text-xs font-bold">{label}</p>
          </Card>
        ))}
      </div>
      <Progress raffle={raffle} />
      {raffle.prize && <p className="mt-3 whitespace-pre-line rounded-2xl bg-nata p-3 text-sm">🎁 {raffle.prize}</p>}

      {!raffle.closed && (
        <Button size="lg" block className="mt-5" onClick={() => setSheet('nueva')} disabled={raffle.stats.free < raffle.numbersPerEntry}>
          <Ticket className="size-5" /> {raffle.stats.free < raffle.numbersPerEntry ? 'Están todos los números dados' : 'Dar papeleta'}
        </Button>
      )}

      <Card className="mt-6 grid gap-3 p-5">
        <h2 className="font-display text-xl font-semibold">¿Quién tiene el número…?</h2>
        <TextInput
          label={`Número (${raffle.digits} cifras)`}
          inputMode="numeric"
          placeholder={formatNumber(412 % raffle.totalNumbers, raffle.digits)}
          value={find}
          onChange={(value) => setFind(value.replace(/\D/g, '').slice(0, raffle.digits))}
          maxLength={raffle.digits}
        />
        {findValid &&
          (found ? (
            <button type="button" onClick={() => setSheet(found.id)} className="rounded-2xl bg-mantequilla p-3 text-left font-bold text-mantequilla-oscuro">
              El {find} lo tiene {found.name} · papeleta n.º {found.ticketNumber}
              {found.paid ? '' : ' · ¡sin pagar!'}
            </button>
          ) : (
            <p className="rounded-2xl bg-nata p-3 font-bold">
              {Number(find) >= raffle.totalNumbers ? `El ${find} no existe en este sorteo.` : `El ${find} no se ha dado a nadie.`}
            </p>
          ))}
      </Card>

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Papeletas</h2>
          <span className="text-sm text-cacao-suave">{raffle.stats.tickets}</span>
        </div>
        {tickets.length > 0 && (
          <label className="mb-3 flex min-h-12 items-center gap-2 rounded-2xl border-2 border-borde bg-nata px-4">
            <Search className="size-5 shrink-0 text-cacao-suave" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, teléfono o número"
              aria-label="Buscar papeleta"
              className="min-w-0 flex-1 bg-transparent py-3 focus:outline-none"
            />
          </label>
        )}
        {tickets.length === 0 && (
          <EmptyState title="Aún no hay papeletas" tone="mantequilla">
            Pulsa «Dar papeleta»: escribes el nombre, eliges las participaciones y salen sus números al azar.
          </EmptyState>
        )}
        {tickets.length > 0 && filtered.length === 0 && <p className="text-cacao-suave">Nadie coincide con «{query}».</p>}
        <ul className="grid gap-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setSheet(t.id)} className="grid w-full gap-2 rounded-3xl bg-nata p-3 text-left shadow-suave">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-bold">
                    n.º {t.ticketNumber} · {t.name}
                  </span>
                  <Tag tone={t.paid ? 'menta' : 'mantequilla'}>{t.paid ? raffleEuros(t.amount) : `Debe ${raffleEuros(t.amount)}`}</Tag>
                </span>
                <span className="flex flex-wrap gap-1">
                  {t.numbers.map((n) => (
                    <span
                      key={n}
                      className={cx(
                        'rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums',
                        raffle.draws.some((d) => d.number === n) ? 'bg-mantequilla text-mantequilla-oscuro' : 'bg-canela-claro text-canela-oscuro',
                      )}
                    >
                      {formatNumber(n, raffle.digits)}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <DrawSection raffle={raffle} tickets={tickets} />

      {!raffle.closed && (
        <NewTicketSheet
          raffle={raffle}
          open={sheet === 'nueva'}
          onClose={() => setSheet(null)}
          onCreated={(ticket) => {
            toast(`¡Hecho! ${ticket.numbers.length} números para ${ticket.name} 🍀`);
            setFresh(ticket);
            setSheet(ticket.id);
          }}
        />
      )}
      <TicketSheet raffle={raffle} ticket={current} open={Boolean(current)} onClose={() => setSheet(null)} canDelete={isAdmin(user)} />
      <RaffleSheet
        key={sheet === 'ajustes' ? `ajustes-${raffle.id}` : 'cerrado'}
        raffle={raffle}
        open={sheet === 'ajustes'}
        onClose={() => setSheet(null)}
        canDelete={isAdmin(user)}
        onDelete={removeRaffle}
        onSaved={() => {
          setSheet(null);
          toast('Cambios guardados');
        }}
      />
      {dialog}
    </AdminPage>
  );
}
