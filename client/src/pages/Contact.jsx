import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { SocialLinks, useSite } from '../components/Layout.jsx';
import { WhatsAppIcon, whatsappUrl } from '../components/BrandIcons.jsx';
import { Checkbox, FormError, Honeypot, TextArea, TextInput } from '../components/form.jsx';
import { Button, Card, PageHeader } from '../components/ui.jsx';
import { useForm } from '../lib/useForm.js';
import { useTitle } from '../lib/useTitle.js';

const INITIAL = { name: '', email: '', phone: '', subject: '', body: '', privacy: false, website: '' };

function Channel({ icon: Icon, label, href, children }) {
  const content = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-canela-claro text-canela-oscuro">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-sm text-cacao-suave">{label}</span>
        <span className="font-bold">{children}</span>
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="flex items-center gap-3 rounded-2xl p-1 hover:bg-crema" target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          {content}
        </a>
      ) : (
        <div className="flex items-center gap-3 p-1">{content}</div>
      )}
    </li>
  );
}

export default function Contact() {
  useTitle('Contacto');
  const { data } = useSite();
  const contact = data?.content.contact;
  const { values, set, field, errors, formError, sending, submit, setValues } = useForm(INITIAL);
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHeader title="Contacto" emoji="✉️">
        ¿Dudas sobre una adopción, quieres ayudar o has visto un gatito en apuros? Escríbenos.
      </PageHeader>
      <div className="grid gap-6 px-4 md:grid-cols-5">
        <Card className="self-start md:col-span-2">
          <ul className="grid gap-3">
            {contact?.whatsapp && (
              <Channel icon={WhatsAppIcon} label="WhatsApp" href={whatsappUrl(contact.whatsapp, '¡Hola, Bigotes! 🐾')}>
                {contact.whatsapp}
              </Channel>
            )}
            {contact?.phone && (
              <Channel icon={Phone} label="Teléfono" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                {contact.phone}
              </Channel>
            )}
            {contact?.email && (
              <Channel icon={Mail} label="Email" href={`mailto:${contact.email}`}>
                {contact.email}
              </Channel>
            )}
            <Channel icon={MapPin} label="Dónde estamos">
              {contact?.address || 'Almendralejo (Badajoz)'}
            </Channel>
            {contact?.hours && (
              <Channel icon={Clock} label="Horario">
                {contact.hours}
              </Channel>
            )}
          </ul>
          <SocialLinks contact={contact} className="mt-4" />
        </Card>

        <div className="md:col-span-3">
          {sent ? (
            <Card className="bg-menta text-center">
              <p className="text-5xl" aria-hidden>
                💌
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-menta-oscuro">¡Mensaje enviado!</h2>
              <p className="mt-1">Te responderemos lo antes posible. ¡Gracias por escribirnos!</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setValues(INITIAL);
                  setSent(false);
                }}
              >
                Enviar otro mensaje
              </Button>
            </Card>
          ) : (
            <form
              noValidate
              className="grid gap-5"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await submit('/mensajes')) setSent(true);
              }}
            >
              <Honeypot value={values.website} onChange={(v) => set('website', v)} />
              <TextInput label="Nombre" autoComplete="name" {...field('name')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput label="Email" type="email" inputMode="email" autoComplete="email" {...field('email')} />
                <TextInput label="Teléfono" type="tel" inputMode="tel" autoComplete="tel" optional {...field('phone')} />
              </div>
              <TextInput label="Asunto" optional {...field('subject')} />
              <TextArea label="Mensaje" rows={5} {...field('body')} />
              <Checkbox checked={values.privacy} onChange={(v) => set('privacy', v)} error={errors.privacy}>
                He leído la{' '}
                <Link to="/privacidad" target="_blank" className="font-bold text-canela-oscuro underline">
                  política de privacidad
                </Link>{' '}
                y acepto que Bigotes use estos datos para responderme.
              </Checkbox>
              <FormError>{formError}</FormError>
              <Button type="submit" size="lg" block loading={sending}>
                Enviar mensaje
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
