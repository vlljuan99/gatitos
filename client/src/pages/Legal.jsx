import { useSite } from '../components/Layout.jsx';
import { ErrorState, Pending, PageHeader, Spinner } from '../components/ui.jsx';
import { useTitle } from '../lib/useTitle.js';

// Textos legales básicos (LSSI, RGPD y cookies) rellenados con los datos que
// la administración escribe en el panel. Lo que falte sale marcado como
// [pendiente] para que se vea. Conviene que alguien de la asociación los revise.

function Value({ children, label }) {
  return children ? <strong>{children}</strong> : <Pending>{label}</Pending>;
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-2 grid gap-3 text-lg leading-relaxed text-cacao-suave [&_strong]:text-cacao">{children}</div>
    </section>
  );
}

function LegalNotice({ legal, email }) {
  return (
    <>
      <Section title="Titular de la web">
        <p>
          En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información (LSSI), te informamos de que esta web
          pertenece a <Value label="nombre legal">{legal.holder}</Value>, con CIF <Value label="CIF">{legal.cif}</Value>, inscrita
          en <Value label="registro de asociaciones y número">{legal.registry}</Value>, con domicilio en{' '}
          <Value label="domicilio">{legal.address}</Value> y email de contacto <Value label="email">{email}</Value>.
        </p>
      </Section>
      <Section title="Uso de la web">
        <p>
          La web sirve para dar a conocer a los gatitos en adopción, explicar cómo trabajamos y recibir solicitudes de adopción,
          ofertas de voluntariado y mensajes. Quien la usa se compromete a hacerlo de buena fe y a no enviar información falsa.
        </p>
      </Section>
      <Section title="Contenidos y fotos">
        <p>
          Los textos y las fotos de los gatitos son de la asociación o se publican con permiso de sus autores. Puedes compartir
          las fichas de los gatitos para ayudarles a encontrar familia; para cualquier otro uso, pregúntanos antes.
        </p>
      </Section>
      <Section title="Responsabilidad">
        <p>
          Intentamos que la información de cada gatito sea correcta y esté al día, pero su estado puede cambiar. La adopción solo
          se formaliza con el contrato firmado con la asociación.
        </p>
      </Section>
    </>
  );
}

function Privacy({ legal, email }) {
  return (
    <>
      <Section title="Quién trata tus datos">
        <p>
          <Value label="nombre legal">{legal.holder}</Value> (CIF <Value label="CIF">{legal.cif}</Value>),{' '}
          <Value label="domicilio">{legal.address}</Value>. Puedes escribirnos a <Value label="email">{email}</Value>.
        </p>
      </Section>
      <Section title="Qué datos usamos y para qué">
        <p>
          <strong>Solicitudes de adopción:</strong> tus datos de contacto y las respuestas del cuestionario, para valorar si el
          gatito y tu hogar encajan, hablar contigo, organizar la visita, firmar el contrato y hacer el seguimiento de la adopción.
        </p>
        <p>
          <strong>Voluntariado:</strong> tus datos de contacto y disponibilidad, para organizar la ayuda.
        </p>
        <p>
          <strong>Mensajes de contacto:</strong> lo que nos escribes, para responderte.
        </p>
      </Section>
      <Section title="Base legal">
        <p>
          Tu consentimiento, que nos das al enviar cada formulario (art. 6.1.a del RGPD), y, en las adopciones, la aplicación de
          medidas precontractuales a petición tuya (art. 6.1.b). Puedes retirar tu consentimiento cuando quieras.
        </p>
      </Section>
      <Section title="Cuánto tiempo los guardamos">
        <p>
          Las solicitudes que no siguen adelante y los mensajes archivados se borran automáticamente al cabo de un año. Los datos
          de las adopciones realizadas se conservan mientras dure el seguimiento y los plazos que marca la ley.
        </p>
      </Section>
      <Section title="Quién más los ve">
        <p>
          Nadie fuera del equipo de la asociación. No cedemos ni vendemos datos. La web está alojada en servidores de Hetzner
          Online GmbH en la Unión Europea, que actúa como encargado del tratamiento.
        </p>
      </Section>
      <Section title="Tus derechos">
        <p>
          Puedes pedir acceder a tus datos, corregirlos, borrarlos, oponerte o limitar su uso y llevártelos, escribiendo a{' '}
          <Value label="email">{email}</Value>. Si crees que no los tratamos bien, puedes reclamar ante la Agencia Española de
          Protección de Datos (aepd.es).
        </p>
      </Section>
      <Section title="Menores">
        <p>Los formularios son solo para personas mayores de edad.</p>
      </Section>
    </>
  );
}

function Cookies() {
  return (
    <>
      <Section title="Sin cookies de publicidad ni de analítica">
        <p>
          Esta web no usa cookies de publicidad, de seguimiento ni de analítica, y no carga contenidos de terceros (las tipografías
          se sirven desde la propia web). Por eso no te mostramos ningún aviso de cookies.
        </p>
      </Section>
      <Section title="Lo único que guardamos">
        <p>
          <strong>Tus favoritos:</strong> los gatitos a los que das «Me encanta» se guardan en el almacenamiento de tu navegador,
          solo en tu dispositivo. Cada «Me encanta» suma, de forma anónima, un contador por gatito que ayuda al equipo a saber
          cuáles gustan más.
        </p>
        <p>
          <strong>Borradores de los formularios:</strong> mientras rellenas la solicitud de adopción, el formulario de contacto o
          el de voluntariado, lo que escribes se guarda en tu navegador para que no lo pierdas si la página se recarga. Se borra
          al enviarlo o al cerrar la pestaña, y nunca sale de tu dispositivo hasta que lo envías.
        </p>
        <p>
          <strong>Sesión del equipo:</strong> solo quienes gestionan la web reciben una cookie técnica para mantener abierta su
          sesión en el panel.
        </p>
      </Section>
    </>
  );
}

const PAGES = {
  aviso: { title: 'Aviso legal', Component: LegalNotice },
  privacidad: { title: 'Política de privacidad', Component: Privacy },
  cookies: { title: 'Política de cookies', Component: Cookies },
};

export default function Legal({ page }) {
  const { title, Component } = PAGES[page];
  useTitle(title);
  const { data, error, loading, reload } = useSite();
  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { legal, contact } = data.content;
  return (
    <div className="max-w-3xl pb-6">
      <PageHeader title={title} />
      <div className="px-4">
        <Component legal={legal} email={legal.email || contact.email} />
      </div>
    </div>
  );
}
