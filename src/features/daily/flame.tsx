/** Foguinho animado da sequência (animação desligada com prefers-reduced-motion). */
export function Flame({ streak }: { streak: number }) {
  const lit = streak > 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 40 52" className={`h-16 w-12 ${lit ? "flame" : ""}`} aria-hidden>
        <path d="M20 2C24 12 34 18 34 32a14 14 0 0 1-28 0c0-7 4-11 7-15 1 5 3 7 6 8-2-8 1-16 1-23z" fill={lit ? "#b29a70" : "#d5c6b2"} />
        <path d="M20 22c3 5 7 8 7 14a7 7 0 0 1-14 0c0-4 3-6 4-9 1 2 2 3 3 3-1-3-1-5 0-8z" fill={lit ? "#f7f4ed" : "#e9e3d7"} />
      </svg>
      <p className="font-display text-5xl leading-none">{streak}<span className="block text-base text-mist">{streak === 1 ? "dia seguido" : "dias seguidos"}</span></p>
    </div>
  );
}
