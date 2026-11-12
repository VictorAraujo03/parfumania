import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, Library, Plus, Sparkles } from 'lucide-react';
import { Button, ButtonLink } from '../../components/Button';
import { Badge, Card, EmptyState, Notice } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useCatalog } from '../../hooks/useCatalog';
import { useToast } from '../../hooks/useToast';
import { useWeather } from '../../hooks/useWeather';
import { scento, type ScentoPick } from '../../services/scento/scento';
import type { CatalogEntry } from '../../types';
import { formatTemperature } from '../../utils/format';
import { formFromCatalog, formToInput } from '../collection/perfumeFormModel';
import { PriceButton } from '../prices/PriceButton';
import { ScentoCredit, ScentoPicks, useOwnedLookup } from '../scento/ScentoPicks';
import { analyzeCoverage, type SlotResult } from './coverage';

/** "O que falta na sua coleção" — análise dos momentos cobertos + sugestões com nome. */
export function CollectionGaps({ onOpenEntry }: { onOpenEntry(e: CatalogEntry): void }) {
  const { perfumes, usageLogs, settings } = useAppData();
  const { entries: catalog, meta } = useCatalog();
  const weather = useWeather();
  const snap = weather.snapshot;

  const report = useMemo(
    () =>
      analyzeCoverage({
        perfumes,
        logs: usageLogs,
        catalog,
        settings,
        thresholds: settings.climateThresholds,
        weather: snap
          ? { temperatureC: snap.apparentTemperatureC ?? snap.temperatureC, locationName: snap.source === 'api' ? snap.locationName : undefined }
          : undefined,
        fmtTemp: (c) => formatTemperature(c, settings.temperatureUnit),
      }),
    [perfumes, usageLogs, catalog, settings, snap],
  );

  if (report.analyzed === 0) {
    return (
      <EmptyState icon={Library} title="Sem coleção para analisar" action={<ButtonLink to="/colecao/novo" variant="primary">Adicionar perfume</ButtonLink>}>
        Cadastre seus perfumes para descobrir o que falta na coleção.
      </EmptyState>
    );
  }

  return (
    <div className="stack">
      <Card className="coverage-summary">
        <p className="eyebrow">O que falta na sua coleção</p>
        <p className="coverage-summary__text">{report.headline}</p>
        {report.strengths.length > 0 && (
          <div className="coverage-summary__strengths">
            {report.strengths.map((s) => (
              <span key={s.id} className="chip-static">
                <CheckCircle2 size={12} aria-hidden /> {s.label}: {s.have.length}
              </span>
            ))}
          </div>
        )}
      </Card>

      {report.gaps.length === 0 ? (
        <EmptyState icon={Sparkles} title="Coleção bem equilibrada" compact>
          Você tem pelo menos duas opções para cada momento que analisamos. Veja as Sugestões Scento para descobrir novidades.
        </EmptyState>
      ) : (
        report.gaps.map((g, i) => <GapCard key={g.id} gap={g} first={i === 0} onOpenEntry={onOpenEntry} />)
      )}

      <Notice icon={Info}>
        Como analisamos: um perfume cobre um momento quando você o marcou para isso (clima ou ocasião) ou, sem marcação,
        quando os acordes e notas cadastrados indicam (ex.: cítricos e aquáticos para o calor — associação comum de
        perfumaria, não regra). A importância vem do clima de agora e dos seus registros de uso. As sugestões vêm da base{' '}
        {meta ? meta.label : 'de demonstração'} (ordenadas pela semelhança com o que você mais usa e avalia bem) e da Scento.
        {report.withoutData.length > 0 && (
          <>
            {' '}
            {report.withoutData.length} perfume(s) sem marcações nem notas ficaram de fora —{' '}
            <Link to="/colecao">complete os dados</Link> para uma análise mais precisa.
          </>
        )}
      </Notice>
    </div>
  );
}

function GapCard({ gap, first, onOpenEntry }: { gap: SlotResult; first: boolean; onOpenEntry(e: CatalogEntry): void }) {
  const { addPerfume } = useAppData();
  const { notify } = useToast();
  const findOwned = useOwnedLookup();

  return (
    <Card className={`gap gap--${gap.have.length === 0 ? 'high' : 'medium'}`}>
      <div className="gap__head">
        <Badge tone={gap.have.length === 0 ? 'warning' : 'gold'}>{first ? 'Prioridade' : gap.have.length === 0 ? 'Falta' : 'Pouco coberto'}</Badge>
        <h3 className="gap__title">{gap.title}</h3>
        <p className="muted">{gap.why}</p>
        <p className="small">
          <strong>O que procurar:</strong> {gap.wanted}.
        </p>
      </div>

      {gap.picks.length > 0 && (
        <div className="gap__section">
          <p className="scento__subtitle">Da nossa base de perfumes</p>
          <ul className="gap-picks">
            {gap.picks.map((p) => {
              const owned = findOwned(p.entry.name, p.entry.brand);
              return (
                <li key={p.entry.id} className="gap-pick">
                  <button type="button" className="gap-pick__name" onClick={() => onOpenEntry(p.entry)}>
                    {p.entry.name}
                    <span>{p.entry.brand}</span>
                  </button>
                  <ul className="gap-pick__reasons">
                    {p.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <div className="gap-pick__actions">
                    <PriceButton target={{ name: p.entry.name, brand: p.entry.brand }} />
                    {owned ? (
                      <Badge>{owned.status === 'wishlist' ? 'Desejado' : 'Na coleção'}</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Plus}
                        onClick={async () => {
                          await addPerfume(formToInput(formFromCatalog(p.entry, 'wishlist')));
                          notify(`${p.entry.name} foi para a sua lista de desejos.`);
                        }}
                      >
                        Desejados
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ScentoGapPicks gap={gap} />
    </Card>
  );
}

/** Seleção da Scento para o momento, sem o que você já tem. */
function ScentoGapPicks({ gap }: { gap: SlotResult }) {
  const findOwned = useOwnedLookup();
  const [state, setState] = useState<{ picks: ScentoPick[]; page?: { label: string; url: string } } | 'loading' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    scento
      .edit(gap.scento)
      .then((f) => alive && setState({ picks: f.detail.edit, page: f.scento_page }))
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [gap.scento]);

  if (state === 'error') return null;
  if (state === 'loading') {
    return (
      <p className="muted small" aria-busy="true">
        Buscando sugestões da Scento…
      </p>
    );
  }
  const fresh = state.picks.filter((p) => !findOwned(p.name, p.house, p.page)).slice(0, 3);
  if (fresh.length === 0) return null;
  return (
    <div className="gap__section">
      <p className="scento__subtitle">Seleção da Scento</p>
      <ScentoPicks items={fresh} context={gap.title.toLowerCase()} />
      <ScentoCredit page={state.page} />
    </div>
  );
}
