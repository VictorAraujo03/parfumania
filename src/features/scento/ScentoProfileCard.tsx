import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card, CardHeader } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import {
  resolveScento,
  scento,
  slugFromPage,
  type Folio,
  type ScentoMatch,
  type ScentoNeighbour,
  type ScentoPortrait,
} from '../../services/scento/scento';
import { scentoFamily, scentoHour, scentoNote, scentoSeason, scentoWord } from '../../services/scento/labels';
import type { Perfume } from '../../types';
import { ScentoCredit, ScentoPicks } from './ScentoPicks';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'pick'; candidates: ScentoMatch[] }
  | { status: 'ready'; portrait: Folio<ScentoPortrait>; neighbours?: Folio<{ total: number; neighbours: ScentoNeighbour[] }> };

/**
 * Perfil do perfume na Scento + "Parecidos com este". Busca só quando a página
 * é aberta; o vínculo confirmado fica salvo no perfume (scentoId).
 */
export function ScentoProfileCard({ perfume }: { perfume: Perfume }) {
  const { updatePerfume } = useAppData();
  const { notify } = useToast();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScentoMatch[]>();
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    (async () => {
      try {
        let slug = perfume.scentoId;
        if (!slug) {
          const r = await resolveScento(perfume.name, perfume.brand);
          if (!r.slug) {
            if (alive) setState({ status: 'pick', candidates: r.candidates });
            return;
          }
          slug = r.slug;
          // Correspondência segura (mesmo nome e marca): guarda para não buscar de novo.
          void updatePerfume(perfume.id, { scentoId: slug }).catch(() => undefined);
        }
        const portrait = await scento.portrait(slug);
        if (!alive) return;
        setState({ status: 'ready', portrait });
        const neighbours = await scento.neighbours(slug).catch(() => undefined);
        if (alive && neighbours) setState({ status: 'ready', portrait, neighbours });
      } catch (err) {
        if (alive) setState({ status: 'error', message: (err as Error).message });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfume.id, perfume.scentoId, nonce]);

  async function choose(m: ScentoMatch) {
    const slug = slugFromPage(m.page);
    if (!slug) return;
    setChoosing(false);
    setSearchResults(undefined);
    await updatePerfume(perfume.id, { scentoId: slug });
    notify(`Vinculado a ${m.name} (${m.house}) na Scento.`);
  }

  async function runSearch() {
    if (query.trim().length < 2) return;
    try {
      setSearchResults((await scento.search(query.trim())).detail.matches.filter((m) => m.kind === 'perfume'));
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }

  const candidates = state.status === 'pick' ? state.candidates : [];
  const picker = (
    <div className="scento-picker">
      {candidates.length > 0 && !searchResults && (
        <>
          <p className="muted small">É algum destes?</p>
          <MatchList matches={candidates} onChoose={choose} />
        </>
      )}
      <form
        className="scento-picker__search"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na Scento pelo nome"
          aria-label="Buscar perfume na Scento"
        />
        <Button type="submit" size="sm" variant="secondary" icon={Search}>
          Buscar
        </Button>
      </form>
      {searchResults &&
        (searchResults.length ? (
          <MatchList matches={searchResults} onChoose={choose} />
        ) : (
          <p className="muted small">Nada encontrado com esse nome.</p>
        ))}
    </div>
  );

  let body;
  if (state.status === 'loading') {
    body = <p className="muted small" aria-busy="true">Procurando na Scento…</p>;
  } else if (state.status === 'error') {
    body = (
      <div className="scento-empty">
        <p className="muted small">{state.message}</p>
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setNonce((n) => n + 1)}>
          Tentar de novo
        </Button>
      </div>
    );
  } else if (state.status === 'pick') {
    body = (
      <div className="scento-empty">
        <p className="muted small">
          {candidates.length
            ? 'Não tivemos certeza de qual perfume da Scento é este.'
            : 'Este perfume não foi encontrado na base da Scento (cerca de 1.500 perfumes).'}
        </p>
        {picker}
      </div>
    );
  } else {
    const d = state.portrait.detail;
    const pyramid = d.pyramid;
    const hasOwnNotes = perfume.topNotes.length + perfume.heartNotes.length + perfume.baseNotes.length > 0;
    body = (
      <div className="scento">
        <div className="scento__facts">
          {d.family && (
            <Fact label="Família Scento">
              <span className="chip-static" title={d.family}>
                {scentoFamily(d.family)}
              </span>
              {d.subfamily && d.subfamily !== d.family && (
                <span className="chip-static" title={d.subfamily}>
                  {scentoFamily(d.subfamily)}
                </span>
              )}
            </Fact>
          )}
          {d.wears?.seasons?.length ? (
            <Fact label="Estações">
              {d.wears.seasons.map((s) => (
                <span key={s} className="chip-static">
                  {scentoSeason(s)}
                </span>
              ))}
            </Fact>
          ) : null}
          {d.wears?.hours?.length ? (
            <Fact label="Horários">
              {d.wears.hours.map((h) => (
                <span key={h} className="chip-static">
                  {scentoHour(h)}
                </span>
              ))}
            </Fact>
          ) : null}
          {d.character_words?.length ? (
            <Fact label="Caráter">
              {d.character_words.map((w) => (
                <span key={w} className="chip-static">
                  {scentoWord(w)}
                </span>
              ))}
            </Fact>
          ) : null}
          {d.signature_materials?.length ? (
            <Fact label="Ingredientes de assinatura">
              {d.signature_materials.map((m) => (
                <span key={m} className="chip-static chip-static--gold">
                  {scentoNote(m)}
                </span>
              ))}
            </Fact>
          ) : null}
        </div>

        <blockquote className="scento__lede" lang="en">
          “{state.portrait.lede}”
        </blockquote>

        {!hasOwnNotes && pyramid && (
          <div className="scento__import">
            <p className="small">
              Seu cadastro ainda não tem notas. A Scento lista:{' '}
              <span className="muted">
                {[...pyramid.top, ...pyramid.heart, ...pyramid.base].map(scentoNote).join(', ')}
              </span>
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon={Sparkles}
              onClick={async () => {
                await updatePerfume(perfume.id, {
                  topNotes: pyramid.top.map(scentoNote),
                  heartNotes: pyramid.heart.map(scentoNote),
                  baseNotes: pyramid.base.map(scentoNote),
                });
                notify('Notas da Scento adicionadas ao perfume.');
              }}
            >
              Usar estas notas
            </Button>
          </div>
        )}

        <div className="scento__neighbours">
          <h3 className="scento__subtitle">Parecidos com este</h3>
          {state.neighbours ? (
            state.neighbours.detail.neighbours.length ? (
              <ScentoPicks
                context={`parecido com ${perfume.name}`}
                items={state.neighbours.detail.neighbours.slice(0, 6).map((n) => ({
                  name: n.name,
                  house: n.house,
                  page: n.page,
                  family: n.family,
                  shared: n.shared,
                  why: n.difference,
                }))}
              />
            ) : (
              <p className="muted small">A Scento não encontrou perfumes parecidos.</p>
            )
          ) : (
            <p className="muted small" aria-busy="true">Buscando parecidos…</p>
          )}
        </div>

        <div className="scento__footer">
          <ScentoCredit page={state.portrait.scento_page} />
          <Button size="sm" variant="ghost" onClick={() => setChoosing((c) => !c)} aria-expanded={choosing}>
            Não é este perfume?
          </Button>
        </div>
        {choosing && picker}
      </div>
    );
  }

  return (
    <Card className="detail-grid__wide scento-card">
      <CardHeader
        title="Perfil Scento"
        subtitle="Da base da Scento — descrições no original, em inglês."
        action={
          state.status === 'ready' ? (
            <a href={state.portrait.scento_page.url} target="_blank" rel="noopener noreferrer" className="link-subtle">
              Ver no Scento <ExternalLink size={13} aria-hidden />
            </a>
          ) : undefined
        }
      />
      {body}
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="scento-fact">
      <span className="scento-fact__label">{label}</span>
      <div className="scento-fact__values">{children}</div>
    </div>
  );
}

function MatchList({ matches, onChoose }: { matches: ScentoMatch[]; onChoose(m: ScentoMatch): void }) {
  return (
    <ul className="scento-matches">
      {matches.map((m) => (
        <li key={m.page}>
          <button type="button" className="scento-match" onClick={() => onChoose(m)}>
            <strong>{m.name}</strong>
            <span>
              {m.house}
              {m.family ? ` · ${scentoFamily(m.family)}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
