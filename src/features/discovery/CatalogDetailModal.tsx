import { Link, useNavigate } from 'react-router-dom';
import { Check, Plus, Star } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Badge, Notice } from '../../components/ui';
import { CONCENTRATIONS, FAMILIES, OCCASIONS, labelOf } from '../../data/options';
import type { CatalogEntry, Perfume } from '../../types';
import { NotesPyramid } from '../collection/NotesPyramid';

const VERIFICATION_LABEL = { unverified: 'Não verificado', partial: 'Parcialmente verificado', verified: 'Verificado' };

export function CatalogDetailModal({
  entry,
  owned,
  onClose,
}: {
  entry: CatalogEntry | undefined;
  owned?: Perfume;
  onClose(): void;
}) {
  const navigate = useNavigate();
  if (!entry) return null;
  const add = (status: 'owned' | 'wishlist') => navigate(`/colecao/novo?catalog=${entry.id}&status=${status}`);

  return (
    <Modal
      open
      onClose={onClose}
      title={entry.name}
      subtitle={entry.brand}
      size="md"
      footer={
        owned ? (
          <Link to={`/colecao/${owned.id}`} className="btn btn--secondary btn--md">
            <Check size={17} aria-hidden /> Já cadastrado — ver na coleção
          </Link>
        ) : (
          <>
            <Button variant="ghost" icon={Star} onClick={() => add('wishlist')}>
              Lista de desejos
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => add('owned')}>
              Adicionar à coleção
            </Button>
          </>
        )
      }
    >
      <div className="stack">
        <div className="detail-hero__badges">
          {entry.concentration && (
            <Badge>{entry.concentration === 'other' ? entry.concentrationLabel ?? 'Outra' : labelOf(CONCENTRATIONS, entry.concentration)}</Badge>
          )}
          {entry.year && <Badge>{entry.year}</Badge>}
          {entry.family && (
            <Badge title={entry.familyFromAccord ? 'Sugerida a partir do acorde principal' : undefined}>
              {labelOf(FAMILIES, entry.family)}
              {entry.familyFromAccord ? '*' : ''}
            </Badge>
          )}
          <Badge tone="warning">{VERIFICATION_LABEL[entry.verification]}</Badge>
        </div>
        {entry.description && <p className="muted">{entry.description}</p>}
        {entry.perfumers && (
          <p className="small">
            <span className="muted">Perfumista{entry.perfumers.length > 1 ? 's' : ''}:</span> {entry.perfumers.join(', ')}
          </p>
        )}
        {entry.accords && (
          <div>
            <h3 className="mini-title">Acordes principais</h3>
            <div className="chip-group chip-group--static">
              {entry.accords.map((a) => (
                <span key={a} className="chip chip--static">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
        <NotesPyramid top={entry.topNotes} heart={entry.heartNotes} base={entry.baseNotes} />
        {entry.familyFromAccord && <p className="field__hint">* Família sugerida a partir do acorde principal informado pela fonte.</p>}
        {entry.suggestedOccasions.length > 0 && (
          <div>
            <h3 className="mini-title">Ocasiões sugeridas (editorial)</h3>
            <div className="chip-group chip-group--static">
              {entry.suggestedOccasions.map((o) => (
                <span key={o} className="chip chip--static">
                  {labelOf(OCCASIONS, o)}
                </span>
              ))}
            </div>
          </div>
        )}
        <Notice tone="info">
          <strong>Origem:</strong> {entry.source.label}
          {entry.url && (
            <>
              {' '}
              (
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                página na fonte
              </a>
              )
            </>
          )}
          . Confira as informações com o fabricante antes de tomá-las como definitivas.
        </Notice>
      </div>
    </Modal>
  );
}
