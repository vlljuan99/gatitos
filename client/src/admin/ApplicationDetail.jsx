import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, Mail, Phone, Send, Trash2 } from 'lucide-react';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button, Card, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { gendered, statusLabel } from '../lib/cats.js';
import { APPLICATION_QUESTIONS } from '../lib/forms.js';
import { AdminPage, formatDate, isAdmin, refreshAfterChange, StatusPill, timeAgo, useAdminApi, useAuth, useConfirm } from './common.jsx';
import { APPLICATION_STATUSES } from './Applications.jsx';

function ContactButton({ href, icon: Icon, label, external }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel="noreferrer"
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-nata text-xs font-bold shadow-suave"
    >
      <Icon className="size-5 text-fresa-oscuro" /> {label}
    </a>
  );
}

function Answers({ application }) {
  const answers = application.answers;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {APPLICATION_QUESTIONS.map((group) => (
        <Card key={group.title}>
          <h2 className="font-display text-lg font-semibold">{group.title}</h2>
          <dl className="mt-2 grid gap-3">
            {group.items.map((item) => {
              const raw = answers[item.key];
              const value = item.format ? item.format(raw, answers) : raw;
              if (value === null || value === undefined || value === '') return null;
              const warn = item.warn?.(raw);
              return (
                <div key={item.key}>
                  <dt className="text-sm text-cacao-suave">{item.label}</dt>
                  <dd className={cx('whitespace-pre-line font-semibold', warn && 'text-fresa-oscuro')}>
                    {warn && <CircleAlert className="mr-1 inline size-4 align-[-2px]" aria-label="Atención" />}
                    {String(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      ))}
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi(`/solicitudes/${id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, dialog] = useConfirm();

  if (loading) return <Spinner />;
  if (error) {
    return (
      <AdminPage title="Solicitud" back="/admin/solicitudes">
        <ErrorState error={error} onRetry={reload} />
      </AdminPage>
    );
  }
  const app = data.application;
  const cat = app.cat;
  const firstName = app.name.split(' ')[0];

  async function changeStatus(status) {
    if (status === app.status) return;
    let catStatus;
    // Al aprobar o cerrar la adopción, ofrecer actualizar también la ficha del gatito.
    if (cat && status === 'aprobada' && cat.status === 'disponible') {
      catStatus = await ask({
        title: `¿Reservamos a ${cat.name}?`,
        body: 'Así nadie más lo solicita mientras termináis el proceso.',
        options: [
          { value: 'reservado', label: `Sí, marcar como ${gendered('reservado', cat.sex)}` },
          { value: 'no', label: 'No, solo cambiar la solicitud' },
        ],
      });
      if (catStatus === null) return;
    }
    if (cat && status === 'adoptado' && cat.status !== 'adoptado') {
      catStatus = await ask({
        title: `¡${cat.name} se va a casa! 🎉`,
        body: `¿Lo marcamos como ${gendered('adoptado', cat.sex)}? Pasará a «Finales felices» en la web.`,
        options: [
          { value: 'adoptado', label: `Sí, marcar como ${gendered('adoptado', cat.sex)}` },
          { value: 'no', label: 'No, solo cambiar la solicitud' },
        ],
      });
      if (catStatus === null) return;
    }
    setBusy(true);
    try {
      await api(`/admin/solicitudes/${app.id}`, {
        method: 'PATCH',
        body: { status, ...(catStatus && catStatus !== 'no' ? { catStatus } : {}) },
      });
      refreshAfterChange();
      toast('Estado actualizado');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api(`/admin/solicitudes/${app.id}/notas`, { method: 'POST', body: { body: note } });
      setNote('');
      refreshAfterChange();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    const ok = await ask({
      title: '¿Borrar esta solicitud?',
      body: 'Se borran sus datos y sus notas para siempre. Si la persona lo pide (derecho de supresión), es lo que hay que hacer.',
      confirmLabel: 'Sí, borrar',
      danger: true,
    });
    if (!ok) return;
    await api(`/admin/solicitudes/${app.id}`, { method: 'DELETE' });
    refreshAfterChange();
    toast('Solicitud borrada');
    navigate('/admin/solicitudes', { replace: true });
  }

  const greeting = `¡Hola, ${firstName}! Te escribimos de Bigotes por tu solicitud de adopción${cat ? ` de ${cat.name}` : ''} 🐾`;

  return (
    <AdminPage title={app.name} back={`/admin/solicitudes?estado=${app.status}`} subtitle={`${app.municipality} (${app.province}) · ${timeAgo(app.createdAt)}`}>
      <div className="grid gap-4">
        <div className="flex gap-2">
          <ContactButton href={`tel:${app.phone.replace(/\s/g, '')}`} icon={Phone} label="Llamar" />
          <ContactButton href={whatsappUrl(app.phone, greeting)} icon={WhatsAppIcon} label="WhatsApp" external />
          <ContactButton
            href={`mailto:${app.email}?subject=${encodeURIComponent('Tu solicitud de adopción en Bigotes')}&body=${encodeURIComponent(greeting)}`}
            icon={Mail}
            label="Email"
          />
        </div>

        {cat ? (
          <Link to={`/admin/gatitos/${cat.id}`} className="flex items-center gap-3 rounded-3xl bg-nata p-2 pr-4 shadow-suave">
            <CatPhoto cat={{ ...cat, photos: cat.photo ? [cat.photo] : [] }} sizes="64px" className="size-16 rounded-2xl" alt="" />
            <div>
              <p className="text-sm text-cacao-suave">Quiere adoptar a</p>
              <p className="font-display text-xl font-semibold">{cat.name}</p>
            </div>
            <StatusPill status={cat.status} className="ml-auto">
              {statusLabel(cat.status, cat.sex)}
            </StatusPill>
          </Link>
        ) : (
          <Card className="bg-lavanda">
            <p className="font-bold text-lavanda-oscuro">
              {app.catName ? `Solicitó a ${app.catName}, que ya no está en la web.` : 'No ha elegido gatito: quiere que le aconsejemos.'}
            </p>
          </Card>
        )}

        <Card>
          <h2 className="font-display text-lg font-semibold">Etapa</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {APPLICATION_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={busy}
                onClick={() => changeStatus(s.value)}
                aria-pressed={app.status === s.value}
                className={cx(
                  'min-h-11 rounded-2xl border-2 px-3 font-bold transition',
                  app.status === s.value ? 'border-cacao bg-cacao text-white' : 'border-borde bg-nata hover:border-fresa-pastel',
                )}
              >
                {s.single}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Contacto</h2>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-cacao-suave">Email</dt>
              <dd className="break-all font-semibold">{app.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-cacao-suave">Teléfono</dt>
              <dd className="font-semibold">{app.phone}</dd>
            </div>
            <div>
              <dt className="text-sm text-cacao-suave">Enviada</dt>
              <dd className="font-semibold">{formatDate(app.createdAt)}</dd>
            </div>
          </dl>
        </Card>

        <Answers application={app} />

        <Card>
          <h2 className="font-display text-lg font-semibold">Notas del equipo</h2>
          <p className="text-sm text-cacao-suave">Solo las ve el equipo. Apunta aquí llamadas, visitas, dudas…</p>
          {app.notes.length > 0 && (
            <ol className="mt-4 grid gap-3 border-l-2 border-fresa-claro pl-4">
              {app.notes.map((n) => (
                <li key={n.id}>
                  <p className="text-xs font-bold text-cacao-suave">
                    {n.author} · {timeAgo(n.createdAt)}
                  </p>
                  <p className="whitespace-pre-line">{n.body}</p>
                </li>
              ))}
            </ol>
          )}
          <form onSubmit={addNote} className="mt-4 flex gap-2">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Escribe una nota…"
              aria-label="Nueva nota"
              className="min-w-0 flex-1 rounded-2xl border-2 border-borde bg-nata px-4 py-2 focus:border-fresa focus:outline-none"
            />
            <Button type="submit" disabled={!note.trim() || busy} aria-label="Añadir nota" className="self-end">
              <Send className="size-5" />
            </Button>
          </form>
        </Card>

        {isAdmin(user) && (
          <Button variant="danger" onClick={destroy} className="justify-self-start">
            <Trash2 className="size-4" /> Borrar solicitud
          </Button>
        )}
      </div>
      {dialog}
    </AdminPage>
  );
}
