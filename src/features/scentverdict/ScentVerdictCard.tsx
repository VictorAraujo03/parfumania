import { useEffect, useState } from 'react';
import { ExternalLink, ImagePlus, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '../../components/Button';
import { ChipSingleSelect } from '../../components/ChipGroup';
import { Badge, Card, CardHeader } from '../../components/ui';
import { translateNote } from '../../data/noteTranslations';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import {
  SCENTVERDICT_AVAILABLE,
  SCENTVERDICT_SITE,
  resolveScentVerdict,
  scentVerdict,
  svBadge,
  translateSv,
  type SvDirection,
  type SvFragrance,
  type SvProfile,
  type SvSimilar,
} from '../../services/scentverdict/scentVerdict';
import type { Perfume } from '../../types';
import { normalize } from '../../utils/text';
import { EMPTY_FORM, formToInput } from '../collection/perfumeFormModel';
import { NoteChip } from '../notes/NoteSheet';
import { PriceButton } from '../prices/PriceButton';

const DIRECTIONS: { value: SvDirection; label: string }[] = [
  { value: 'Similar', label: 'Parecidos' },
  { value: 'Fresher', label: 'Mais frescos' },
  { value: 'LongerLasting', label: 'Duram mais' },
  { value: 'MoreIntense', label: 'Mais intensos' },
  { value: 'LessSweet', label: 'Menos doces' },
  { value: 'Cheaper', label: 'Mais baratos*' },
];

const PHASE_PT: Record<string, string> = { top: 'Saída', heart: 'Coração', base: 'Fundo' };

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'pick'; candidates: SvFragrance[] }
  | { status: 'ready'; fragrance: SvFragrance; profile?: SvProfile };

/**
 * ScentVerdict na página do perfume: foto oficial, avaliação, quanto dura cada
 * nota (estimativa pela matéria-prima) e "parecidos, só que…".
 */
