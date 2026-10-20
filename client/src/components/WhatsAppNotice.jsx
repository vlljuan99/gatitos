import { WhatsAppIcon, whatsappUrl } from './BrandIcons.jsx';
import { useSite } from './Layout.jsx';
import { buttonClass, cx } from './ui.jsx';

// Tras enviar un formulario: «Avísanos por WhatsApp», con el mensaje ya
// escrito, al WhatsApp de la asociación («Textos de la web → Contacto»). Así
// el equipo se entera al momento y responde desde el móvil, sin la API de
// pago de Meta. Si no hay número, no sale nada.

export const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || '';

export function WhatsAppNotice({ text, className }) {
  const { data } = useSite();
  const number = data?.content?.contact?.whatsapp;
  if (!number) return null;
  return (
    <div className={cx('grid gap-2', className)}>
      <a
        href={whatsappUrl(number, text)}
        target="_blank"
        rel="noreferrer"
        className={cx(buttonClass({ size: 'lg', block: true }), 'bg-[#177a41] hover:bg-[#12663a]')}
      >
        <WhatsAppIcon /> Avísanos por WhatsApp
      </a>
      <p className="text-center text-sm text-cacao-suave">Se abre WhatsApp con el mensaje ya escrito: así te atendemos antes.</p>
    </div>
  );
}
