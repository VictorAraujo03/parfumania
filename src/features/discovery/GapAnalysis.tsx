import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Library, Info } from 'lucide-react';
import { ButtonLink } from '../../components/Button';
import { Badge, Card, EmptyState, Notice } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useCatalog } from '../../hooks/useCatalog';
import type { CatalogEntry } from '../../types';
import { formatCurrency } from '../../utils/format';
import { analyzeGaps } from './gaps';

const SEVERITY = { high: 'Lacuna importante', medium: 'Lacuna', low: 'Oportunidade' } as const;

export function GapAnalysis({ onOpenEntry }: { onOpenEntry(e: CatalogEntry): void }) {
  const { perfumes, settings, usageLogs, offers } = useAppData();
  const { entries: catalog, meta } = useCatalog();
  const gaps = useMemo(
    () => analyzeGaps({ perfumes, catalog, settings, logs: usageLogs, offers }),
    [perfumes, catalog, settings, usageLogs, offers],
  );
  const owned = perfumes.filter((p) => p.status === 'owned' || p.status === 'decant');

  if (owned.length === 0) {
    return (
      <EmptyState icon={Library} title="Sem coleção para analisar" action={<ButtonLink to="/colecao/novo" variant="primary">Adicionar perfume</ButtonLink>}>
        A análise de lacunas compara os perfumes que você possui com suas preferências.
      </EmptyState>
    );
  }

  return (
    <div className="stack">
      <Notice icon={Info}>
        Análise baseada em regras sobre os dados que <strong>você</strong> informou (climas, ocasiões, projeção,
        famílias) e em <Link to="/configuracoes">suas preferências</Link>
        {settings.budget ? ` (orçamento: ${formatCurrency(settings.budget)})` : ''}. As sugestões vêm do catálogo
        {meta ? ` (base ${meta.label})` : ' de demonstração'} e nunca incluem perfumes já cadastrados.
      </Notice>
      {gaps.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Nenhuma lacuna evidente" compact>
          Pelas regras atuais, sua coleção cobre bem suas preferências. Defina ocasiões frequentes e famílias favoritas
          em Configurações para uma análise mais precisa.
        </EmptyState>
      ) : (
        gaps.map((g) => (
          <Card key={g.id} className={`gap gap--${g.severity}`}>
            <div className="gap__head">
              <Badge tone={g.severity === 'high' ? 'warning' : g.severity === 'medium' ? 'gold' : 'neutral'}>{SEVERITY[g.severity]}</Badge>
              <h3 className="gap__title">{g.title}</h3>
              <p className="muted">{g.description}</p>
            </div>
            {g.suggestions.length > 0 ? (
              <ul className="suggestions">
                {g.suggestions.map((s) => (
                  <li key={s.entry.id} className="suggestion">
                    <button type="button" className="suggestion__name" onClick={() => onOpenEntry(s.entry)}>
                      {s.entry.name} <span className="muted">· {s.entry.brand}</span>
                    </button>
                    {s.overBudget && <Badge tone="warning">Acima do orçamento</Badge>}
                    <ul className="suggestion__reasons">
                      {s.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{g.noSuggestionReason ?? 'Nenhuma sugestão disponível no catálogo local para esta lacuna.'}</p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
