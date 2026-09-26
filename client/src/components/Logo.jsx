// Logo de la asociación, vectorizado a partir del original (brand/). Se sirve
// como SVG estático desde /public para que se cachee y no engorde el JS.

/** Carita de gato del logo (la «O» con orejas y nariz de corazón). */
export function LogoMark({ className = 'size-9' }) {
  return <img src="/logo-cara.svg" alt="" aria-hidden className={`object-contain ${className}`} />;
}

/** Palabra «Bigotes» del logo, para cabeceras. */
export function Logo({ className = 'h-9' }) {
  return <img src="/logo-texto.svg" alt="Bigotes" className={`w-auto ${className}`} width="163" height="40" />;
}

/** Logo completo con el lema: «Asociación para la ayuda al gato callejero». */
export function LogoFull({ className = 'w-64' }) {
  return (
    <img
      src="/logo-completo.svg"
      alt="Bigotes, asociación para la ayuda al gato callejero. Protección, cuidado y orientación ciudadana."
      className={`h-auto ${className}`}
      width="411"
      height="159"
    />
  );
}
