/** Shared SVG symbols (krathong, crown, lotus). Render once near the root, reference with <use href="#kr" />. */
export default function Symbols() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="leafA" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5fd39a" />
          <stop offset="1" stopColor="#1b6b45" />
        </linearGradient>
        <linearGradient id="goldG" x1="0" x2="1">
          <stop offset="0" stopColor="#9c7a22" />
          <stop offset=".5" stopColor="#f7e3a1" />
          <stop offset="1" stopColor="#b8892b" />
        </linearGradient>
        <symbol id="kr" viewBox="0 0 120 92">
          <ellipse cx="60" cy="80" rx="54" ry="9" fill="#14523a" />
          <path d="M6 76 Q60 98 114 76 L106 64 Q60 84 14 64Z" fill="url(#leafA)" />
          <g fill="#3bb57a">
            <path d="M14 64 L20 50 L28 62Z" /><path d="M30 68 L36 52 L44 66Z" /><path d="M48 70 L54 54 L62 70Z" />
            <path d="M66 70 L72 54 L78 68Z" /><path d="M82 66 L88 52 L94 62Z" /><path d="M96 62 L100 50 L106 60Z" />
          </g>
          <path d="M22 58 Q60 74 98 58 L90 46 Q60 60 30 46Z" fill="#7be0a8" />
          <circle cx="36" cy="48" r="7" fill="#ff7eb6" /><circle cx="36" cy="48" r="3" fill="#ffd1e6" />
          <circle cx="60" cy="44" r="9" fill="#f7e3a1" /><circle cx="60" cy="44" r="4" fill="#fff" />
          <circle cx="84" cy="48" r="7" fill="#c59bff" /><circle cx="84" cy="48" r="3" fill="#eadcff" />
          <rect x="57.5" y="18" width="5" height="24" rx="2" fill="#fff4dc" />
          <rect x="47" y="24" width="2.5" height="18" rx="1" fill="#e9c97a" />
          <rect x="70.5" y="24" width="2.5" height="18" rx="1" fill="#e9c97a" />
        </symbol>
        <symbol id="crown" viewBox="0 0 64 44">
          <path d="M4 40 L8 12 L22 26 L32 4 L42 26 L56 12 L60 40Z" fill="url(#goldG)" stroke="#fff4cf" strokeWidth="1" />
          <circle cx="32" cy="4" r="3.5" fill="#fff4cf" /><circle cx="8" cy="12" r="3" fill="#fff4cf" /><circle cx="56" cy="12" r="3" fill="#fff4cf" />
        </symbol>
        <symbol id="lotus" viewBox="0 0 40 40">
          <g fill="none" stroke="#d4af37" strokeWidth="1.4">
            <path d="M20 6 Q28 18 20 32 Q12 18 20 6Z" /><path d="M20 32 Q6 28 4 16 Q14 18 20 32Z" /><path d="M20 32 Q34 28 36 16 Q26 18 20 32Z" />
          </g>
        </symbol>
      </defs>
    </svg>
  );
}
