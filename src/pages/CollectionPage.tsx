import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heart, LayoutGrid, List, Plus, Search, SlidersHorizontal, X, Library } from 'lucide-react';
import { Button, ButtonLink } from '../components/Button';
import { InlineSelect } from '../components/fields';
import { EmptyState, PageHeader } from '../components/ui';
import { CONCENTRATIONS, FAMILIES, OCCASIONS, PERIODS, STATUSES } from '../data/options';
import { DemoBanner } from '../features/collection/DemoBanner';
import { PerfumeCard, PerfumeRow } from '../features/collection/PerfumeCard';
import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  applyFilters,
  countActiveFilters,
  sortPerfumes,
  uniqueBrands,
  type CollectionFilters,
  type CollectionSort,
} from '../features/collection/filters';
import { useAppData } from '../hooks/useAppData';
import { useLocalPref } from '../hooks/useLocalPref';
import { pluralize } from '../utils/format';

export function CollectionPage() {
  const { perfumes } = useAppData();
  // ?favoritos=1 (atalho do painel) abre a coleção já filtrada.
  const [params] = useSearchParams();
  const favoritesParam = params.get('favoritos') === '1';
  const [filters, setFilters] = useState<CollectionFilters>(() => ({ ...EMPTY_FILTERS, favoritesOnly: favoritesParam }));
  const [sort, setSort] = useLocalPref<CollectionSort>('collectionSort', 'name-asc');
  const [view, setView] = useLocalPref<'grid' | 'list'>('collectionView', 'grid');
  const [showFilters, setShowFilters] = useState(false);

  const brands = useMemo(() => uniqueBrands(perfumes).map((b) => ({ value: b, label: b })), [perfumes]);
  const result = useMemo(() => sortPerfumes(applyFilters(perfumes, filters), sort), [perfumes, filters, sort]);
  const activeCount = countActiveFilters(filters);
  useEffect(() => {
    setFilters((f) => (f.favoritesOnly === favoritesParam ? f : { ...f, favoritesOnly: favoritesParam }));
  }, [favoritesParam]);
  const set = <K extends keyof CollectionFilters>(k: K, v: CollectionFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Coleção"
        title="Minha coleção"
        description={pluralize(perfumes.length, 'perfume cadastrado', 'perfumes cadastrados')}
        actions={
          <ButtonLink to="/colecao/novo" variant="primary" icon={Plus}>
            Adicionar perfume
          </ButtonLink>
        }
      />

      <DemoBanner />

      {perfumes.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Comece sua coleção"
          action={
            <ButtonLink to="/colecao/novo" variant="primary" icon={Plus}>
              Cadastrar o primeiro perfume
            </ButtonLink>
          }
        >
          Cadastre manualmente ou importe dados de uma fragrância do catálogo em Explorar.
        </EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search size={17} aria-hidden />
              <input
                type="search"
                placeholder="Pesquisar por nome ou marca"
                value={filters.text}
                onChange={(e) => set('text', e.target.value)}
                aria-label="Pesquisar perfumes"
              />
            </label>
            <div className="toolbar__group">
              <Button
                variant={showFilters || activeCount ? 'secondary' : 'ghost'}
                icon={SlidersHorizontal}
                onClick={() => setShowFilters((s) => !s)}
                aria-expanded={showFilters}
              >
                Filtros{activeCount ? ` (${activeCount})` : ''}
              </Button>
              <select
                className="input select select--inline"
                value={sort}
                onChange={(e) => setSort(e.target.value as CollectionSort)}
                aria-label="Ordenar"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="segmented" role="group" aria-label="Visualização">
                <button type="button" className={view === 'grid' ? 'is-active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Grade">
                  <LayoutGrid size={16} />
                </button>
                <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="Lista">
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="filter-panel">
              <InlineSelect ariaLabel="Marca" placeholder="Todas as marcas" options={brands} value={filters.brand} onChange={(v) => set('brand', v)} />
              <InlineSelect ariaLabel="Família olfativa" placeholder="Todas as famílias" options={FAMILIES} value={filters.family} onChange={(v) => set('family', v)} />
              <InlineSelect ariaLabel="Concentração" placeholder="Todas as concentrações" options={CONCENTRATIONS} value={filters.concentration} onChange={(v) => set('concentration', v)} />
              <InlineSelect ariaLabel="Ocasião" placeholder="Todas as ocasiões" options={OCCASIONS} value={filters.occasion} onChange={(v) => set('occasion', v)} />
              <InlineSelect ariaLabel="Período" placeholder="Todos os períodos" options={PERIODS} value={filters.period} onChange={(v) => set('period', v)} />
              <InlineSelect ariaLabel="Status" placeholder="Todos os status" options={STATUSES} value={filters.status} onChange={(v) => set('status', v)} />
              <button
                type="button"
                className={`chip ${filters.favoritesOnly ? 'chip--active' : ''}`}
                aria-pressed={filters.favoritesOnly}
                onClick={() => set('favoritesOnly', !filters.favoritesOnly)}
              >
                <Heart size={13} aria-hidden /> Favoritos
              </button>
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" icon={X} onClick={() => setFilters((f) => ({ ...EMPTY_FILTERS, text: f.text }))}>
                  Limpar filtros
                </Button>
              )}
            </div>
          )}

          <p className="result-count">{pluralize(result.length, 'resultado', 'resultados')}</p>

          {result.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum perfume encontrado"
              action={
                <Button onClick={() => setFilters(EMPTY_FILTERS)} variant="secondary">
                  Limpar busca e filtros
                </Button>
              }
            >
              Ajuste a pesquisa ou os filtros.
            </EmptyState>
          ) : view === 'grid' ? (
            <div className="perfume-grid">
              {result.map((p) => (
                <PerfumeCard key={p.id} perfume={p} />
              ))}
            </div>
          ) : (
            <div className="perfume-list">
              {result.map((p) => (
                <PerfumeRow key={p.id} perfume={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
