/**
 * Tela de carregamento: frasco borrifando. O mesmo desenho está no index.html
 * (exibido enquanto o JavaScript é baixado); os estilos ficam lá, em
 * <style id="splash-css">, para valerem antes de o app carregar.
 */
const PARTICLES: [number, number, number, number][] = [
  // dx, dy, raio, atraso (s) — gotículas em cone a partir do bico
  [86, -39, 1.3, 0.05],
  [85, -34, 1.2, 0.18],
  [81, -28, 1.5, 0.16],
  [64, -19, 1.8, 0.05],
  [69, -17, 1.9, 0.1],
  [63, -16, 2.5, 0.19],
  [86, -19, 2.5, 0.04],
  [93, -14, 2.1, 0.06],
  [118, -16, 1.8, 0.05],
  [81, -4, 1.3, 0.15],
  [82, -3, 1.2, 0.19],
  [113, -1, 1.8, 0.05],
  [85, 6, 2.2, 0.13],
  [75, 5, 1.8, 0.02],
  [86, 8, 2.1, 0.13],
  [79, 18, 1.8, 0.1],
  [108, 23, 1.8, 0.09],
  [74, 18, 2.2, 0.03],
  [102, 29, 2.4, 0.19],
  [104, 42, 2.2, 0.13],
  [59, 24, 1.6, 0.07],
  [78, 32, 2.1, 0.15],
];

export function SplashScreen({ label = 'Preparando sua coleção…' }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-label={label}>
      <svg className="splash__art" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <clipPath id="splash-inside">
            <rect x="53" y="91" width="66" height="76" rx="13" />
          </clipPath>
        </defs>
        <ellipse className="sp-cloud" cx="150" cy="57" rx="30" ry="16" />
        {PARTICLES.map(([dx, dy, r, d], i) => (
          <circle
            key={i}
            className="sp-mist"
            cx="112"
            cy="57"
            r={r}
            style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, animationDelay: `${d}s` }}
          />
        ))}
        <g className="sp-pump">
          <rect x="82" y="64" width="8" height="16" rx="1.5" fill="#8c7448" />
          <rect x="72" y="48" width="28" height="18" rx="4" fill="#c9a96e" />
          <rect x="99" y="54" width="11" height="6" rx="2" fill="#c9a96e" />
        </g>
        <rect x="68" y="78" width="36" height="11" rx="3" fill="#8c7448" />
        <g clipPath="url(#splash-inside)">
          <path className="sp-liquid" d="M20 136 q14 -7 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 V175 H20 Z" />
        </g>
        <rect x="50" y="88" width="72" height="82" rx="16" fill="rgba(201,169,110,0.05)" stroke="#c9a96e" strokeWidth="3" />
        <path d="M62 102 v18" stroke="#f3e2bd" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="splash__name">Parfumania</p>
      <p className="splash__label">{label}</p>
    </div>
  );
}
