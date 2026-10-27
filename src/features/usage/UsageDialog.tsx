import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CloudSun } from 'lucide-react';
import { Button } from '../../components/Button';
import { ChipSingleSelect } from '../../components/ChipGroup';
import { Field, TextAreaField } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { RatingInput } from '../../components/ScaleInput';
import { Notice } from '../../components/ui';
import { ENVIRONMENTS, OCCASIONS } from '../../data/options';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { useWeather } from '../../hooks/useWeather';
import type { Environment, Occasion, Scale, UsageLog, WeatherSnapshot } from '../../types';
import { formatDateTime, toDateTimeLocal } from '../../utils/date';
import { describeSnapshot } from '../weather/describe';

interface UsageDialogProps {
  open: boolean;
  onClose(): void;
  /** Perfume pré-selecionado (página do perfume, dashboard, recomendação). */
  perfumeId?: string;
  /** Quando informado, o diálogo edita o registro existente. */
  log?: UsageLog;
  defaults?: { occasion?: Occasion; environment?: Environment };
  onSaved?(log: UsageLog): void;
}

const DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000;

export function UsageDialog({ open, onClose, perfumeId, log, defaults, onSaved }: UsageDialogProps) {
  const { perfumes, usageLogs, addUsage, updateUsage, settings } = useAppData();
  const weather = useWeather();
  const { notify } = useToast();

  const [selected, setSelected] = useState('');
  const [when, setWhen] = useState('');
  const [occasion, setOccasion] = useState<Occasion>();
  const [environment, setEnvironment] = useState<Environment>();
  const [rating, setRating] = useState<Scale>();
  const [notes, setNotes] = useState('');
  const [includeWeather, setIncludeWeather] = useState(true);
  const [duplicateOf, setDuplicateOf] = useState<UsageLog>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setSelected(log?.perfumeId ?? perfumeId ?? '');
    setWhen(toDateTimeLocal(log ? new Date(log.usedAt) : new Date()));
    setOccasion(log?.occasion ?? defaults?.occasion);
    setEnvironment(log?.environment ?? defaults?.environment);
    setRating(log?.rating);
    setNotes(log?.notes ?? '');
    setIncludeWeather(log ? !!log.weather : true);
    setDuplicateOf(undefined);
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log, perfumeId]);

  const available = useMemo(
    () =>
      [...perfumes]
        .filter((p) => p.status === 'owned' || p.status === 'decant' || p.id === selected)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [perfumes, selected],
  );

  // Ao editar, preserva o clima gravado; ao criar, usa as condições atuais (se houver).
  const weatherToSave: WeatherSnapshot | undefined = log ? log.weather : weather.snapshot;

  async function save(force = false) {
    if (!selected) {
      setError('Escolha o perfume utilizado.');
      return;
    }
    const usedAt = new Date(when);
    if (Number.isNaN(usedAt.getTime())) {
      setError('Informe uma data e horário válidos.');
      return;
    }
    if (usedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      setError('A data da utilização não pode estar no futuro.');
      return;
    }
    if (!force) {
      const dup = usageLogs.find(
        (l) =>
          l.perfumeId === selected &&
          l.id !== log?.id &&
          Math.abs(Date.parse(l.usedAt) - usedAt.getTime()) < DUPLICATE_WINDOW_MS,
      );
      if (dup) {
        setDuplicateOf(dup);
        return;
      }
    }
    setSaving(true);
    try {
      const input = {
        perfumeId: selected,
        usedAt: usedAt.toISOString(),
        occasion,
        environment,
        rating,
        notes: notes.trim() || undefined,
        weather: includeWeather ? weatherToSave : undefined,
      };
      const saved = log ? await updateUsage(log.id, input) : await addUsage(input);
      notify(log ? 'Registro atualizado.' : 'Utilização registrada.');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={log ? 'Editar utilização' : 'Registrar utilização'}
      subtitle={log ? undefined : 'Confirme os detalhes antes de salvar.'}
      footer={
        duplicateOf ? (
          <>
            <Button variant="ghost" onClick={() => setDuplicateOf(undefined)}>
              Voltar
            </Button>
            <Button variant="primary" onClick={() => void save(true)} disabled={saving}>
              Registrar mesmo assim
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={saving || available.length === 0}>
              {saving ? 'Salvando…' : log ? 'Salvar alterações' : 'Registrar'}
            </Button>
          </>
        )
      }
    >
      {available.length === 0 ? (
        <Notice tone="warning">Cadastre um perfume na coleção antes de registrar uma utilização.</Notice>
      ) : (
        <div className="stack">
          {duplicateOf && (
            <Notice tone="warning" icon={AlertTriangle}>
              Já existe um registro deste perfume em {formatDateTime(new Date(duplicateOf.usedAt))}. Deseja registrar
              outra utilização?
            </Notice>
          )}
          <div className="form-grid">
            <Field label="Perfume">
              {(id) => (
                <select id={id} className="input select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="">Selecione…</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.brand}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Data e horário">
              {(id) => (
                <input
                  id={id}
                  type="datetime-local"
                  className="input"
                  value={when}
                  max={toDateTimeLocal(new Date())}
                  onChange={(e) => setWhen(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="field">
            <span className="field__label">
              Ocasião <span className="field__optional">opcional</span>
            </span>
            <ChipSingleSelect options={OCCASIONS} value={occasion} onChange={setOccasion} ariaLabel="Ocasião" />
          </div>
          <div className="field">
            <span className="field__label">
              Ambiente <span className="field__optional">opcional</span>
            </span>
            <ChipSingleSelect options={ENVIRONMENTS} value={environment} onChange={setEnvironment} ariaLabel="Ambiente" />
          </div>

          <div className="weather-attach">
            <CloudSun size={18} aria-hidden />
            {weatherToSave ? (
              <label className="checkbox">
                <input type="checkbox" checked={includeWeather} onChange={(e) => setIncludeWeather(e.target.checked)} />
                <span>
                  Salvar condições climáticas: {describeSnapshot(weatherToSave, settings.temperatureUnit)}
                </span>
              </label>
            ) : (
              <span className="muted">
                {log ? 'Este registro não tem condições climáticas.' : 'Sem condições climáticas disponíveis — o registro será salvo sem elas.'}
              </span>
            )}
          </div>

          <div className="field">
            <span className="field__label">
              Como foi? <span className="field__optional">opcional</span>
            </span>
            <RatingInput value={rating} onChange={setRating} label="Avaliação após o uso" />
          </div>
          <TextAreaField label="Observações" optional rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="field__error">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
