import { useMemo, useState } from 'react';
import { ExternalLink, Pencil, PlugZap, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Badge, Card, EmptyState, Notice, PageHeader } from '../components/ui';
import { OfferForm } from '../features/prices/OfferForm';
import { groupOffers, offerTotal, pricePerMl, type OfferSort } from '../features/prices/offers';
import { useAppData } from '../hooks/useAppData';
import { useToast } from '../hooks/useToast';
import { hasActivePriceIntegration } from '../services/prices/priceProviders';
import type { PriceOffer } from '../types';
import { formatDateTime } from '../utils/date';
import { formatCurrency } from '../utils/format';
import { normalize } from '../utils/text';

const SORTS: { value: OfferSort; label: string }[] = [
  { value: 'total', label: 'Menor preço total' },
  { value: 'price', label: 'Menor preço (sem frete)' },
  { value: 'perMl', label: 'Menor preço por ml' },
  { value: 'recent', label: 'Consulta mais recente' },
];

export function PricesPage() {
  const { offers, deleteOffer } = useAppData();
  const { notify } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PriceOffer>();
  const [deleting, setDeleting] = useState<PriceOffer>();
  const [sort, setSort] = useState<OfferSort>('total');
  const [text, setText] = useState('');

  const groups = useMemo(() => {
    const t = normalize(text);
    const filtered = t ? offers.filter((o) => normalize(`${o.perfumeName} ${o.brand} ${o.store}`).includes(t)) : offers;
    return groupOffers(filtered, sort);
  }, [offers, sort, text]);

  // Agrupa grupos da mesma fragrância para avisar quando há variantes diferentes.
  const variantsPerPerfume = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) {
      const k = normalize(`${g.brand}|${g.title}`);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [groups]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Preços"
        title="Comparação de ofertas"
        description="Registre preços que você consultou e compare apenas produtos equivalentes."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            Registrar oferta
          </Button>
        }
      />

      {!hasActivePriceIntegration() && (
        <Notice tone="warning" icon={PlugZap}>
          <strong>Comparação automática ainda não disponível.</strong> Nenhuma integração com lojas, afiliados ou
          fornecedores está ativa e não há coleta automática de preços. Todas as ofertas abaixo foram{' '}
          <strong>digitadas por você</strong>.
        </Notice>
      )}

      {offers.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhuma oferta registrada"
          action={
            <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
              Registrar a primeira oferta
            </Button>
          }
        >
          Ao encontrar um preço, registre loja, volume, concentração e frete. O Parfumania agrupa produtos equivalentes e
          calcula o preço total e por ml.
        </EmptyState>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search size={17} aria-hidden />
              <input type="search" placeholder="Pesquisar perfume, marca ou loja" value={text} onChange={(e) => setText(e.target.value)} aria-label="Pesquisar ofertas" />
            </label>
            <select className="input select select--inline" value={sort} onChange={(e) => setSort(e.target.value as OfferSort)} aria-label="Ordenar ofertas">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            {groups.map((g) => {
              const multiVariant = (variantsPerPerfume.get(normalize(`${g.brand}|${g.title}`)) ?? 0) > 1;
              return (
                <Card key={g.key} className="offer-group">
                  <div className="offer-group__head">
                    <div>
                      <p className="eyebrow">{g.brand}</p>
                      <h3 className="offer-group__title">{g.title}</h3>
                      <p className="muted small">{g.variant}</p>
                    </div>
                    {multiVariant && (
                      <Badge tone="warning" title="Há outras ofertas desta fragrância com concentração, volume ou condição diferentes">
                        Outras variantes listadas separadamente
                      </Badge>
                    )}
                  </div>
                  <div className="table-wrap">
                    <table className="data-table offer-table">
                      <thead>
                        <tr>
                          <th scope="col">Loja</th>
                          <th scope="col" className="num">Preço</th>
                          <th scope="col" className="num">Frete</th>
                          <th scope="col" className="num">Total</th>
                          <th scope="col" className="num hide-mobile">Por ml</th>
                          <th scope="col" className="hide-mobile">Consulta</th>
                          <th scope="col"><span className="visually-hidden">Ações</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.offers.map((o) => {
                          const total = offerTotal(o);
                          const perMl = pricePerMl(o);
                          const best = g.best?.id === o.id && g.offers.length > 1;
                          return (
                            <tr key={o.id} className={best ? 'is-best' : ''}>
                              <td>
                                <span className="offer-store">
                                  {o.store}
                                  {best && <Badge tone="gold">Menor total</Badge>}
                                </span>
                                <span className="muted small">Origem: {o.source === 'manual' ? 'registro manual' : o.source}</span>
                              </td>
                              <td className="num">{formatCurrency(o.price)}</td>
                              <td className="num">{o.shipping === undefined ? <span className="muted">?</span> : o.shipping === 0 ? 'Grátis' : formatCurrency(o.shipping)}</td>
                              <td className="num">{total === undefined ? <span className="muted" title="Frete desconhecido">—</span> : <strong>{formatCurrency(total)}</strong>}</td>
                              <td className="num hide-mobile">{perMl ? formatCurrency(perMl) : '—'}</td>
                              <td className="hide-mobile small">{formatDateTime(new Date(o.checkedAt))}</td>
                              <td className="row-actions">
                                {o.url && (
                                  <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm btn--icon" aria-label={`Abrir página da oferta em ${o.store}`}>
                                    <ExternalLink size={15} />
                                  </a>
                                )}
                                <Button variant="ghost" size="sm" iconOnly icon={Pencil} aria-label="Editar oferta" onClick={() => { setEditing(o); setFormOpen(true); }} />
                                <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="Excluir oferta" onClick={() => setDeleting(o)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="muted small">
            Preços podem ter mudado desde a consulta. Ofertas com frete desconhecido não têm total calculado e aparecem
            ordenadas pelo preço do produto.
          </p>
        </>
      )}

      <OfferForm open={formOpen} offer={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        title="Excluir oferta?"
        danger
        confirmLabel="Excluir"
        onCancel={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (deleting) await deleteOffer(deleting.id);
          setDeleting(undefined);
          notify('Oferta excluída.');
        }}
      >
        A oferta de {deleting?.store} será removida.
      </ConfirmDialog>
    </div>
  );
}
