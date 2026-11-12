import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FlaskConical, Leaf } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { noteToEnglish, translateAccord, translateNote } from '../../data/noteTranslations';
import { useAppData } from '../../hooks/useAppData';
import { SCENTO_CREDIT, SCENTO_SITE, scento, type Folio, type ScentoMaterial } from '../../services/scento/scento';
import { scentoFamily } from '../../services/scento/labels';
import { normalize } from '../../utils/text';

/**
 * "O que é esta nota?" — toque numa nota (ex.: Ambroxan) para ver o que ela é,
 * o cheiro, com o que combina, perfumes famosos que a usam e quais perfumes da
 * SUA coleção a têm. Dados da Scento (glossário de matérias-primas).
 */

const NoteSheetContext = createContext<(note: string) => void>(() => undefined);

export function NoteSheetProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<string>();
  return (
    <NoteSheetContext.Provider value={setNote}>
      {children}
      <NoteSheet note={note} onClose={() => setNote(undefined)} onOpenNote={setNote} />
    </NoteSheetContext.Provider>
  );
}

export const useNoteSheet = () => useContext(NoteSheetContext);

/** Nota tocável (chip). */
export function NoteChip({ note, className = 'note-chip' }: { note: string; className?: string }) {
  const open = useNoteSheet();
  return (
    <button type="button" className={`${className} note-chip--button`} onClick={() => open(note)} title={`O que é ${note}?`}>
      {note}
    </button>
  );
}

const TIER_PT: Record<string, string> = { top: 'saída', heart: 'coração', middle: 'coração', base: 'fundo' };

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; folio: Folio<ScentoMaterial> };

function NoteSheet({ note, onClose, onOpenNote }: { note?: string; onClose(): void; onOpenNote(n: string): void }) {
  const { perfumes } = useAppData();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!note) return;
    let alive = true;
    setState({ status: 'loading' });
    const english = noteToEnglish(note);
    (async () => {
      let folio = await scento.material(english);
      // Sem tradução conhecida, tenta também o nome como exibido (a Scento aceita apelidos).
      if (folio.detail.found === false && english.toLowerCase() !== note.toLowerCase()) {
        const again = await scento.material(note);
        if (again.detail.found !== false) folio = again;
      }
      if (alive) setState({ status: 'ready', folio });
    })().catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [note]);

  // Perfumes da coleção (e desejados) que têm a nota.
  const mine = useMemo(() => {
    if (!note) return [];
    const k = normalize(note);
    return perfumes.filter((p) => [...p.topNotes, ...p.heartNotes, ...p.baseNotes].some((n) => normalize(n) === k));
  }, [note, perfumes]);

  if (!note) return null;
  const d = state.status === 'ready' ? state.folio.detail : undefined;
  const found = d && d.found !== false;
  const kind = d?.natural_or_synthetic === 'synthetic' ? 'Sintética' : d?.natural_or_synthetic === 'natural' ? 'Natural' : undefined;
  const family = d?.family ? translateAccord(d.family) : undefined;
  const subtitle = found ? [kind, family && `família ${family.toLowerCase()}`].filter(Boolean).join(' · ') : undefined;

  return (
    <Modal open title={note} subtitle={subtitle} onClose={onClose} size="md">
      <div className="note-sheet">
        {state.status === 'loading' && (
          <p className="muted" aria-busy="true">
            Consultando o glossário da Scento…
          </p>
        )}
        {state.status === 'error' && <p className="muted">{state.message}</p>}

        {found && d && (
          <>
            <div className="note-sheet__kind">
              {kind === 'Sintética' ? <FlaskConical size={16} aria-hidden /> : <Leaf size={16} aria-hidden />}
              <span>
                {kind === 'Sintética'
                  ? 'Criada em laboratório — muitas notas modernas (como as ambaradas e almiscaradas) são sintéticas e muito estáveis na pele.'
                  : 'Extraída de matéria-prima natural.'}
              </span>
            </div>
            {d.smells_like && (
              <div className="note-sheet__block">
                <p className="scento__subtitle">Cheiro</p>
                <p className="note-sheet__smell" lang="en">
                  {d.smells_like}
                </p>
                <p className="note-sheet__hint">Descrição da Scento, no original em inglês.</p>
              </div>
            )}
            {d.scento_family && (
              <p className="small muted">
                Na classificação da Scento: <strong>{scentoFamily(d.scento_family)}</strong>.
              </p>
            )}
            {d.pairs_well_with && d.pairs_well_with.length > 0 && (
              <div className="note-sheet__block">
                <p className="scento__subtitle">Combina com</p>
                <div className="note-sheet__chips">
                  {d.pairs_well_with.map((n) => {
                    const pt = translateNote(n);
                    return (
                      <button key={n} type="button" className="note-chip note-chip--button" onClick={() => onOpenNote(pt)}>
                        {pt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {d && !found && (
          <p className="muted">
            A Scento ainda não tem “{note}” no glossário.
            {d.suggestions?.length ? ` Talvez: ${d.suggestions.slice(0, 4).map(translateNote).join(', ')}.` : ''}
          </p>
        )}

        <div className="note-sheet__block">
          <p className="scento__subtitle">Na sua coleção</p>
          {mine.length ? (
            <ul className="note-sheet__mine">
              {mine.map((p) => (
                <li key={p.id}>
                  <Link to={`/colecao/${p.id}`} onClick={onClose}>
                    {p.name}
                  </Link>
                  <span className="muted small"> · {p.brand}</span>
                  {p.status === 'wishlist' && <span className="muted small"> (desejado)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nenhum perfume cadastrado com essa nota.</p>
          )}
        </div>

        {found && d?.showcased_in && d.showcased_in.length > 0 && (
          <div className="note-sheet__block">
            <p className="scento__subtitle">Perfumes conhecidos com essa nota</p>
            <ul className="note-sheet__famous">
              {d.showcased_in.slice(0, 6).map((p) => (
                <li key={p.page}>
                  <a href={p.page} target="_blank" rel="noopener noreferrer">
                    {p.name}
                  </a>
                  <span className="muted small">
                    {' '}
                    · {p.house}
                    {p.tier && TIER_PT[p.tier] ? ` · no ${TIER_PT[p.tier]}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.status === 'ready' && (
          <p className="scento-credit">
            Dados: <a href={SCENTO_SITE} target="_blank" rel="noopener noreferrer">{SCENTO_CREDIT}</a>
            {found && (
              <>
                {' · '}
                <a href={state.folio.scento_page.url} target="_blank" rel="noopener noreferrer">
                  Ver no Scento <ExternalLink size={11} aria-hidden />
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </Modal>
  );
}

