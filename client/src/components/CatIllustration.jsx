// Carita de gato ilustrada: sustituye a la foto cuando un gatito todavía no
// tiene ninguna y decora los estados vacíos.

const BACKGROUNDS = {
  canela: '#f3ebe8',
  lavanda: '#ebe4fd',
  menta: '#d7f3e8',
  mantequilla: '#fff1c2',
  melocoton: '#ffe4d1',
  cielo: '#dcefff',
};
const FURS = ['#f4a259', '#a9adb3', '#3b3638', '#faf6f0', '#f1d3a8'];

export function CatIllustration({ tone = 'canela', fur, seed = 0, className = '', label }) {
  const furColor = fur ?? FURS[Math.abs(seed) % FURS.length];
  const dark = furColor === '#3b3638';
  const outline = '#2b2727';
  const muzzle = dark ? '#4a4447' : '#fff4e8';
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="200" height="200" fill={BACKGROUNDS[tone] ?? BACKGROUNDS.canela} />
      <g transform="translate(100 118)">
        <ellipse cx="0" cy="92" rx="72" ry="52" fill={furColor} stroke={outline} strokeWidth="4" />
        <path d="M-52 -26 L-60 -88 L-14 -52 Z" fill={furColor} stroke={outline} strokeWidth="4" strokeLinejoin="round" />
        <path d="M52 -26 L60 -88 L14 -52 Z" fill={furColor} stroke={outline} strokeWidth="4" strokeLinejoin="round" />
        <path d="M-47 -36 L-51 -70 L-25 -50 Z" fill="#e8c9c1" />
        <path d="M47 -36 L51 -70 L25 -50 Z" fill="#e8c9c1" />
        <ellipse cx="0" cy="0" rx="66" ry="56" fill={furColor} stroke={outline} strokeWidth="4" />
        <ellipse cx="0" cy="19" rx="27" ry="18" fill={muzzle} />
        <ellipse cx="-25" cy="-6" rx="9" ry="11" fill={dark ? '#f2b33d' : outline} />
        <ellipse cx="25" cy="-6" rx="9" ry="11" fill={dark ? '#f2b33d' : outline} />
        {dark && (
          <>
            <ellipse cx="-25" cy="-5" rx="3.5" ry="8" fill="#2b1d22" />
            <ellipse cx="25" cy="-5" rx="3.5" ry="8" fill="#2b1d22" />
          </>
        )}
        <circle cx="-22" cy="-10" r="3" fill="#fff" />
        <circle cx="28" cy="-10" r="3" fill="#fff" />
        <ellipse cx="-43" cy="17" rx="10" ry="6" fill="#d9a89c" opacity=".45" />
        <ellipse cx="43" cy="17" rx="10" ry="6" fill="#d9a89c" opacity=".45" />
        {/* Nariz de corazón, como en el logo */}
        <path d="M0 15 C-3 12 -9 8 -9 4 C-9 1 -6 0 -4 0 C-2 0 -1 1 0 3 C1 1 2 0 4 0 C6 0 9 1 9 4 C9 8 3 12 0 15Z" fill="#977b73" />
        <path d="M0 16 Q-4 25 -12 21 M0 16 Q4 25 12 21" stroke={dark ? '#c9bfc3' : outline} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <g stroke={dark ? '#c9bfc3' : outline} strokeWidth="2.2" strokeLinecap="round">
          <path d="M-30 14 L-86 4" />
          <path d="M-30 21 L-86 26" />
          <path d="M30 14 L86 4" />
          <path d="M30 21 L86 26" />
        </g>
      </g>
    </svg>
  );
}
