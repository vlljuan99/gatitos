// Retratos ilustrados de gatitos en SVG. Solo se usan para los datos de
// demostración (npm run seed:demo): en la web real van fotos de verdad.

const OUTLINE = '#3a2a30';

export const FURS = {
  naranja: { fur: '#f4a259', stripes: '#d9822b', muzzle: '#fde3c8' },
  gris: { fur: '#a9adb3', stripes: '#6e7277', muzzle: '#e9eaec' },
  negro: { fur: '#3b3638', stripes: null, muzzle: '#4a4447' },
  blanco: { fur: '#faf6f0', stripes: null, muzzle: '#ffffff', patches: '#b9bcc2' },
  carey: { fur: '#f3dcc0', stripes: null, muzzle: '#fff4e6', patches: '#3b3638', patches2: '#e0893a' },
  crema: { fur: '#f1d3a8', stripes: '#d9b07a', muzzle: '#fff1dc' },
};

const EYES = { verde: '#8bc34a', ambar: '#f2b33d', azul: '#6ec6f5' };

function decorations(color) {
  const items = [
    [140, 180, 1],
    [1040, 240, 0.8],
    [180, 1320, 0.9],
    [1030, 1260, 1.1],
    [560, 130, 0.6],
  ];
  return items
    .map(
      ([x, y, s], i) =>
        i % 2 === 0
          ? `<path transform="translate(${x} ${y}) scale(${s * 3})" d="M0 6 C-8 -4 -20 4 -12 14 L0 26 L12 14 C20 4 8 -4 0 6Z" fill="${color}" opacity=".55"/>`
          : `<g transform="translate(${x} ${y}) scale(${s * 2.2})" fill="${color}" opacity=".55"><ellipse cx="0" cy="12" rx="14" ry="11"/><circle cx="-14" cy="-6" r="6"/><circle cx="-4" cy="-13" r="6"/><circle cx="8" cy="-12" r="6"/><circle cx="17" cy="-3" r="6"/></g>`,
    )
    .join('');
}

export function catPortraitSvg({ fur = 'naranja', eyes = 'verde', background = '#ffd9e2', accent = '#f6a6b8', tilt = 0 } = {}) {
  const f = FURS[fur];
  const eye = EYES[eyes];
  const stripes = f.stripes
    ? `<g stroke="${f.stripes}" stroke-width="22" stroke-linecap="round" fill="none">
         <path d="M-60 -250 L-40 -170"/><path d="M0 -262 L0 -175"/><path d="M60 -250 L40 -170"/>
         <path d="M-320 -20 L-250 -10"/><path d="M-318 40 L-252 36"/><path d="M320 -20 L250 -10"/><path d="M318 40 L252 36"/>
       </g>`
    : '';
  const patches = f.patches
    ? `<g clip-path="url(#head)"><ellipse cx="-190" cy="-170" rx="170" ry="140" fill="${f.patches}"/>${
        f.patches2 ? `<ellipse cx="210" cy="-120" rx="150" ry="170" fill="${f.patches2}"/>` : ''
      }</g>`
    : '';
  const eyeShape = (x) => `
    <ellipse cx="${x}" cy="-30" rx="52" ry="60" fill="${eye}" stroke="${OUTLINE}" stroke-width="10"/>
    <ellipse cx="${x}" cy="-26" rx="20" ry="44" fill="#2b1d22"/>
    <circle cx="${x + 16}" cy="-52" r="13" fill="#fff"/>`;
  const whiskers = [
    [-160, 70, -440, 20],
    [-160, 100, -450, 110],
    [-160, 130, -420, 195],
  ]
    .map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}"/><path d="M${-x1} ${y1} L${-x2} ${y2}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs><clipPath id="head"><ellipse cx="0" cy="0" rx="330" ry="280"/></clipPath></defs>
  <rect width="1200" height="1500" fill="${background}"/>
  ${decorations(accent)}
  <g transform="translate(600 820) rotate(${tilt})">
    <ellipse cx="0" cy="470" rx="360" ry="300" fill="${f.fur}" stroke="${OUTLINE}" stroke-width="14"/>
    <ellipse cx="0" cy="500" rx="170" ry="190" fill="${f.muzzle}"/>
    <path d="M-265 -120 L-300 -440 L-70 -255 Z" fill="${f.fur}" stroke="${OUTLINE}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M265 -120 L300 -440 L70 -255 Z" fill="${f.fur}" stroke="${OUTLINE}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M-240 -170 L-262 -360 L-120 -250 Z" fill="#f6a6b8"/>
    <path d="M240 -170 L262 -360 L120 -250 Z" fill="#f6a6b8"/>
    <ellipse cx="0" cy="0" rx="330" ry="280" fill="${f.fur}"/>
    ${patches}
    ${stripes}
    <ellipse cx="0" cy="0" rx="330" ry="280" fill="none" stroke="${OUTLINE}" stroke-width="14"/>
    <ellipse cx="0" cy="95" rx="135" ry="90" fill="${f.muzzle}"/>
    ${eyeShape(-125)}${eyeShape(125)}
    <ellipse cx="-215" cy="85" rx="48" ry="30" fill="#f28ca5" opacity=".45"/>
    <ellipse cx="215" cy="85" rx="48" ry="30" fill="#f28ca5" opacity=".45"/>
    <path d="M-32 52 Q0 40 32 52 Q0 92 -32 52Z" fill="#f28ca5" stroke="${OUTLINE}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M0 80 Q-20 125 -60 108 M0 80 Q20 125 60 108" stroke="${OUTLINE}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <g stroke="${OUTLINE}" stroke-width="8" stroke-linecap="round">${whiskers}</g>
  </g>
</svg>`;
}