export function ScentVerdictCard({ perfume }: { perfume: Perfume }) {
  const { updatePerfume } = useAppData();
  const { notify } = useToast();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<SvFragrance[]>();

  useEffect(() => {
    if (!SCENTVERDICT_AVAILABLE) return;
    let alive = true;
    setState({ status: 'loading' });
    (async () => {
      let slug = perfume.scentVerdictId;
      if (!slug) {
        const r = await resolveScentVerdict(perfume.name, perfume.brand, perfume.concentration);
        if (!r.slug) {
          if (alive) setState({ status: 'pick', candidates: r.candidates });
          return;
        }
        slug = r.slug;
        void updatePerfume(perfume.id, { scentVerdictId: slug }).catch(() => undefined);
      }
      const fragrance = await scentVerdict.fragrance(slug);
      if (!fragrance) {
        if (alive) setState({ status: 'pick', candidates: [] });
        return;
      }
      if (!alive) return;
      setState({ status: 'ready', fragrance });
      // Sem foto própria nem de loja: usa a foto oficial (só um link; dá para trocar depois).
      if (!perfume.imageId && !perfume.imageUrl && fragrance.imageUrl) {
        void updatePerfume(perfume.id, { imageUrl: fragrance.imageUrl })
          .then(() => notify('Foto oficial do frasco adicionada (ScentVerdict).'))
          .catch(() => undefined);
      }
      const profile = await scentVerdict.profile(slug).catch(() => undefined);
      if (alive && profile) setState({ status: 'ready', fragrance, profile });
    })().catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfume.id, perfume.scentVerdictId, nonce]);

  if (!SCENTVERDICT_AVAILABLE) return null;

  async function choose(f: SvFragrance) {
    setFound(undefined);
    await updatePerfume(perfume.id, { scentVerdictId: f.slug });
    notify(`Vinculado a ${f.name} (${f.brand}) no ScentVerdict.`);
  }

  const picker = (candidates: SvFragrance[]) => (
    <div className="scento-picker">
      {candidates.length > 0 && !found && <MatchList items={candidates} onChoose={choose} />}
      <form
        className="scento-picker__search"
        onSubmit={async (e) => {
          e.preventDefault();
          if (query.trim().length < 2) return;
          try {
            setFound(await scentVerdict.search(query.trim()));
          } catch (err) {
            notify((err as Error).message, 'error');
          }
        }}
      >
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar no ScentVerdict" />
        <Button type="submit" size="sm" variant="secondary" icon={Search}>
          Buscar
        </Button>
      </form>
      {found && (found.length ? <MatchList items={found} onChoose={choose} /> : <p className="muted small">Nada encontrado.</p>)}
    </div>
  );

  let body;
  if (state.status === 'loading') body = <p className="muted small" aria-busy="true">Consultando o ScentVerdict…</p>;
  else if (state.status === 'error')
    body = (
      <div className="scento-empty">
        <p className="muted small">{state.message}</p>
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setNonce((n) => n + 1)}>
          Tentar de novo
        </Button>
      </div>
    );
  else if (state.status === 'pick')
    body = (
      <div className="scento-empty">
        <p className="muted small">
          {state.candidates.length ? 'Qual destes é o seu perfume?' : 'Não encontramos este perfume no ScentVerdict.'}
        </p>
        {picker(state.candidates)}
      </div>
    );
  else {
    const f = state.fragrance;
    const badge = svBadge(f.verdictBadge);
    body = (
      <div className="sv">
        <div className="sv__top">
          {f.imageUrl && (
            <div className="sv__image">
              <img src={f.imageUrl} alt={`Frasco de ${f.name}`} loading="lazy" />
              {perfume.imageUrl !== f.imageUrl && !perfume.imageId && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ImagePlus}
                  onClick={() => updatePerfume(perfume.id, { imageUrl: f.imageUrl! }).then(() => notify('Foto oficial adicionada.'))}
                >
                  Usar esta foto
                </Button>
              )}
            </div>
          )}
          <div className="sv__verdict">
            <div className="sv__badges">
              {badge && <Badge tone="gold">{badge}</Badge>}
              {f.concentration && <Badge>{f.concentration.toUpperCase()}</Badge>}
              {f.yearLaunched && <Badge>{f.yearLaunched}</Badge>}
            </div>
            {f.verdict && (
              <>
                <p className="sv__text" lang="en">
                  “{f.verdict}”
                </p>
                <p className="note-sheet__hint">Avaliação do ScentVerdict, no original em inglês.</p>
              </>
            )}
            {f.keyNotes && f.keyNotes.length > 0 && (
              <div className="note-sheet__chips">
                {f.keyNotes.map((n) => (
                  <NoteChip key={n} note={translateNote(n)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {state.profile && <NoteDuration profile={state.profile} />}
        <Similar slug={f.slug} perfumeName={perfume.name} />

        <div className="scento__footer">
          <p className="scento-credit">
            Dados:{' '}
            <a href={SCENTVERDICT_SITE} target="_blank" rel="noopener noreferrer">
              ScentVerdict
            </a>{' '}
            ·{' '}
            <a href={f.url} target="_blank" rel="noopener noreferrer">
              Ver página <ExternalLink size={11} aria-hidden />
            </a>
          </p>
          <Button size="sm" variant="ghost" onClick={() => setState({ status: 'pick', candidates: [] })}>
            Não é este perfume?
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="detail-grid__wide scento-card">
      <CardHeader title="ScentVerdict" subtitle="Foto oficial, avaliação, quanto dura cada nota e perfumes parecidos." />
      {body}
    </Card>
  );
}

/** Barras com as horas típicas de cada nota na pele, por fase. */
function NoteDuration({ profile }: { profile: SvProfile }) {
  const all = profile.phases.flatMap((p) => p.notes);
  if (all.length === 0) return null;
  const longest = Math.max(...all.map((n) => n.substantivityHours));
  return (
    <div className="sv__duration">
      <h3 className="scento__subtitle">Quanto dura cada nota (estimativa)</h3>
      {profile.phases.map((ph) => (
        <div key={ph.phase} className="sv__phase">
          <span className="sv__phase-label">{PHASE_PT[ph.phase] ?? ph.phase}</span>
          <ul>
            {[...ph.notes]
              .sort((a, b) => b.substantivityHours - a.substantivityHours)
              .map((n) => (
                <li key={n.note} className="sv__bar">
                  <NoteChip note={translateNote(n.note)} className="sv__bar-note" />
                  <span className="sv__bar-track" aria-hidden>
                    <span style={{ width: `${Math.max(4, (Math.min(n.substantivityHours, 24) / 24) * 100)}%` }} />
                  </span>
                  <span className="sv__bar-hours">{n.substantivityHours >= 1 ? `${n.substantivityHours} h` : `${Math.round(n.substantivityHours * 60)} min`}</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <p className="note-sheet__hint">
        Tempo típico de cada matéria-prima na pele (até {longest} h nas notas de fundo) — não é uma medição deste perfume;
        clima, pele e quantidade aplicada mudam bastante.
      </p>
    </div>
  );
}

function Similar({ slug, perfumeName }: { slug: string; perfumeName: string }) {
  const { perfumes, addPerfume } = useAppData();
  const { notify } = useToast();
  const [direction, setDirection] = useState<SvDirection>('Similar');
  const [items, setItems] = useState<SvSimilar[] | 'loading' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    setItems('loading');
    scentVerdict
      .similar(slug, direction)
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems('error'));
    return () => {
      alive = false;
    };
  }, [slug, direction]);

  const owned = (f: SvFragrance) =>
    perfumes.find((p) => p.scentVerdictId === f.slug || (normalize(p.name) === normalize(f.name) && normalize(p.brand).includes(normalize(f.brand))));

  return (
    <div className="sv__similar">
      <h3 className="scento__subtitle">Parecidos, só que…</h3>
      <ChipSingleSelect options={DIRECTIONS} value={direction} onChange={(v) => v && setDirection(v)} allowClear={false} ariaLabel="Direção" />
      {direction === 'Cheaper' && <p className="note-sheet__hint">*Pelos preços que o ScentVerdict acompanha (lojas do Reino Unido). Confira o preço no Brasil em “Ver preços”.</p>}
      {items === 'loading' && <p className="muted small" aria-busy="true">Buscando…</p>}
      {items === 'error' && <p className="muted small">Não foi possível buscar parecidos agora.</p>}
      {Array.isArray(items) && (
        <ul className="scento-picks">
          {items.map((it) => {
            const f = it.fragrance;
            const mine = owned(f);
            const why = translateSv(it.whySimilar);
            const diff = translateSv(it.keyDifference);
            return (
              <li key={f.slug} className="scento-pick sv-pick">
                <div className="sv-pick__head">
                  {f.imageUrl && <img src={f.imageUrl} alt="" loading="lazy" className="sv-pick__img" />}
                  <div className="scento-pick__title">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="scento-pick__name">
                      {f.name}
                    </a>
                    <span className="scento-pick__house">
                      {f.brand}
                      {it.similarityScore ? ` · ${it.similarityScore}% parecido` : ''}
                    </span>
                  </div>
                </div>
                {why.text && <p className="scento-pick__shared" lang={why.translated ? 'pt-BR' : 'en'}>{why.text}</p>}
                {diff.text && <p className="scento-pick__why" lang={diff.translated ? 'pt-BR' : 'en'}>{diff.text}</p>}
                <div className="scento-pick__foot">
                  <PriceButton target={{ name: f.name, brand: f.brand }} />
                  {mine ? (
                    <Badge>{mine.status === 'wishlist' ? 'Desejado' : 'Na coleção'}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Plus}
                      onClick={async () => {
                        await addPerfume({
                          ...formToInput({ ...EMPTY_FORM, name: f.name, brand: f.brand, status: 'wishlist', notes: `Sugestão do ScentVerdict — parecido com ${perfumeName}.` }),
                          scentVerdictId: f.slug,
                          imageUrl: f.imageUrl ?? undefined,
                        });
                        notify(`${f.name} foi para a sua lista de desejos.`);
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
      )}
    </div>
  );
}

function MatchList({ items, onChoose }: { items: SvFragrance[]; onChoose(f: SvFragrance): void }) {
  return (
    <ul className="scento-matches">
      {items.map((m) => (
        <li key={m.slug}>
          <button type="button" className="scento-match" onClick={() => onChoose(m)}>
            <strong>{m.name}</strong>
            <span>
              {m.brand}
              {m.concentration ? ` · ${m.concentration.toUpperCase()}` : ''}
              {m.yearLaunched ? ` · ${m.yearLaunched}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
