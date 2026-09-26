import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Cat,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCog,
  Users,
} from 'lucide-react';
import { Logo, LogoMark } from '../components/Logo.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { FormError, TextInput } from '../components/form.jsx';
import { Button, Spinner, cx } from '../components/ui.jsx';
import { api, ApiError } from '../lib/api.js';
import { AuthContext, isAdmin, useAdminApi } from './common.jsx';
import Dashboard from './Dashboard.jsx';
import CatsList from './CatsList.jsx';

// El resto de pantallas se descargan al abrirlas.
const CatEditor = lazy(() => import('./CatEditor.jsx'));
const Applications = lazy(() => import('./Applications.jsx'));
const ApplicationDetail = lazy(() => import('./ApplicationDetail.jsx'));
const Messages = lazy(() => import('./Inbox.jsx').then((m) => ({ default: m.Messages })));
const Volunteers = lazy(() => import('./Inbox.jsx').then((m) => ({ default: m.Volunteers })));
const Contents = lazy(() => import('./Contents.jsx'));
const Team = lazy(() => import('./Team.jsx'));
const Account = lazy(() => import('./Account.jsx'));

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      onLogin(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se ha podido entrar');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-fresa-claro/60 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[2rem] bg-crema p-6 shadow-flotante">
        <div className="text-center">
          <LogoMark className="mx-auto size-20" />
          <h1 className="mt-3 font-display text-3xl font-semibold">Panel de Bigotes</h1>
          <p className="mt-1 text-cacao-suave">Solo para el equipo de la asociación</p>
        </div>
        <div className="mt-6 grid gap-4">
          <TextInput label="Email" type="email" inputMode="email" autoComplete="username" value={email} onChange={setEmail} required />
          <TextInput label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />
          <FormError>{error}</FormError>
          <Button type="submit" size="lg" block loading={sending}>
            Entrar 🐾
          </Button>
        </div>
        <Link to="/" className="mt-5 block text-center text-sm font-bold text-cacao-suave underline">
          Volver a la web
        </Link>
      </form>
    </div>
  );
}

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="grid min-w-5 place-items-center rounded-full bg-fresa px-1 text-[11px] font-bold leading-5 text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function useNavItems(user) {
  const { data } = useAdminApi('/resumen');
  return [
    { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true, main: true },
    { to: '/admin/gatitos', label: 'Gatitos', icon: Cat, main: true },
    { to: '/admin/solicitudes', label: 'Solicitudes', icon: ClipboardList, badge: data?.applications.new, main: true },
    { to: '/admin/mensajes', label: 'Mensajes', icon: Inbox, badge: data?.messages.new, main: true },
    { to: '/admin/voluntariado', label: 'Voluntariado', icon: HeartHandshake, badge: data?.volunteers.new },
    { to: '/admin/contenidos', label: 'Textos de la web', icon: FileText },
    isAdmin(user) && { to: '/admin/equipo', label: 'Equipo', icon: Users },
    { to: '/admin/cuenta', label: 'Mi cuenta', icon: UserCog },
  ].filter(Boolean);
}

