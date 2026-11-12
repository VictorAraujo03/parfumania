import { useMemo } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { ButtonLink } from '../../components/Button';
import { useAppData } from '../../hooks/useAppData';
import { useWeather } from '../../hooks/useWeather';
import { formatTemperature } from '../../utils/format';
import { analyzeCoverage } from './coverage';

/** Atalho do painel para "O que falta na sua coleção". */
export function GapTeaser() {
  const { perfumes, usageLogs, settings } = useAppData();
  const snap = useWeather().snapshot;
  const report = useMemo(
    () =>
      analyzeCoverage({
        perfumes,
        logs: usageLogs,
        catalog: [],
        settings,
        thresholds: settings.climateThresholds,
        weather: snap
          ? { temperatureC: snap.apparentTemperatureC ?? snap.temperatureC, locationName: snap.source === 'api' ? snap.locationName : undefined }
          : undefined,
        fmtTemp: (c) => formatTemperature(c, settings.temperatureUnit),
        suggest: false,
      }),
    [perfumes, usageLogs, settings, snap],
  );
  const gap = report.gaps[0];
  if (!gap) return null;

  return (
    <section className="gap-teaser">
      <Compass size={22} strokeWidth={1.5} aria-hidden />
      <div className="gap-teaser__body">
        <p className="eyebrow">O que falta na sua coleção</p>
        <p className="gap-teaser__title">{gap.title}</p>
        <p className="gap-teaser__why">{gap.why}</p>
      </div>
      <ButtonLink to="/explorar?aba=falta" variant="secondary" size="sm">
        Ver sugestões <ArrowRight size={14} aria-hidden />
      </ButtonLink>
    </section>
  );
}
