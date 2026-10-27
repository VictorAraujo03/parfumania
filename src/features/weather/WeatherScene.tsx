import type { CSSProperties } from 'react';
import type { WeatherScene as Scene } from './scene';

/**
 * Fundo animado do cartão de clima (céu, sol/lua, nuvens, chuva, neve,
 * neblina, calor). Só CSS: leve, pausado quando o usuário prefere menos movimento.
 */

/** Pseudoaleatório estável (mesma cena = mesmas posições a cada render). */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const vars = (v: Record<string, string | number>) => v as CSSProperties;

function Cloud({ i, total }: { i: number; total: number }) {
  const top = 6 + rand(i, 1) * 46;
  const scale = 0.7 + rand(i, 2) * 0.7;
  const dur = 38 + rand(i, 3) * 30;
  // A trilha ocupa a largura do cartão e anda com transform (fluido e sem
  // falhas de pintura no Safari do iPhone); a nuvem vai dentro dela.
  return (
    <div
      className="wx-cloud-track"
      style={{
        animationDuration: `${dur}s`,
        // Atraso negativo: as nuvens já começam espalhadas pelo céu.
        animationDelay: `${-((i + rand(i, 4)) / total) * dur}s`,
      }}
    >
      <svg
        className="wx-cloud"
        viewBox="0 0 120 60"
        style={vars({ top: `${top}%`, '--s': scale, '--o': 0.55 + rand(i, 5) * 0.4 })}
      >
        <path d="M26 52 a18 18 0 0 1 2-36 a24 24 0 0 1 44-6 a20 20 0 0 1 30 18 a14 14 0 0 1 -4 24 Z" />
      </svg>
    </div>
  );
}

function Particles({ className, count, salt, fall }: { className: string; count: number; salt: number; fall: [number, number] }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={className}
          style={vars({
            left: `${rand(i, salt) * 104 - 2}%`,
            '--len': rand(i, salt + 1),
            animationDuration: `${fall[0] + rand(i, salt + 2) * (fall[1] - fall[0])}s`,
            animationDelay: `${-rand(i, salt + 3) * 3}s`,
          })}
        />
      ))}
    </>
  );
}

export function WeatherScene({ scene }: { scene: Scene }) {
  const { kind, night } = scene;
  const sunny = kind === 'clear' || kind === 'partly';
  const clouds = { clear: 0, partly: 2, cloudy: 5, fog: 0, drizzle: 4, rain: 4, storm: 5, snow: 3 }[kind];
  const heat = !night && sunny && (scene.feel === 'hot' || scene.feel === 'warm');

  const classes = [
    'wx',
    `wx--${kind}`,
    night ? 'wx--night' : 'wx--day',
    scene.feel ? `wx--${scene.feel}` : '',
    scene.dry ? 'wx--dry' : '',
  ].join(' ');

  return (
    <div className={classes} aria-hidden>
      <div className="wx-sky" />
      {sunny && !night && (
        <div className="wx-sun">
          <span className="wx-sun__rays" />
          <span className="wx-sun__core" />
        </div>
      )}
      {night && (kind === 'clear' || kind === 'partly') && (
        <>
          {Array.from({ length: 26 }, (_, i) => (
            <span
              key={i}
              className="wx-star"
              style={vars({
                left: `${rand(i, 7) * 100}%`,
                top: `${rand(i, 8) * 70}%`,
                '--size': `${1 + rand(i, 9) * 1.6}px`,
                animationDelay: `${-rand(i, 10) * 4}s`,
              })}
            />
          ))}
          <span className="wx-moon" />
        </>
      )}
      {heat && <div className="wx-heat" />}
      {scene.dry && sunny && !night && <Particles className="wx-dust" count={14} salt={40} fall={[9, 16]} />}
      {Array.from({ length: clouds }, (_, i) => (
        <Cloud key={i} i={i} total={clouds} />
      ))}
      {kind === 'fog' && (
        <>
          <span className="wx-fog wx-fog--1" />
          <span className="wx-fog wx-fog--2" />
          <span className="wx-fog wx-fog--3" />
        </>
      )}
      {kind === 'drizzle' && <Particles className="wx-drop wx-drop--fine" count={26} salt={20} fall={[1.1, 1.7]} />}
      {(kind === 'rain' || kind === 'storm') && <Particles className="wx-drop" count={46} salt={30} fall={[0.55, 0.9]} />}
      {kind === 'storm' && <span className="wx-flash" />}
      {kind === 'snow' && <Particles className="wx-flake" count={32} salt={50} fall={[5, 9]} />}
      <div className="wx-shade" />
    </div>
  );
}
