/** Marca do Parfumania: frasco com líquido (mesmo desenho do ícone do app). */
export function BottleMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="13" y="3" width="6" height="5" rx="1" fill="currentColor" />
      <rect x="11.5" y="8" width="9" height="2.4" rx="0.8" fill="currentColor" opacity="0.6" />
      <path
        d="M8 20.2q2.25-1.2 4.5 0t4.5 0t4.5 0t3.7 0V24.8q0 2.9-2.9 2.9H10.9q-2.9 0-2.9-2.9Z"
        fill="currentColor"
        opacity="0.38"
      />
      <rect x="7" y="10.5" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
