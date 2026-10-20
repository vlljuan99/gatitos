import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Eye,
  FileText,
  HandHeart,
  House,
  NotebookPen,
  Package,
  Pill,
  Printer,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button, buttonClass, Card, cx } from '../components/ui.jsx';
import { AdminPage, useAuth } from './common.jsx';
import { paperUrl, PdfLink, usePaperToken } from './paperLinks.jsx';
import { PdfPreview } from './PdfPreview.jsx';

// Los enlaces a los PDF (con su permiso de media hora) están en paperLinks.jsx.
export { paperUrl, PdfLink, usePaperToken };

/**
 * Fila de un papel: icono, nombre, para qué sirve y botones: «Ver» (vista
 * previa dentro del panel), «PDF» para imprimir o guardar y, en los A5,
 * «2 por folio» para imprimir en una impresora normal y cortar.
 */
export function PaperRow({ icon: Icon, title, hint, path, a5, children, tone = 'bg-canela-claro text-canela-oscuro' }) {
  const [viewing, setViewing] = useState(false);
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
          <Button size="sm" variant="soft" onClick={() => setViewing(true)} aria-label={`Ver ${title}`}>
            <Eye className="size-4" /> Ver
          </Button>
        )}
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
      {path && <PdfPreview path={path} title={title} a5={a5} open={viewing} onClose={() => setViewing(false)} />}
    </li>
  );
}

/**
 * Papeles de un gatito. Arriba, lo del día a día: la ficha de seguimiento
 * (apuntar, ver e imprimir) y el parte veterinario; debajo, el resto.
 */
export function CatPapers({ cat, dirty, onNewReport, onNewNote }) {
  const hasFoster = Boolean(cat.record?.fosterId);
  const [viewing, setViewing] = useState(false);
  const followUp = `/gatito/${cat.id}/seguimiento`;
  return (
    <Card className="grid gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold">Papeles 🖨️</h2>
        <p className="text-sm text-cacao-suave">
          Salen rellenos con lo que hay en su ficha; lo que falte queda en blanco para escribirlo a mano.
        </p>
        {dirty && <p className="mt-2 rounded-2xl bg-mantequilla p-3 text-sm font-bold text-mantequilla-oscuro">Guarda los cambios para que salgan en los papeles.</p>}
      </div>
      <section className="grid gap-3 rounded-3xl bg-cielo/70 p-4" aria-labelledby={`seguimiento-${cat.id}`}>
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-nata text-cielo-oscuro">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <h3 id={`seguimiento-${cat.id}`} className="font-display text-lg font-semibold leading-tight">
              Ficha de seguimiento
            </h3>
            <p className="text-sm">La del día a día: lo que apuntéis aquí sale en ella (A5).</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onNewNote}>
            <NotebookPen className="size-5" /> Apuntar
          </Button>
          <Button variant="secondary" onClick={() => setViewing(true)} aria-label="Ver la ficha de seguimiento">
            <Eye className="size-5" /> Ver
          </Button>
          <PdfLink path={followUp} size="md" label="Imprimir la ficha de seguimiento">
            <Printer className="size-5" /> Imprimir
          </PdfLink>
          <Button variant="secondary" onClick={onNewReport} className="whitespace-nowrap max-sm:px-3">
            <Stethoscope className="size-5 max-sm:hidden" /> Nuevo parte
          </Button>
        </div>
      </section>
      <ul className="grid gap-2">
        <PaperRow icon={FileText} title="Ficha del gato" hint="A4 · su historia desde que llegó" path={`/gatito/${cat.id}/ficha`} />
        <PaperRow
          icon={House}
          title="Acuerdo de acogida"
          hint={hasFoster ? 'A5 · para firmar con su casa de acogida' : 'A5 · sin casa de acogida asignada: sus datos irán en blanco'}
          path={`/gatito/${cat.id}/acogida`}
          a5
          tone="bg-menta text-menta-oscuro"
        />
      </ul>
      <PdfPreview path={followUp} title="Ficha de seguimiento" a5 open={viewing} onClose={() => setViewing(false)} />
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

        <Group title="Socios y socias" hint="Los recibos de cada cuota salen desde la ficha de cada socio/a (y le llegan por correo).">
          <PaperRow icon={Users} title="Libro de socios y socias" hint="A4 · quién es socio/a, su cuota y hasta cuándo está al día" path="/socios" tone="bg-mantequilla text-mantequilla-oscuro">
            {go('/admin/socios', 'Ver')}
          </PaperRow>
          <PaperRow icon={UserPlus} title="Hoja de inscripción" hint="A5 · en blanco, para apuntarse en papel" path="/en-blanco/inscripcion" a5 tone="bg-lavanda text-lavanda-oscuro" />
          <PaperRow icon={Receipt} title="Recibo de cuota" hint="A5 · en blanco, para un pago en mano" path="/en-blanco/recibo" a5 tone="bg-menta text-menta-oscuro" />
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
