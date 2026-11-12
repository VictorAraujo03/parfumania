import { useEffect, useMemo, useState } from 'react';
import { Award, BookmarkPlus, ExternalLink, ImagePlus, RefreshCw, Tag } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import {
  STORE_PRICES_AVAILABLE,
  buildPriceQuery,
  isRenowned,
  matchesPerfume,
  pickBestOffers,
  searchStorePrices,
  type StoreOffer,
  type StoreSearchResult,
} from '../../services/prices/storePrices';
import type { Perfume } from '../../types';
import { formatCurrency } from '../../utils/format';

export interface PriceTarget {
  name: string;
  brand?: string;
  volumeMl?: number;
  /** Perfume da coleção/lista de desejos, para salvar a oferta e a foto nele. */
  perfume?: Perfume;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: StoreSearchResult };

/** Consulta o preço do perfume nas lojas e mostra as 3 melhores ofertas para comparar. */
export function PriceCompareDialog({ target, onClose }: { target?: PriceTarget; onClose(): void }) {
  const { addOffer, updatePerfume } = useAppData();
  const { notify } = useToast();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [showAll, setShowAll] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const query = target ? buildPriceQuery(target.name, target.brand, target.volumeMl) : '';

  // Depende só do texto da busca: o objeto `target` é recriado a cada render de quem abre.
  useEffect(() => {
    if (!query || !STORE_PRICES_AVAILABLE) return;
    let alive = true;
    setState({ status: 'loading' });
    setShowAll(false);
    searchStorePrices(`${query} perfume`)
      .then((result) => alive && setState({ status: 'ready', result }))
      .catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [query, nonce]);

  const { best, all } = useMemo(() => {
    if (state.status !== 'ready' || !target) return { best: [], all: [] };
    const offers = state.result.offers;
    const relevant = offers.filter((o) => matchesPerfume(o, target.name, target.brand, target.volumeMl));
    return {
      best: pickBestOffers(offers, target.name, target.brand, target.volumeMl),
      all: [...relevant].sort((a, b) => a.price - b.price),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, query]);

  if (!target) return null;
  const perfume = target.perfume;
  const keyOf = (o: StoreOffer) => `${o.store}|${o.price}|${o.title}`;

  async function saveOffer(o: StoreOffer) {
    await addOffer({
      perfumeName: target!.name,
      brand: target!.brand ?? '',
      volumeMl: target!.volumeMl,
      condition: 'new',
      store: o.store,
      price: o.price,
      url: o.url,
      checkedAt: state.status === 'ready' ? state.result.fetchedAt : new Date().toISOString(),
      source: 'google-shopping',
      perfumeId: perfume?.id,
      notes: o.title,
    });
    setSaved((s) => new Set(s).add(keyOf(o)));
    notify(`Oferta de ${o.store} salva em Preços.`);
  }

  async function useImage(o: StoreOffer) {
    if (!perfume || !o.image) return;
    await updatePerfume(perfume.id, { imageUrl: o.image });
    notify('Foto adicionada ao perfume.');
  }

  const minPrice = best.length ? Math.min(...best.map((o) => o.price)) : undefined;
  const card = (o: StoreOffer, inBest?: boolean) => (
    <li key={keyOf(o)} className={`price-offer ${inBest && o.price === minPrice ? 'price-offer--best' : ''}`}>
      <div className="price-offer__media">
        {o.image ? <img src={o.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Tag size={20} aria-hidden />}
      </div>
      <div className="price-offer__info">
        <div className="price-offer__store">
          {o.store}
          {isRenowned(o.store) && <Badge tone="neutral">Loja conhecida</Badge>}
          {inBest && o.price === minPrice && (
            <Badge tone="success">
              <Award size={11} aria-hidden /> Menor preço
            </Badge>
          )}
        </div>
        <p className="price-offer__title">{o.title}</p>
        {o.delivery && <p className="price-offer__delivery">{o.delivery}</p>}
      </div>
      <div className="price-offer__price">
        {o.oldPrice && o.oldPrice > o.price && <s>{formatCurrency(o.oldPrice)}</s>}
        <strong>{formatCurrency(o.price)}</strong>
      </div>
      <div className="price-offer__actions">
        {o.url && (
          <a href={o.url} target="_blank" rel="noopener noreferrer" className="btn btn--secondary btn--sm">
            Ver na loja <ExternalLink size={13} aria-hidden />
          </a>
        )}
        <Button size="sm" variant="ghost" icon={BookmarkPlus} disabled={saved.has(keyOf(o))} onClick={() => void saveOffer(o)}>
          {saved.has(keyOf(o)) ? 'Salva' : 'Salvar oferta'}
        </Button>
        {perfume && o.image && !perfume.imageId && perfume.imageUrl !== o.image && (
          <Button size="sm" variant="ghost" icon={ImagePlus} onClick={() => void useImage(o)}>
            Usar esta foto
          </Button>
        )}
      </div>
    </li>
  );

  let body;
  if (!STORE_PRICES_AVAILABLE) {
    body = <p className="muted">A busca de preços precisa do login na nuvem. No modo local, registre preços manualmente em Preços.</p>;
  } else if (state.status === 'loading') {
    body = (
      <p className="muted" aria-busy="true">
        Consultando as lojas…
      </p>
    );
  } else if (state.status === 'error') {
    body = (
      <div className="stack">
        <p className="muted">{state.message}</p>
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setNonce((n) => n + 1)}>
          Tentar de novo
        </Button>
      </div>
    );
  } else if (best.length === 0) {
    body = (
      <p className="muted">
        Nenhuma oferta encontrada para “{query}”. {state.result.offers.length > 0 && 'Os resultados não correspondiam a este perfume.'}
      </p>
    );
  } else {
    const fetched = new Date(state.result.fetchedAt);
    body = (
      <div className="price-compare">
        <ul className="price-offers">{best.map((o) => card(o, true))}</ul>
        {best.length >= 2 && (
          <p className="price-compare__diff">
            Diferença entre a mais barata e a mais cara: <strong>{formatCurrency(Math.max(...best.map((o) => o.price)) - minPrice!)}</strong>.
          </p>
        )}
        {all.length > best.length && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
              {showAll ? 'Ocultar outras ofertas' : `Ver todas as ofertas (${all.length})`}
            </Button>
            {showAll && <ul className="price-offers price-offers--all">{all.filter((o) => !best.includes(o)).map((o) => card(o))}</ul>}
          </>
        )}
        <p className="price-compare__note">
          Preços do Google Shopping em {fetched.toLocaleDateString('pt-BR')} às{' '}
          {fetched.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {state.result.cached ? ' (busca recente reaproveitada)' : ''}. Frete e disponibilidade podem mudar: confirme na loja.
        </p>
      </div>
    );
  }

  return (
    <Modal open={!!target} title={`Preços: ${target.name}`} subtitle={[target.brand, target.volumeMl ? `${target.volumeMl} ml` : null].filter(Boolean).join(' · ')} onClose={onClose} size="lg">
      {body}
    </Modal>
  );
}
