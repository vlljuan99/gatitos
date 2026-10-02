// Iconos de redes (lucide ya no incluye logotipos de marcas).

export function InstagramIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14 8.5V6.8c0-.8.5-1.3 1.3-1.3H17V2.3C16.6 2.2 15.4 2 14.1 2 11.3 2 9.5 3.7 9.5 6.7v1.8H6.5V12h3v10h4V12h3l.5-3.5H14Z" />
    </svg>
  );
}

export function WhatsAppIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/** Enlace de WhatsApp a partir de un teléfono español escrito de cualquier forma. */
export function whatsappUrl(phone, text) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 9) digits = `34${digits}`;
  if (digits.startsWith('0034')) digits = digits.slice(2);
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function instagramUrl(handle) {
  const clean = String(handle ?? '').trim();
  if (/^https?:\/\//.test(clean)) return clean;
  return `https://instagram.com/${clean.replace(/^@/, '')}`;
}
