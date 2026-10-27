import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Heart, Plus } from 'lucide-react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { SCENTO_CREDIT, SCENTO_SITE, isPerfumePage, sameHouse, slugFromPage } from '../../services/scento/scento';
import { scentoFamily, scentoNote, scentoRole } from '../../services/scento/labels';
import type { Perfume } from '../../types';
import { normalize } from '../../utils/text';
import { EMPTY_FORM, formToInput } from '../collection/perfumeFormModel';

export interface PickItem {
  name: string;
  house: string;
  page: string;
  family?: string;
  /** Frase original da Scento (em inglês). */
  why?: string;
  shared?: string[];
  role?: string;
}

const compact = (s: string) => normalize(s).replace(/[^a-z0-9]/g, '');

/** Encontra na coleção um perfume que corresponda a uma sugestão da Scento. */
export function useOwnedLookup() {
  const { perfumes } = useAppData();
  return useCallback(
    (name: string, house: string, page?: string): Perfume | undefined => {
      const slug = page ? slugFromPage(page) : undefined;
      return perfumes.find(
        (p) => (slug && p.scentoId === slug) || (compact(p.name) === compact(name) && sameHouse(p.brand, house)),
      );
    },
    [perfumes],
  );
}

/** "+ Desejados": cria um perfume na lista de desejos com nome e marca (e o vínculo com a Scento). */
export function useAddToWishlist() {
  const { addPerfume } = useAppData();
  const { notify } = useToast();
  return useCallback(
    async (item: PickItem, context: string) => {
      const slug = slugFromPage(item.page);
      await addPerfume({
        ...formToInput({ ...EMPTY_FORM, name: item.name, brand: item.house, status: 'wishlist', notes: `Sugestão da Scento — ${context}.` }),
        scentoId: slug,
      });
      notify(`${item.name} foi para a sua lista de desejos.`);
    },
    [addPerfume, notify],
  );
}

export function ScentoCredit({ page }: { page?: { label: string; url: string } }) {
  return (
    <p className="scento-credit">
      Dados: <a href={SCENTO_SITE} target="_blank" rel="noopener noreferrer">{SCENTO_CREDIT}</a>
      {page && (
        <>
          {' · '}
          <a href={page.url} target="_blank" rel="noopener noreferrer">
            {page.label} <ExternalLink size={11} aria-hidden />
          </a>
        </>
      )}
    </p>
  );
}

/** Lista de sugestões da Scento (parecidos, ocasião ou guarda-roupa). */
export function ScentoPicks({ items, context }: { items: PickItem[]; context: string }) {
  const findOwned = useOwnedLookup();
  const addToWishlist = useAddToWishlist();
  const [adding, setAdding] = useState<string>();
  const rows = useMemo(() => items.map((it) => ({ it, owned: findOwned(it.name, it.house, it.page) })), [items, findOwned]);

  return (
    <ul className="scento-picks">
      {rows.map(({ it, owned }) => (
        <li key={`${it.house}-${it.name}-${it.role ?? ''}`} className="scento-pick">
          <div className="scento-pick__head">
            <div className="scento-pick__title">
              {it.role && <span className="scento-pick__role">{scentoRole(it.role)}</span>}
              {owned ? (
                <Link to={`/colecao/${owned.id}`} className="scento-pick__name">
                  {it.name}
                </Link>
              ) : (
                <a
                  href={it.page}
                  title={isPerfumePage(it.page) ? 'Ver no Scento' : 'Ver a marca no Scento'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="scento-pick__name"
                >
                  {it.name}
                </a>
              )}
              <span className="scento-pick__house">
                {it.house}
                {it.family ? ` · ${scentoFamily(it.family)}` : ''}
              </span>
            </div>
            {owned ? (
              <Badge tone={owned.status === 'wishlist' ? 'neutral' : 'gold'}>
                {owned.status === 'wishlist' ? (
                  <>
                    <Heart size={11} aria-hidden /> Desejado
                  </>
                ) : (
                  <>
                    <Check size={11} aria-hidden /> Na coleção
                  </>
                )}
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={Plus}
                disabled={adding === it.name}
                onClick={async () => {
                  setAdding(it.name);
                  try {
                    await addToWishlist(it, context);
                  } finally {
                    setAdding(undefined);
                  }
                }}
              >
                Desejados
              </Button>
            )}
          </div>
          {it.shared && it.shared.length > 0 && (
            <p className="scento-pick__shared">
              <strong>Em comum:</strong> {it.shared.slice(0, 6).map(scentoNote).join(', ')}
            </p>
          )}
          {it.why && (
            <p className="scento-pick__why" lang="en">
              {it.why}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
