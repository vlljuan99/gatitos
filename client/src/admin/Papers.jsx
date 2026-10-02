import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  FileText,
  HandHeart,
  House,
  Package,
  Pill,
  Printer,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { buttonClass, Card, cx } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { AdminPage, useAuth } from './common.jsx';

// Papeles en PDF (los genera el servidor en /api/papeles). Se abren en una
// pestaña nueva o en el visor del móvil, donde no siempre viaja la cookie
// de sesión (sobre todo con el panel instalado como app), así que cada
// enlace lleva un permiso de media hora que se renueva solo.

let cached = null;
let pending = null;
const MARGIN = 5 * 60 * 1000;

function fresh() {
  return cached && cached.expires - Date.now() > MARGIN ? cached.token : null;
}

async function getToken() {
  if (fresh()) return cached.token;
  pending ??= api('/admin/papeles/permiso', { method: 'POST' })
    .then((result) => {
      cached = { token: result.token, expires: Date.parse(result.expiresAt) };
      return result.token;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Permiso vigente para abrir papeles (null mientras llega). */
export function usePaperToken() {
  const [token, setToken] = useState(fresh);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getToken()
        .then((value) => alive && setToken(value))
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return token;
}

export function paperUrl(path, token, { twoUp = false } = {}) {
  const params = new URLSearchParams();
  if (twoUp) params.set('hoja', 'a4');
  if (token) params.set('t', token);
  return `/api/papeles${path}?${params}`;
}

/** Botón que abre un PDF. twoUp: dos medias hojas A5 en un folio. */
export function PdfLink({ path, twoUp, children, variant = 'secondary', size = 'sm', block, className, label }) {
  const token = usePaperToken();
  return (
    <a
      href={token ? paperUrl(path, token, { twoUp }) : undefined}
      target="_blank"
      rel="noopener"
      aria-disabled={!token}
      aria-label={label}
      className={cx(buttonClass({ variant, size, block }), !token && 'pointer-events-none opacity-60', className)}
    >
      {children}
    </a>
  );
}

/**
 * Fila de un papel: icono, nombre, para qué sirve y botones. Los A5 llevan
 * además «2 por folio» para imprimir en una impresora normal y cortar.
 */
export function PaperRow({ icon: Icon, title, hint, path, a5, children, tone = 'bg-canela-claro text-canela-oscuro' }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-crema p-3">
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="font-bold leading-tight">{title}</p>
        {hint && <p className="text-sm text-cacao-suave">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        {path && (
          <PdfLink path={path} variant="primary" label={`Abrir ${title} en PDF`}>
            <Printer className="size-4" /> PDF
          </PdfLink>
        )}
        {path && a5 && (
          <PdfLink path={path} twoUp label={`${title}: dos por folio A4`}>
            2 por folio
          </PdfLink>
        )}
      </div>
    </li>
  );
}

/** Tarjeta de papeles en la ficha de un gatito (el parte se crea desde el historial). */
export function CatPapers({ cat, dirty, onNewReport }) {
  const hasFoster = Boolean(cat.record?.fosterId);
  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold">Papeles para imprimir 🖨️</h2>
        <p className="text-sm text-cacao-suave">
          Salen rellenos con lo que hay en su ficha; lo que falte queda en blanco para escribirlo a mano.
        </p>
        {dirty && <p className="mt-2 rounded-2xl bg-mantequilla p-3 text-sm font-bold text-mantequilla-oscuro">Guarda los cambios para que salgan en los papeles.</p>}
      </div>
      <ul className="grid gap-2">
        <PaperRow icon={FileText} title="Ficha del gato" hint="A4 · su historia desde que llegó" path={`/gatito/${cat.id}/ficha`} />
        <PaperRow
          icon={ClipboardList}
          title="Ficha de seguimiento"
          hint="A5 · historial, veterinario y pendientes"
          path={`/gatito/${cat.id}/seguimiento`}
          a5
          tone="bg-cielo text-cielo-oscuro"
        />
        <PaperRow
          icon={House}
          title="Acuerdo de acogida"
          hint={hasFoster ? 'A5 · para firmar con su casa de acogida' : 'A5 · sin casa de acogida asignada: sus datos irán en blanco'}
          path={`/gatito/${cat.id}/acogida`}
          a5
          tone="bg-menta text-menta-oscuro"
        />
        <PaperRow icon={Stethoscope} title="Parte veterinario" hint="A5 apaisado · uno por visita, numerado" tone="bg-melocoton text-melocoton-oscuro">
          <button type="button" onClick={onNewReport} className={buttonClass({ variant: 'primary', size: 'sm' })}>
            Nuevo parte
          </button>
        </PaperRow>
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Página «Papeles»: todos los documentos, rellenos o en blanco
// ---------------------------------------------------------------------------

function Group({ title, hint, children }) {
  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {hint && <p className="text-sm text-cacao-suave">{hint}</p>}
      </div>
      <ul className="grid gap-2">{children}</ul>
    </Card>
  );
}

const go = (to, label) => (
  <Link to={to} className={buttonClass({ variant: 'soft', size: 'sm' })}>
    {label}
  </Link>
);

export default function PapersPage() {
  const { user } = useAuth();
  return (
    <AdminPage title="Papeles 🖨️" subtitle="Todo listo para imprimir. Los de cada gato y cada adopción se rellenan solos desde su ficha; aquí también los tienes en blanco.">
      <div className="grid gap-4">
        <Group title="De cada gato" hint="Ábrelos desde la ficha del gatito para que salgan rellenos.">
          <PaperRow icon={FileText} title="Ficha del gato" hint="A4 · en blanco" path="/en-blanco/ficha">
            {go('/admin/gatitos', 'Elegir gato')}
          </PaperRow>
          <PaperRow icon={ClipboardList} title="Ficha de seguimiento" hint="A5 · en blanco" path="/en-blanco/seguimiento" a5 tone="bg-cielo text-cielo-oscuro" />
          <PaperRow icon={House} title="Acuerdo de acogida" hint="A5 · en blanco" path="/en-blanco/acogida" a5 tone="bg-menta text-menta-oscuro" />
          <PaperRow
            icon={Stethoscope}
            title="Parte veterinario"
            hint="A5 apaisado · en blanco y sin número. Mejor créalo desde la ficha del gato: queda numerado y apuntado."
            path="/en-blanco/parte"
            a5
            tone="bg-melocoton text-melocoton-oscuro"
          />
        </Group>

        <Group title="Adopciones y equipo">
          <PaperRow icon={FileText} title="Contrato de adopción" hint="A4 · se rellena desde cada solicitud" path="/en-blanco/contrato">
            {go('/admin/solicitudes?estado=aprobada', 'Solicitudes')}
          </PaperRow>
          <PaperRow
            icon={ShieldCheck}
            title="Compromiso de confidencialidad"
            hint="A4 · para el equipo, el voluntariado y las casas de acogida"
            path="/en-blanco/confidencialidad"
            tone="bg-lavanda text-lavanda-oscuro"
          >
            <PdfLink path={`/confidencialidad/equipo/${user.id}`}>El mío</PdfLink>
          </PaperRow>
        </Group>

        <Group title="Almacén y cuentas" hint="Salen con lo que hay apuntado ahora mismo y filas libres para seguir a mano.">
          <PaperRow icon={Pill} title="Inventario de medicación" hint="A4 · con caducidades e instrucciones" path="/medicacion" tone="bg-melocoton text-melocoton-oscuro">
            {go('/admin/inventario', 'Ver')}
          </PaperRow>
          <PaperRow icon={Package} title="Inventario general" hint="A4 · comida, arena, transportines…" path="/inventario" tone="bg-mantequilla text-mantequilla-oscuro">
            {go('/admin/inventario?tipo=general', 'Ver')}
          </PaperRow>
          <PaperRow icon={HandHeart} title="Registro de donaciones" hint="A4 · del año en curso" path="/donaciones" tone="bg-menta text-menta-oscuro">
            {go('/admin/donaciones', 'Ver')}
          </PaperRow>
        </Group>

        <Group title="En blanco para llevar encima" hint="Para un mercadillo, una recogida o cuando no hay cobertura.">
          <PaperRow icon={Pill} title="Inventario de medicación" hint="A4 · tabla vacía" path="/en-blanco/medicacion" tone="bg-melocoton text-melocoton-oscuro" />
          <PaperRow icon={Package} title="Inventario general" hint="A4 · tabla vacía" path="/en-blanco/inventario" tone="bg-mantequilla text-mantequilla-oscuro" />
          <PaperRow icon={HandHeart} title="Registro de donaciones" hint="A4 · tabla vacía" path="/en-blanco/donaciones" tone="bg-menta text-menta-oscuro" />
        </Group>
      </div>
    </AdminPage>
  );
}
