import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, Search } from 'lucide-react';
import { InlineSelect } from '../components/fields';
import { PerfumeImage } from '../components/PerfumeImage';
import { Badge, EmptyState, Notice, PageHeader, Tabs } from '../components/ui';
import { CONCENTRATION_SHORT, CONCENTRATIONS, FAMILIES, OCCASIONS, labelOf } from '../data/options';
import { CatalogDetailModal } from '../features/discovery/CatalogDetailModal';
import { GapAnalysis } from '../features/discovery/GapAnalysis';
import { ScentoDiscover } from '../features/scento/ScentoDiscover';
import { useAppData } from '../hooks/useAppData';
import { useLocalPref } from '../hooks/useLocalPref';
import { useCatalog } from '../hooks/useCatalog';
import type { CatalogQuery } from '../services/catalog/catalogService';
import type { CatalogEntry, Concentration, Occasion, OlfactoryFamily } from '../types';
import { pluralize } from '../utils/format';
import { perfumeKey } from '../utils/text';

export function ExplorePage() {
  const { perfumes } = useAppData();
  const [tab, setTab] = useLocalPref<'catalog' | 'scento' | 'gaps'>('exploreTab', 'catalog');
  const [text, setText] = useState('');
  const [family, setFamily] = useState<OlfactoryFamily | ''>('');
  const [concentration, setConcentration] = useState<Concentration | ''>('');
  const [occasion, setOccasion] = useState<Occasion | ''>('');
  const [selected, setSelected] = useState<CatalogEntry>();
  const catalog = useCatalog();
  const deferredText = useDeferredValue(text);

  const query: CatalogQuery = useMemo(
    () => ({
      text: deferredText || undefined,
      family: family || undefined,
      concentration: concentration || undefined,
      occasion: occasion || undefined,
    }),
    [deferredText, family, concentration, occasion],
  );
  const { results, total } = useMemo(() => catalog.search(query, 60), [catalog, query]);

  // Associa entradas do catálogo a perfumes já cadastrados (por id ou marca+nome).
  const registered = useMemo(() => {
    const map = new Map<string, (typeof perfumes)[number]>();
    for (const p of perfumes) {
      if (p.catalogId) map.set(p.catalogId, p);
      map.set(perfumeKey(p.brand, p.name), p);
    }
    return map;
  }, [perfumes]);
  const findRegistered = (e: CatalogEntry) => registered.get(e.id) ?? registered.get(perfumeKey(e.brand, e.name));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Descobrir"
        title="Explorar perfumes"
        description="Pesquise fragrâncias e descubra o que pode complementar sua coleção."
      />

      <Tabs
        ariaLabel="Seções de exploração"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'catalog', label: 'Catálogo' },
          { value: 'scento', label: 'Sugestões Scento' },
          { value: 'gaps', label: 'Expandir a coleção' },
        ]}
      />

      {tab === 'catalog' ? (
        <>
          {catalog.meta ? (
            <Notice icon={BookOpen}>
              Pesquisando em <strong>{catalog.meta.count.toLocaleString('pt-BR')} perfumes</strong> da base{' '}
              <strong>{catalog.meta.label}</strong> e no catálogo de demonstração. Dados comunitários, não verificados.{' '}
              <Link to="/configuracoes">Gerenciar base</Link>
            </Notice>
          ) : (
            <Notice tone="demo" icon={BookOpen} action={<Link to="/configuracoes" className="btn btn--secondary btn--sm">Importar base completa</Link>}>
              <strong>Catálogo local de demonstração</strong> com uma seleção pequena de fragrâncias conhecidas, com
              pirâmides resumidas <strong>não verificadas</strong>. Importe uma base com dezenas de milhares de perfumes em
              Configurações.
            </Notice>
          )}

          <div className="toolbar">
            <label className="search">
              <Search size={17} aria-hidden />
              <input type="search" placeholder="Nome, marca ou nota" value={text} onChange={(e) => setText(e.target.value)} aria-label="Pesquisar no catálogo" />
            </label>
          </div>
          <div className="filter-panel">
            <InlineSelect ariaLabel="Família" placeholder="Todas as famílias" options={FAMILIES} value={family} onChange={setFamily} />
            <InlineSelect ariaLabel="Concentração" placeholder="Todas as concentrações" options={CONCENTRATIONS} value={concentration} onChange={setConcentration} />
            <InlineSelect ariaLabel="Ocasião" placeholder="Todas as ocasiões" options={OCCASIONS} value={occasion} onChange={setOccasion} />
          </div>

          <p className="result-count">
            {total > results.length
              ? `Mostrando ${results.length} de ${total.toLocaleString('pt-BR')} fragrâncias — refine a busca`
              : pluralize(total, 'fragrância', 'fragrâncias')}
          </p>

          {results.length === 0 ? (
            <EmptyState icon={Search} title="Nada encontrado" compact>
              Tente outros termos. Você pode cadastrar manualmente qualquer perfume que não esteja no catálogo.
            </EmptyState>
          ) : (
            <div className="perfume-grid">
              {results.map((e) => {
                const reg = findRegistered(e);
                return (
                  <button key={e.id} type="button" className="perfume-card perfume-card--button" onClick={() => setSelected(e)}>
                    <div className="perfume-card__media">
                      <PerfumeImage name={e.name} brand={e.brand} family={e.family} />
                      <div className="perfume-card__badges">
                        {reg && (
                          <Badge tone="gold">
                            <Check size={11} aria-hidden /> Na coleção
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="perfume-card__body">
                      <p className="perfume-card__brand">{e.brand}</p>
                      <h3 className="perfume-card__name">{e.name}</h3>
                      <div className="perfume-card__meta">
                        <span>
                          {[
                            e.concentration && e.concentration !== 'other' ? CONCENTRATION_SHORT[e.concentration] : e.concentrationLabel,
                            e.year,
                            labelOf(FAMILIES, e.family) || null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Dados incompletos'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : tab === 'scento' ? (
        <ScentoDiscover />
      ) : (
        <GapAnalysis onOpenEntry={setSelected} />
      )}

      <CatalogDetailModal entry={selected} owned={selected ? findRegistered(selected) : undefined} onClose={() => setSelected(undefined)} />
    </div>
  );
}
