import { useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cat, ChevronRight, Heart, House, Menu, Sparkles } from 'lucide-react';
import { Logo, LogoMark } from './Logo.jsx';
import { Sheet } from './Sheet.jsx';
import { buttonClass, cx } from './ui.jsx';
import { useFavorites } from '../lib/favorites.js';
import { useApi } from '../lib/useApi.js';
import { FacebookIcon, InstagramIcon, instagramUrl, WhatsAppIcon, whatsappUrl } from './BrandIcons.jsx';

export const useSite = () => useApi('/sitio');

const MAIN_LINKS = [
  { to: '/gatitos', label: 'Gatitos' },
  { to: '/match', label: 'Match' },
  { to: '/como-trabajamos', label: 'Cómo trabajamos' },
  { to: '/finales-felices', label: 'Finales felices' },
  { to: '/colabora', label: 'Colabora' },
  { to: '/contacto', label: 'Contacto' },
];

const MORE_LINKS = [
  { to: '/adoptar', label: 'Quiero adoptar', emoji: '🏡', tone: 'bg-fresa-claro' },
  { to: '/como-trabajamos', label: 'Cómo trabajamos', emoji: '🩺', tone: 'bg-menta' },
  { to: '/finales-felices', label: 'Finales felices', emoji: '💕', tone: 'bg-lavanda' },
  { to: '/colabora', label: 'Colabora', emoji: '🙋', tone: 'bg-mantequilla' },
  { to: '/contacto', label: 'Contacto', emoji: '✉️', tone: 'bg-cielo' },
];

function FavoritesBadge({ count, className }) {
  if (!count) return null;
  return (
    <span
      className={cx(
        'absolute grid min-w-5 place-items-center rounded-full bg-fresa px-1 text-[11px] font-bold leading-5 text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function Header() {
  const { slugs } = useFavorites();
  return (
    <header className="sticky top-0 z-30 border-b border-borde/70 bg-crema/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:h-16">
        <Link to="/" aria-label="Bigotes, ir al inicio">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
          {MAIN_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cx(
                  'rounded-full px-3 py-2 font-bold transition hover:bg-fresa-claro',
                  isActive ? 'text-fresa-oscuro' : 'text-cacao',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/favoritos"
            className="relative hidden size-11 place-items-center rounded-full text-fresa hover:bg-fresa-claro md:grid"
            aria-label={`Favoritos (${slugs.length})`}
          >
            <Heart className="size-6" />
            <FavoritesBadge count={slugs.length} className="-right-0.5 -top-0.5" />
          </Link>
          <Link to="/adoptar" className={buttonClass({ size: 'sm', className: 'md:min-h-11 md:px-5 md:text-base' })}>
            Quiero adoptar
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ onMore }) {
  const { slugs } = useFavorites();
  const item = ({ isActive }) =>
    cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition', isActive ? 'text-fresa-oscuro' : 'text-cacao-suave');
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[1.75rem] border-t border-borde bg-nata/95 px-2 pb-safe shadow-flotante backdrop-blur md:hidden"
      aria-label="Navegación principal"
    >
      <div className="flex items-end">
        <NavLink to="/" end className={item}>
          <House className="size-6" /> Inicio
        </NavLink>
        <NavLink to="/gatitos" className={item}>
          <Cat className="size-6" /> Gatitos
        </NavLink>
        <NavLink to="/match" className={({ isActive }) => cx(item({ isActive }), '-mt-5')}>
          {({ isActive }) => (
            <>
              <motion.span
                whileTap={{ scale: 0.9 }}
                className={cx(
                  'grid size-14 place-items-center rounded-full border-4 border-nata text-white shadow-suave',
                  isActive ? 'bg-fresa-oscuro' : 'bg-fresa',
                )}
              >
                <Sparkles className="size-6" />
              </motion.span>
              Match
            </>
          )}
        </NavLink>
        <NavLink to="/favoritos" className={item}>
          <span className="relative">
            <Heart className="size-6" />
            <FavoritesBadge count={slugs.length} className="-right-2.5 -top-1.5" />
          </span>
          Favoritos
        </NavLink>
        <button type="button" onClick={onMore} className={item({ isActive: false })}>
          <Menu className="size-6" /> Más
        </button>
      </div>
    </nav>
  );
}

function MoreSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Más cositas">
      <ul className="grid gap-2">
        {MORE_LINKS.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              onClick={onClose}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-nata px-4 font-bold shadow-suave"
            >
              <span className={cx('grid size-10 place-items-center rounded-xl text-xl', link.tone)} aria-hidden>
                {link.emoji}
              </span>
              <span className="flex-1">{link.label}</span>
              <ChevronRight className="size-5 text-cacao-suave" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-cacao-suave">
        <Link to="/aviso-legal" onClick={onClose} className="underline">
          Aviso legal
        </Link>
        <Link to="/privacidad" onClick={onClose} className="underline">
          Privacidad
        </Link>
        <Link to="/cookies" onClick={onClose} className="underline">
          Cookies
        </Link>
        <Link to="/admin" onClick={onClose} className="underline">
          Acceso del equipo
        </Link>
      </div>
    </Sheet>
  );
}

export function SocialLinks({ contact, className }) {
  if (!contact) return null;
  const links = [
    contact.instagram && { href: instagramUrl(contact.instagram), label: 'Instagram', Icon: InstagramIcon },
    contact.facebook && { href: contact.facebook, label: 'Facebook', Icon: FacebookIcon },
    contact.whatsapp && { href: whatsappUrl(contact.whatsapp), label: 'WhatsApp', Icon: WhatsAppIcon },
  ].filter(Boolean);
  if (links.length === 0) return null;
  return (
    <div className={cx('flex gap-2', className)}>
      {links.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className="grid size-11 place-items-center rounded-full bg-nata text-fresa-oscuro shadow-suave hover:bg-fresa-claro"
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}

function Footer() {
  const { data } = useSite();
  return (
    <footer className="mt-16 bg-fresa-claro/60 pb-28 md:pb-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-cacao-suave">
            Rescatamos gatitos en Almendralejo y les buscamos una familia para siempre.
          </p>
          <SocialLinks contact={data?.content.contact} className="mt-4" />
        </div>
        <nav aria-label="Pie de página" className="grid grid-cols-2 gap-2 font-bold md:col-span-2 md:grid-cols-3">
          {[...MAIN_LINKS, { to: '/adoptar', label: 'Quiero adoptar' }, { to: '/favoritos', label: 'Favoritos' }].map((link) => (
            <Link key={link.to} to={link.to} className="py-1 hover:text-fresa-oscuro">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 text-sm text-cacao-suave">
        <span className="flex items-center gap-1.5">
          <LogoMark className="size-5" /> Hecho con 💕 en Almendralejo
        </span>
        <Link to="/aviso-legal" className="underline">
          Aviso legal
        </Link>
        <Link to="/privacidad" className="underline">
          Privacidad
        </Link>
        <Link to="/cookies" className="underline">
          Cookies
        </Link>
        <Link to="/admin" className="underline">
          Acceso del equipo
        </Link>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const immersive = location.pathname === '/match';
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-nata focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido" className="mx-auto max-w-6xl">
        <Outlet />
      </main>
      {!immersive && <Footer />}
      {immersive && <div className="h-28 md:hidden" aria-hidden />}
      <BottomNav onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <ScrollRestoration />
    </>
  );
}
