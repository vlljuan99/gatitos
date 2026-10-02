import { Link } from 'react-router-dom';
import { ClipboardList, HeartHandshake, Inbox, Plus, Printer, Smartphone, TriangleAlert, UserPlus } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { ButtonLink, Card, ErrorState, Spinner, cx } from '../components/ui.jsx';
import { AdminPage, isAdmin, shortDate, todayIso, useAdminApi, useAuth } from './common.jsx';

function Tile({ to, icon: Icon, count, label, tone }) {
  return (
    <Link to={to} className={cx('flex flex-col gap-2 rounded-3xl p-4 shadow-suave transition active:scale-[0.98]', tone)}>
      <Icon className="size-6" aria-hidden />
      <span className="font-display text-4xl font-semibold leading-none">{count}</span>
      <span className="text-sm font-bold leading-tight">{label}</span>
    </Link>
  );
}

/** Avisos: medicación que caduca, cosas que se acaban y revisiones veterinarias cercanas. */
function Alerts({ alerts }) {
  const today = todayIso();
  const rows = [
    ...alerts.expiring.map((item) => ({
      key: `c${item.id}`,
      to: '/admin/inventario',
      text: item.expiresOn < today ? `${item.name}: caducado el ${shortDate(item.expiresOn)}` : `${item.name}: caduca el ${shortDate(item.expiresOn)}`,
    })),
    ...alerts.low.map((item) => ({
      key: `p${item.id}`,
      to: item.kind === 'general' ? '/admin/inventario?tipo=general' : '/admin/inventario',
      text: `Queda poco: ${item.name} (${item.quantity.toLocaleString('es-ES')}${item.unit ? ` ${item.unit}` : ''})`,
    })),
    ...alerts.checks.map((check) => ({
      key: `r${check.catId}`,
      to: `/admin/gatitos/${check.catId}`,
      text: `Revisión de ${check.catName} el ${shortDate(check.nextCheck)}`,
    })),
  ];
  if (rows.length === 0) return null;
  return (
    <Card className="mb-5 bg-mantequilla">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-mantequilla-oscuro">
        <TriangleAlert className="size-5" aria-hidden /> Avisos
      </h2>
      <ul className="mt-2 grid gap-1">
        {rows.map((row) => (
          <li key={row.key}>
            <Link to={row.to} className="block rounded-xl px-2 py-1.5 font-semibold underline-offset-2 hover:underline">
              {row.text}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CatList({ cats, empty }) {
  if (cats.length === 0) return <p className="text-cacao-suave">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {cats.map((cat) => (
        <li key={cat.id}>
          <Link to={`/admin/gatitos/${cat.id}`} className="flex items-center gap-3 rounded-2xl p-1 hover:bg-crema">
            <CatPhoto cat={cat} sizes="48px" className="size-12 rounded-xl" alt="" />
            <span className="flex-1 font-bold">{cat.name}</span>
            <span className="text-sm font-bold text-canela-oscuro">{cat.likes} 💕</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAdminApi('/resumen');
  const hour = new Date().getHours();
  const greeting = hour < 13 ? '¡Buenos días' : hour < 21 ? '¡Buenas tardes' : '¡Buenas noches';

  return (
    <AdminPage title={`${greeting}, ${user.name.split(' ')[0]}! 🐾`} subtitle="Esto es lo que hay pendiente hoy.">
      <div className={cx('mb-5 grid gap-3 sm:grid-cols-2', isAdmin(user) && 'lg:grid-cols-3')}>
        <ButtonLink to="/admin/gatitos/nuevo" size="lg" block>
          <Plus className="size-6" /> Nuevo gatito
        </ButtonLink>
        <ButtonLink to="/admin/papeles" variant="secondary" size="lg" block>
          <Printer className="size-5" /> Papeles
        </ButtonLink>
        {isAdmin(user) && (
          <ButtonLink to="/admin/equipo?nuevo" variant="secondary" size="lg" block>
            <UserPlus className="size-5" /> Añadir al equipo
          </ButtonLink>
        )}
      </div>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <Alerts alerts={data.alerts} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile to="/admin/solicitudes" icon={ClipboardList} count={data.applications.new} label="solicitudes nuevas" tone="bg-canela-claro text-canela-oscuro" />
            <Tile to="/admin/mensajes" icon={Inbox} count={data.messages.new} label="mensajes sin leer" tone="bg-cielo text-cielo-oscuro" />
            <Tile to="/admin/voluntariado" icon={HeartHandshake} count={data.volunteers.new} label="voluntarios nuevos" tone="bg-lavanda text-lavanda-oscuro" />
            <Tile to="/admin/solicitudes" icon={ClipboardList} count={data.applications.open} label="adopciones en marcha" tone="bg-menta text-menta-oscuro" />
          </div>

          <Card className="mt-5">
            <h2 className="font-display text-xl font-semibold">Gatitos</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {[
                ['disponible', 'Disponibles', 'bg-menta text-menta-oscuro'],
                ['reservado', 'Reservados', 'bg-mantequilla text-mantequilla-oscuro'],
                ['adoptado', 'Adoptados', 'bg-lavanda text-lavanda-oscuro'],
                ['borrador', 'Borradores', 'bg-cacao/10 text-cacao-suave'],
                ['colonia', 'Colonias', 'bg-cielo text-cielo-oscuro'],
              ].map(([status, label, tone]) => (
                <Link key={status} to={`/admin/gatitos?estado=${status}`} className={cx('rounded-2xl p-2', tone)}>
                  <span className="block font-display text-2xl font-semibold">{data.cats[status]}</span>
                  <span className="text-xs font-bold">{label}</span>
                </Link>
              ))}
            </div>
          </Card>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="font-display text-xl font-semibold">Los más queridos 💕</h2>
              <p className="mb-3 text-sm text-cacao-suave">Los que más «Me encanta» reciben en la web.</p>
              <CatList cats={data.mostLoved} empty="Todavía no hay gatitos disponibles." />
            </Card>
            <Card>
              <h2 className="font-display text-xl font-semibold">Necesitan un empujón 📣</h2>
              <p className="mb-3 text-sm text-cacao-suave">Pocos corazones y mucho tiempo esperando: ¡compártelos en redes!</p>
              <CatList cats={data.needLove} empty="Todavía no hay gatitos disponibles." />
            </Card>
          </div>

          <Card className="mt-5 flex gap-4 bg-mantequilla">
            <Smartphone className="size-8 shrink-0 text-mantequilla-oscuro" aria-hidden />
            <div>
              <h2 className="font-display text-lg font-semibold">Ten el panel a mano</h2>
              <p className="text-sm">
                En el móvil, abre el menú del navegador y pulsa «Añadir a pantalla de inicio». Así subes gatitos en un momento, como si
                fuera una app.
              </p>
            </div>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
