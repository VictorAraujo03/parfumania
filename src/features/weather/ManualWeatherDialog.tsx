import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useAppData } from '../../hooks/useAppData';
import { useWeather } from '../../hooks/useWeather';
import { fahrenheitToCelsius } from '../../utils/format';

export function ManualWeatherDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { settings } = useAppData();
  const { manual, setManual } = useWeather();
  const unit = settings.temperatureUnit;
  const [temp, setTemp] = useState('');
  const [humidity, setHumidity] = useState('');
  const [rain, setRain] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const t = manual?.temperatureC;
    setTemp(t === undefined ? '' : String(Math.round(unit === 'F' ? t * 1.8 + 32 : t)));
    setHumidity(manual?.humidity === undefined ? '' : String(manual.humidity));
    setRain(manual?.precipitationProbability === undefined ? '' : String(manual.precipitationProbability));
    setDescription(manual?.description ?? '');
    setErrors({});
  }, [open, manual, unit]);

  const parse = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

  function save() {
    const t = parse(temp);
    const h = parse(humidity);
    const r = parse(rain);
    const e: Record<string, string> = {};
    const [min, max] = unit === 'F' ? [-40, 130] : [-40, 55];
    if (t !== undefined && (Number.isNaN(t) || t < min || t > max)) e.temp = `Informe entre ${min} e ${max}°${unit}.`;
    if (h !== undefined && (Number.isNaN(h) || h < 0 || h > 100)) e.humidity = 'Informe entre 0 e 100%.';
    if (r !== undefined && (Number.isNaN(r) || r < 0 || r > 100)) e.rain = 'Informe entre 0 e 100%.';
    if (t === undefined && h === undefined && r === undefined) e.temp = 'Informe ao menos a temperatura, a umidade ou a chance de chuva.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setManual({
      temperatureC: t === undefined ? undefined : unit === 'F' ? fahrenheitToCelsius(t) : t,
      humidity: h,
      precipitationProbability: r,
      description: description.trim() || undefined,
      source: 'manual',
      observedAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Informar condições climáticas"
      subtitle="Valem apenas para esta sessão e têm prioridade sobre os dados automáticos."
      size="sm"
      footer={
        <>
          {manual && (
            <Button
              variant="ghost"
              onClick={() => {
                setManual(undefined);
                onClose();
              }}
            >
              Limpar
            </Button>
          )}
          <Button variant="primary" onClick={save}>
            Usar estas condições
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <TextField label={`Temperatura (°${unit})`} inputMode="decimal" value={temp} error={errors.temp} onChange={(e) => setTemp(e.target.value)} />
        <TextField label="Umidade (%)" optional inputMode="numeric" value={humidity} error={errors.humidity} onChange={(e) => setHumidity(e.target.value)} />
        <TextField label="Chance de chuva (%)" optional inputMode="numeric" value={rain} error={errors.rain} onChange={(e) => setRain(e.target.value)} />
        <TextField label="Descrição" optional placeholder="Ex.: nublado" maxLength={60} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  );
}
