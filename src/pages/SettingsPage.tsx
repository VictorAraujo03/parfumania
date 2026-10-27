import { useEffect, useState, type ReactNode } from 'react';
import { ChipMultiSelect, ChipSingleSelect } from '../components/ChipGroup';
import { Card, CardHeader, PageHeader } from '../components/ui';
import { FAMILIES, INTENSITY_PREFERENCES, OCCASIONS } from '../data/options';
import { AccountCard } from '../features/account/AccountCard';
import { CatalogManagement } from '../features/settings/CatalogManagement';
import { CitySearch } from '../features/settings/CitySearch';
import { DataManagement } from '../features/settings/DataManagement';
import { WeightsEditor } from '../features/settings/WeightsEditor';
import { useAppData } from '../hooks/useAppData';
import { useToast } from '../hooks/useToast';
import { WEATHER_INTEGRATION_ENABLED } from '../services/weather';
import type { ThemePreference } from '../types';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Escuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <span>{label}</span>
        {hint && <p className="field__hint">{hint}</p>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}

/** Campo de texto salvo ao sair do campo (evita gravar a cada tecla). */
function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit(v: string): void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="input"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      {...rest}
    />
  );
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppData();
  const { notify } = useToast();
  const save = async (patch: Parameters<typeof updateSettings>[0], message = 'Configuração salva.') => {
    await updateSettings(patch);
    notify(message);
  };

  return (
    <div className="page page--narrow">
      <PageHeader eyebrow="Configurações" title="Preferências" description="Tudo é salvo automaticamente." />

      <Card>
        <CardHeader title="Conta" />
        <AccountCard />
      </Card>

      <Card>
        <CardHeader title="Perfil e aparência" />
        <Row label="Nome de exibição" hint="Usado na saudação do início.">
          <CommitInput value={settings.displayName} maxLength={40} placeholder="Seu nome" aria-label="Nome de exibição" onCommit={(v) => void save({ displayName: v.trim() })} />
        </Row>
        <Row label="Tema visual">
          <ChipSingleSelect options={THEMES} value={settings.theme} allowClear={false} ariaLabel="Tema" onChange={(v) => v && void save({ theme: v })} />
        </Row>
        <Row label="Unidade de temperatura">
          <ChipSingleSelect
            options={[
              { value: 'C', label: 'Celsius (°C)' },
              { value: 'F', label: 'Fahrenheit (°F)' },
            ]}
            value={settings.temperatureUnit}
            allowClear={false}
            ariaLabel="Unidade de temperatura"
            onChange={(v) => v && void save({ temperatureUnit: v as 'C' | 'F' })}
          />
        </Row>
      </Card>

      <Card>
        <CardHeader title="Clima e localização" />
        <Row
          label="Consultar o clima automaticamente"
          hint={WEATHER_INTEGRATION_ENABLED ? 'Usa o Open-Meteo (gratuito, sem chave).' : 'Desativado pela variável VITE_WEATHER_ENABLED.'}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.weatherEnabled && WEATHER_INTEGRATION_ENABLED}
              disabled={!WEATHER_INTEGRATION_ENABLED}
              onChange={(e) => void save({ weatherEnabled: e.target.checked })}
            />
            <span className="switch__track" aria-hidden />
            <span className="visually-hidden">Consultar o clima automaticamente</span>
          </label>
        </Row>
        <Row
          label="Detectar minha localização ao abrir"
          hint="Usa a localização aproximada (~1 km) do aparelho só para consultar o clima e recomendar. As coordenadas não são salvas. O navegador pede permissão uma vez em cada aparelho."
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.autoLocation && settings.weatherEnabled && WEATHER_INTEGRATION_ENABLED}
              disabled={!settings.weatherEnabled || !WEATHER_INTEGRATION_ENABLED}
              onChange={(e) => void save({ autoLocation: e.target.checked })}
            />
            <span className="switch__track" aria-hidden />
            <span className="visually-hidden">Detectar minha localização ao abrir</span>
          </label>
        </Row>
        <Row label="Cidade preferida" hint="Usada quando a localização do aparelho não está disponível.">
          <CitySearch disabled={!settings.weatherEnabled || !WEATHER_INTEGRATION_ENABLED} />
        </Row>
      </Card>

      <Card>
        <CardHeader title="Preferências olfativas" subtitle="Influenciam o critério “Preferência pessoal” e as sugestões de compra." />
        <Row label="Famílias favoritas">
          <ChipMultiSelect
            options={FAMILIES}
            value={settings.favoriteFamilies}
            disabledValues={settings.dislikedFamilies}
            ariaLabel="Famílias favoritas"
            onChange={(v) => void updateSettings({ favoriteFamilies: v })}
          />
        </Row>
        <Row label="Famílias menos apreciadas">
          <ChipMultiSelect
            options={FAMILIES}
            value={settings.dislikedFamilies}
            disabledValues={settings.favoriteFamilies}
            ariaLabel="Famílias menos apreciadas"
            onChange={(v) => void updateSettings({ dislikedFamilies: v })}
          />
        </Row>
        <Row label="Intensidade preferida" hint="Usada quando você não responde a pergunta de intensidade.">
          <ChipSingleSelect options={INTENSITY_PREFERENCES} value={settings.preferredIntensity} ariaLabel="Intensidade preferida" onChange={(v) => void updateSettings({ preferredIntensity: v })} />
        </Row>
        <Row label="Ocasiões mais frequentes" hint="Usadas na análise de lacunas da coleção.">
          <ChipMultiSelect options={OCCASIONS} value={settings.frequentOccasions} ariaLabel="Ocasiões frequentes" onChange={(v) => void updateSettings({ frequentOccasions: v })} />
        </Row>
        <Row label="Orçamento para futuras compras (R$)" hint="Comparado às ofertas que você registrar.">
          <CommitInput
            value={settings.budget?.toString() ?? ''}
            inputMode="decimal"
            placeholder="Sem orçamento definido"
            aria-label="Orçamento"
            onCommit={(v) => {
              const n = Number(v.replace(',', '.'));
              if (v.trim() === '') void save({ budget: undefined });
              else if (Number.isFinite(n) && n > 0) void save({ budget: n });
              else notify('Informe um valor válido.', 'error');
            }}
          />
        </Row>
      </Card>

      <Card>
        <CardHeader title="Motor de recomendação" subtitle="Pesos de cada critério (0–100) e faixas de temperatura. Detalhes em docs/RECOMENDACOES.md." />
        <Row
          label="Rodízio de perfumes"
          hint="Tira alguns pontos de quem você usou hoje ou ontem e lembra dos que estão esquecidos há semanas. Desligue se prefere um perfume assinatura."
        >
          <label className="switch">
            <input type="checkbox" checked={settings.varietyEnabled} onChange={(e) => void save({ varietyEnabled: e.target.checked })} />
            <span className="switch__track" aria-hidden />
            <span className="visually-hidden">Rodízio de perfumes</span>
          </label>
        </Row>
        <WeightsEditor />
      </Card>

      <Card>
        <CardHeader title="Base de perfumes" subtitle="Catálogo usado para autocompletar o cadastro e em Explorar." />
        <CatalogManagement />
      </Card>

      <Card>
        <CardHeader title="Seus dados" subtitle="Exportação, restauração e limpeza." />
        <DataManagement />
      </Card>
    </div>
  );
}
