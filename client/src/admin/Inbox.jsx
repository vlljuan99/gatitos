import { useState } from 'react';
import { Archive, Mail, MailOpen, Phone, Trash2, UserCheck } from 'lucide-react';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { useToast } from '../components/Toast.jsx';
import { Card, EmptyState, ErrorState, Spinner, Tag, cx } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { volunteerAreaLabel } from '../lib/forms.js';
import { AdminPage, isAdmin, refreshAfterChange, StatusPill, Tabs, timeAgo, useAdminApi, useAuth, useConfirm } from './common.jsx';

function ActionButton({ onClick, href, icon: Icon, children, external }) {
  const className = 'inline-flex min-h-10 items-center gap-1.5 rounded-full bg-crema px-3 text-sm font-bold hover:bg-canela-claro';
  if (href) {
    return (
      <a href={href} className={className} target={external ? '_blank' : undefined} rel="noreferrer">
        <Icon className="size-4" /> {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon className="size-4" /> {children}
    </button>
  );
}

/** Bandeja genérica: pestañas por estado, tarjetas desplegables y acciones rápidas. */
function InboxPage({ title, subtitle, path, statuses, renderItem, emptyText, openStatus }) {
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi(path);
  const [tab, setTab] = useState(statuses[0].value);
  const [open, setOpen] = useState(null);
  const [ask, dialog] = useConfirm();

  async function setStatus(item, status) {
    try {
      await api(`/admin${path}/${item.id}`, { method: 'PATCH', body: { status } });
      refreshAfterChange();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  async function remove(item) {
    const ok = await ask({ title: '¿Borrar para siempre?', body: `Se borrarán los datos de ${item.name}.`, confirmLabel: 'Sí, borrar', danger: true });
    if (!ok) return;
    try {
      await api(`/admin${path}/${item.id}`, { method: 'DELETE' });
      refreshAfterChange();
      toast('Borrado');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  const items = (data?.items ?? []).filter((item) => item.status === tab);

  return (
    <AdminPage title={title} subtitle={subtitle}>
      <Tabs value={tab} onChange={setTab} tabs={statuses.map((s) => ({ ...s, count: s.value === 'archivado' ? 0 : data?.counts[s.value] }))} />
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && items.length === 0 && (
        <EmptyState title="Nada por aquí" tone="cielo">
          {emptyText}
        </EmptyState>
      )}
      <ul className="grid gap-2">
        {items.map((item) => {
          const expanded = open === item.id;
          return (
            <li key={item.id}>
              <Card className="p-0">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-4 text-left"
                  aria-expanded={expanded}
                  onClick={() => {
                    setOpen(expanded ? null : item.id);
                    if (!expanded && item.status === 'nuevo' && openStatus) setStatus(item, openStatus);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-lg font-semibold">{item.name}</span>
                      {item.status === 'nuevo' && <StatusPill status="nuevo">Nuevo</StatusPill>}
                    </div>
                    <p className={cx('text-sm text-cacao-suave', !expanded && 'line-clamp-2')}>{renderItem.preview(item)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-cacao-suave">{timeAgo(item.createdAt)}</span>
                </button>
                {expanded && (
                  <div className="grid gap-3 border-t border-borde p-4">
                    {renderItem.detail(item)}
                    <div className="flex flex-wrap gap-2">
                      <ActionButton href={`mailto:${item.email}`} icon={Mail}>
                        Responder
                      </ActionButton>
                      {item.phone && (
                        <>
                          <ActionButton href={`tel:${item.phone.replace(/\s/g, '')}`} icon={Phone}>
                            Llamar
                          </ActionButton>
                          <ActionButton href={whatsappUrl(item.phone, `¡Hola, ${item.name.split(' ')[0]}! Te escribimos de Bigotes 🐾`)} icon={WhatsAppIcon} external>
                            WhatsApp
                          </ActionButton>
                        </>
                      )}
                      {statuses
                        .filter((s) => s.value !== item.status)
                        .map((s) => (
                          <ActionButton key={s.value} onClick={() => setStatus(item, s.value)} icon={s.icon}>
                            {s.action}
                          </ActionButton>
                        ))}
                      {isAdmin(user) && (
                        <ActionButton onClick={() => remove(item)} icon={Trash2}>
                          Borrar
                        </ActionButton>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      {dialog}
    </AdminPage>
  );
}

export function Messages() {
  return (
    <InboxPage
      title="Mensajes"
      subtitle="Lo que llega desde el formulario de contacto."
      path="/mensajes"
      openStatus="leido"
      emptyText="No hay mensajes aquí."
      statuses={[
        { value: 'nuevo', label: 'Nuevos', action: 'Marcar como nuevo', icon: Mail },
        { value: 'leido', label: 'Leídos', action: 'Marcar como leído', icon: MailOpen },
        { value: 'archivado', label: 'Archivados', action: 'Archivar', icon: Archive },
      ]}
      renderItem={{
        preview: (m) => (m.subject ? `${m.subject} — ${m.body}` : m.body),
        detail: (m) => (
          <>
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="break-all text-sm text-cacao-suave">
              {m.email}
              {m.phone && ` · ${m.phone}`}
            </p>
          </>
        ),
      }}
    />
  );
}

export function Volunteers() {
  return (
    <InboxPage
      title="Voluntariado"
      subtitle="Personas que se ofrecen a echar una pata."
      path="/voluntariado"
      emptyText="No hay nadie en esta lista."
      statuses={[
        { value: 'nuevo', label: 'Nuevos', action: 'Marcar como nuevo', icon: Mail },
        { value: 'contactado', label: 'Contactados', action: 'Ya le hemos contactado', icon: UserCheck },
        { value: 'archivado', label: 'Archivados', action: 'Archivar', icon: Archive },
      ]}
      renderItem={{
        preview: (v) => `${v.municipality} · ${v.areas.map(volunteerAreaLabel).join(', ')}`,
        detail: (v) => (
          <>
            <div className="flex flex-wrap gap-1.5">
              {v.areas.map((area) => (
                <Tag key={area} tone="lavanda">
                  {volunteerAreaLabel(area)}
                </Tag>
              ))}
            </div>
            {v.availability && (
              <p>
                <strong>Disponibilidad:</strong> {v.availability}
              </p>
            )}
            {v.message && <p className="whitespace-pre-line">{v.message}</p>}
            <p className="break-all text-sm text-cacao-suave">
              {v.email} · {v.phone}
            </p>
          </>
        ),
      }}
    />
  );
}