function Shell({ user, onLogout, children }) {
  const items = useNavItems(user);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMoreOpen(false), [location.pathname]);
  const moreBadge = items.filter((i) => !i.main).reduce((sum, i) => sum + (i.badge ?? 0), 0);

  const sideLink = ({ isActive }) =>
    cx('flex min-h-11 items-center gap-3 rounded-2xl px-3 font-bold transition', isActive ? 'bg-fresa-claro text-fresa-oscuro' : 'hover:bg-cacao/5');
  const bottomLink = ({ isActive }) =>
    cx('relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold', isActive ? 'text-fresa-oscuro' : 'text-cacao-suave');

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-borde bg-nata p-4 md:flex">
        <Link to="/admin" className="mb-4 px-2">
          <Logo />
          <span className="mt-1 block text-sm font-bold text-cacao-suave">Panel del equipo</span>
        </Link>
        {items.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink key={to} to={to} end={end} className={sideLink}>
            <Icon className="size-5" /> <span className="flex-1">{label}</span> <Badge count={badge} />
          </NavLink>
        ))}
        <div className="mt-auto grid gap-1">
          <a href="/" target="_blank" rel="noreferrer" className={sideLink({ isActive: false })}>
            <ExternalLink className="size-5" /> Ver la web
          </a>
          <button type="button" onClick={onLogout} className={sideLink({ isActive: false })}>
            <LogOut className="size-5" /> Salir
          </button>
        </div>
      </aside>

      <div>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-borde bg-crema/90 px-4 backdrop-blur md:hidden">
          <Link to="/admin" className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-semibold">Panel</span>
          </Link>
          <span className="truncate text-sm font-bold text-cacao-suave">
            {user.name} · {user.roleLabel}
          </span>
        </header>
        <main>
          <Suspense fallback={<Spinner />}>{children}</Suspense>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex rounded-t-[1.75rem] border-t border-borde bg-nata/95 px-2 pb-safe shadow-flotante backdrop-blur md:hidden" aria-label="Panel">
        {items
          .filter((i) => i.main)
          .map(({ to, label, icon: Icon, badge, end }) => (
            <NavLink key={to} to={to} end={end} className={bottomLink}>
              <span className="relative">
                <Icon className="size-6" />
                <span className="absolute -right-3 -top-1.5">
                  <Badge count={badge} />
                </span>
              </span>
              {label}
            </NavLink>
          ))}
        <button type="button" onClick={() => setMoreOpen(true)} className={bottomLink({ isActive: false })}>
          <span className="relative">
            <Menu className="size-6" />
            <span className="absolute -right-3 -top-1.5">
              <Badge count={moreBadge} />
            </span>
          </span>
          Más
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Más opciones">
        <ul className="grid gap-2">
          {items
            .filter((i) => !i.main)
            .map(({ to, label, icon: Icon, badge }) => (
              <li key={to}>
                <Link to={to} className="flex min-h-14 items-center gap-3 rounded-2xl bg-nata px-4 font-bold shadow-suave">
                  <Icon className="size-5 text-fresa" /> <span className="flex-1">{label}</span> <Badge count={badge} />
                  <ChevronRight className="size-5 text-cacao-suave" />
                </Link>
              </li>
            ))}
          <li>
            <a href="/" target="_blank" rel="noreferrer" className="flex min-h-14 items-center gap-3 rounded-2xl bg-nata px-4 font-bold shadow-suave">
              <ExternalLink className="size-5 text-fresa" /> <span className="flex-1">Ver la web</span>
            </a>
          </li>
          <li>
            <button type="button" onClick={onLogout} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-nata px-4 font-bold shadow-suave">
              <LogOut className="size-5 text-fresa" /> Salir
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Panel · Bigotes';
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
    // Si la sesión caduca o la desactivan mientras se usa el panel, volver al login.
    const onUnauthorized = () => setUser(null);
    window.addEventListener('bigotes:sesion-caducada', onUnauthorized);
    return () => window.removeEventListener('bigotes:sesion-caducada', onUnauthorized);
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    navigate('/admin');
  }

  if (user === undefined) return <Spinner label="Abriendo el panel…" />;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      <Shell user={user} onLogout={logout}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="gatitos" element={<CatsList />} />
          <Route path="gatitos/nuevo" element={<CatEditor key="nuevo" />} />
          <Route path="gatitos/:id" element={<CatEditor />} />
          <Route path="solicitudes" element={<Applications />} />
          <Route path="solicitudes/:id" element={<ApplicationDetail />} />
          <Route path="mensajes" element={<Messages />} />
          <Route path="voluntariado" element={<Volunteers />} />
          <Route path="contenidos" element={<Contents />} />
          {isAdmin(user) && <Route path="equipo" element={<Team />} />}
          <Route path="cuenta" element={<Account />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Shell>
    </AuthContext.Provider>
  );
}
