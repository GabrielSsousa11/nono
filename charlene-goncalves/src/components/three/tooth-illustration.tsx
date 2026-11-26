import { useId } from "react";

/**
 * Versão estática do molar conceitual — usada como placeholder de carregamento,
 * em aparelhos modestos, com economia de dados ou sem WebGL.
 */
export function ToothIllustration({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id={`${id}-porcelain`} cx="38%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#fffdf8" />
          <stop offset="55%" stopColor="#f1ebe0" />
          <stop offset="100%" stopColor="#d5c6b2" />
        </radialGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b29a70" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#b29a70" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path
        d="M48 92 C40 60 52 30 76 32 C86 33 92 41 100 41 C108 41 114 33 124 32 C148 30 160 60 152 92 C148 110 146 122 144 134 C140 170 138 210 128 236 C124 246 114 244 112 234 C108 210 106 186 100 172 C94 186 92 210 88 234 C86 244 76 246 72 236 C62 210 60 170 56 134 C54 122 52 110 48 92 Z"
        fill={`url(#${id}-porcelain)`}
        stroke={`url(#${id}-edge)`}
        strokeWidth="1.2"
      />
      <path
        d="M66 58 C76 48 90 50 98 58"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.9"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M58 118 C80 128 120 128 142 118" fill="none" stroke="#b29a70" strokeOpacity="0.35" strokeWidth="0.8" />
    </svg>
  );
}
