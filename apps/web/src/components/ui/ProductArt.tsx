/* Hand-drawn SVG product illustrations in the Pure palette — no external assets. */

const NAVY = "#173a5c";
const BLUE = "#3f93cf";
const AMBER = "#c2722f";

type Props = { className?: string };

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={label} className="h-full w-full">
      <rect width="200" height="200" fill="#eaf3fa" />
      <circle cx="100" cy="102" r="70" fill="#f6f9fb" />
      {children}
    </svg>
  );
}

/** Glass bottle of fresh milk. */
export function MilkArt(_: Props) {
  const body = "M82,50 L118,50 L118,66 C132,72 132,84 132,92 L132,150 C132,161 124,168 114,168 L86,168 C76,168 68,161 68,150 L68,92 C68,84 68,72 82,66 Z";
  return (
    <Frame label="Fresh whole milk">
      <defs>
        <clipPath id="milkClip">
          <path d={body} />
        </clipPath>
      </defs>
      <rect x="80" y="38" width="40" height="14" rx="3" fill={NAVY} />
      <path d={body} fill="#ffffff" stroke={NAVY} strokeWidth="4" strokeLinejoin="round" />
      <rect x="64" y="112" width="72" height="60" fill="#cfe3f6" clipPath="url(#milkClip)" />
      <path d="M100,90 C108,100 110,106 100,112 C90,106 92,100 100,90 Z" fill={BLUE} clipPath="url(#milkClip)" />
      <rect x="74" y="126" width="52" height="20" rx="4" fill="#ffffff" stroke={NAVY} strokeWidth="2" clipPath="url(#milkClip)" />
      <text x="100" y="140" textAnchor="middle" fontSize="11" fontWeight="700" fill={NAVY} fontFamily="sans-serif">MILK</text>
    </Frame>
  );
}

/** Earthen pot of set curd. */
export function CurdArt(_: Props) {
  return (
    <Frame label="Thick curd, dahi">
      <path
        d="M68,98 C68,82 84,74 100,74 C116,74 132,82 132,98 C140,112 138,150 116,160 C108,164 92,164 84,160 C62,150 60,112 68,98 Z"
        fill="#ffffff"
        stroke={NAVY}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <ellipse cx="100" cy="80" rx="33" ry="11" fill="#f3f6f9" stroke={NAVY} strokeWidth="4" />
      <ellipse cx="100" cy="80" rx="24" ry="7" fill="#ffffff" />
      <circle cx="90" cy="80" r="2.4" fill={BLUE} opacity="0.55" />
      <circle cx="104" cy="78" r="2" fill={BLUE} opacity="0.5" />
      <circle cx="110" cy="82" r="2.2" fill={BLUE} opacity="0.5" />
      <path d="M120,70 L132,46" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="134" cy="44" rx="7" ry="4" transform="rotate(35 134 44)" fill={NAVY} />
    </Frame>
  );
}

/** Jar of cultured ghee. */
export function GheeArt(_: Props) {
  const body = "M70,84 L130,84 L130,150 C130,161 122,168 112,168 L88,168 C78,168 70,161 70,150 Z";
  return (
    <Frame label="Cultured ghee">
      <defs>
        <clipPath id="gheeClip">
          <path d={body} />
        </clipPath>
      </defs>
      <rect x="74" y="48" width="52" height="16" rx="4" fill={NAVY} />
      <rect x="80" y="64" width="40" height="22" rx="3" fill="#ffffff" stroke={NAVY} strokeWidth="3" />
      <path d={body} fill="#ffffff" stroke={NAVY} strokeWidth="4" strokeLinejoin="round" />
      <rect x="66" y="104" width="68" height="68" fill={AMBER} opacity="0.85" clipPath="url(#gheeClip)" />
      <rect x="66" y="104" width="68" height="8" fill="#d98a45" clipPath="url(#gheeClip)" />
      <ellipse cx="86" cy="128" rx="5" ry="10" fill="#ffffff" opacity="0.35" clipPath="url(#gheeClip)" />
    </Frame>
  );
}

/** Wide farm-scene banner: fields, a cow, the morning sun. */
export function FarmScene({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 800 300" role="img" aria-label="Vayumukhi farm at sunrise" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="300" fill="#eaf3fa" />
      <circle cx="640" cy="92" r="40" fill="#3f93cf" opacity="0.25" />
      <circle cx="640" cy="92" r="26" fill="#3f93cf" opacity="0.45" />
      {/* rolling fields */}
      <path d="M0,210 C160,180 320,235 480,205 C620,180 720,225 800,200 L800,300 L0,300 Z" fill="#dbe9d9" />
      <path d="M0,240 C200,215 360,260 540,235 C680,216 740,250 800,236 L800,300 L0,300 Z" fill="#cfe0cb" />
      {/* fence */}
      <g stroke="#173a5c" strokeWidth="4" opacity="0.5" strokeLinecap="round">
        <line x1="70" y1="210" x2="70" y2="250" />
        <line x1="130" y1="206" x2="130" y2="246" />
        <line x1="190" y1="210" x2="190" y2="250" />
        <line x1="55" y1="222" x2="205" y2="220" />
      </g>
      {/* cow */}
      <g transform="translate(430 168)">
        <ellipse cx="55" cy="55" rx="62" ry="38" fill="#ffffff" stroke="#173a5c" strokeWidth="5" />
        <path d="M30,40 q12,-10 24,0" fill="#173a5c" opacity="0.85" />
        <path d="M70,64 q14,-8 26,2" fill="#3f93cf" opacity="0.6" />
        <circle cx="40" cy="50" r="7" fill="#173a5c" opacity="0.85" />
        <line x1="22" y1="86" x2="22" y2="110" stroke="#173a5c" strokeWidth="6" strokeLinecap="round" />
        <line x1="44" y1="90" x2="44" y2="112" stroke="#173a5c" strokeWidth="6" strokeLinecap="round" />
        <line x1="78" y1="90" x2="78" y2="112" stroke="#173a5c" strokeWidth="6" strokeLinecap="round" />
        <line x1="100" y1="86" x2="100" y2="110" stroke="#173a5c" strokeWidth="6" strokeLinecap="round" />
        {/* head */}
        <g transform="translate(104 28)">
          <ellipse cx="20" cy="26" rx="22" ry="20" fill="#ffffff" stroke="#173a5c" strokeWidth="5" />
          <path d="M2,8 q-8,-12 4,-14 q4,8 -4,14 Z" fill="#173a5c" />
          <path d="M38,8 q8,-12 -4,-14 q-4,8 4,14 Z" fill="#173a5c" />
          <circle cx="13" cy="24" r="3" fill="#173a5c" />
          <circle cx="28" cy="24" r="3" fill="#173a5c" />
          <ellipse cx="20" cy="36" rx="9" ry="6" fill="#f6c6c6" stroke="#173a5c" strokeWidth="2" />
        </g>
      </g>
    </svg>
  );
}
