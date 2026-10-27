import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../components/Button';
import { DEFAULT_CLIMATE_THRESHOLDS, DEFAULT_WEIGHTS } from '../../data/defaults';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { CRITERIA, sumWeights } from '../../services/recommendations/weights';
import type { RecommendationWeights } from '../../types';

export function WeightsEditor() {
  const { settings, updateSettings } = useAppData();
  const { notify } = useToast();
  const [weights, setWeights] = useState<RecommendationWeights>(settings.weights);
  const [hot, setHot] = useState(String(settings.climateThresholds.hotMinC));
  const [cold, setCold] = useState(String(settings.climateThresholds.coldMaxC));
  const [error, setError] = useState<string>();

  useEffect(() => {
    setWeights(settings.weights);
    setHot(String(settings.climateThresholds.hotMinC));
    setCold(String(settings.climateThresholds.coldMaxC));
  }, [settings.weights, settings.climateThresholds]);

  const total = sumWeights(weights);

  async function save() {
    const h = Number(hot);
    const c = Number(cold);
    if (!Number.isFinite(h) || !Number.isFinite(c) || c >= h) {
      setError('A temperatura de frio deve ser menor que a de calor.');
      return;
    }
    if (total <= 0) {
      setError('Pelo menos um critério precisa ter peso maior que zero.');
      return;
    }
    setError(undefined);
    await updateSettings({ weights, climateThresholds: { hotMinC: h, coldMaxC: c } });
    notify('Preferências de recomendação salvas.');
  }

  return (
    <div className="stack">
      <ul className="weights-editor">
        {CRITERIA.map((c) => (
          <li key={c.key}>
            <div className="weights-editor__head">
              <label htmlFor={`w-${c.key}`}>{c.label}</label>
              <span className="weights-editor__value">
                {weights[c.key]} pts{total > 0 && total !== 100 ? ` (${Math.round((weights[c.key] / total) * 100)}%)` : ''}
              </span>
            </div>
            <input
              id={`w-${c.key}`}
              type="range"
              min={0}
              max={50}
              step={1}
              value={weights[c.key]}
              onChange={(e) => setWeights((w) => ({ ...w, [c.key]: Number(e.target.value) }))}
            />
            <p className="field__hint">{c.description}</p>
          </li>
        ))}
      </ul>
      <p className={`small ${total === 100 ? 'muted' : 'text-warning'}`}>
        Soma: {total} pontos.{' '}
        {total !== 100 && 'Os pesos são reescalados proporcionalmente para totalizar 100.'}
      </p>
      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="th-hot">
            Dia quente a partir de (°C)
          </label>
          <input id="th-hot" className="input" inputMode="decimal" value={hot} onChange={(e) => setHot(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="th-cold">
            Dia frio abaixo de (°C)
          </label>
          <input id="th-cold" className="input" inputMode="decimal" value={cold} onChange={(e) => setCold(e.target.value)} />
        </div>
      </div>
      {error && <p className="field__error">{error}</p>}
      <div className="form-actions form-actions--start">
        <Button variant="primary" onClick={() => void save()}>
          Salvar
        </Button>
        <Button
          variant="ghost"
          icon={RotateCcw}
          onClick={() => {
            setWeights(DEFAULT_WEIGHTS);
            setHot(String(DEFAULT_CLIMATE_THRESHOLDS.hotMinC));
            setCold(String(DEFAULT_CLIMATE_THRESHOLDS.coldMaxC));
          }}
        >
          Restaurar padrão
        </Button>
      </div>
    </div>
  );
}
