/**
 * Monograma CG — desenho próprio: um C e um G concêntricos que se fecham como
 * a silhueta de uma coroa dentária, com o fio dourado da marca.
 */
export function Monogram({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="24" cy="24" r="23" fill="none" stroke="#b29a70" strokeWidth="0.8" />
      <path
        d="M30.5 15.2A11 11 0 1 0 30.5 32.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M33.6 19.4A7.4 7.4 0 1 0 33.6 28.6V24.6H28.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
