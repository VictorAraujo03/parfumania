import { useMemo, useState } from 'react';
import { ClipboardPaste, ExternalLink } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { hasNotes, parsePastedNotes, type PastedNotes } from './pasteNotes';

/**
 * Cole a pirâmide ou a descrição copiada de uma página de perfume (ex.:
 * Fragrantica) e o app separa em saída, coração, fundo e acordes.
 */
export function PasteNotesDialog({
  open,
  name,
  brand,
  onClose,
  onApply,
}: {
  open: boolean;
  name: string;
  brand: string;
  onClose(): void;
  onApply(p: PastedNotes): void;
}) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parsePastedNotes(text), [text]);
  const search = `${brand} ${name}`.trim();

  const rows: [string, string[]][] = [
    ['Saída', parsed.top],
    ['Coração', parsed.heart],
    ['Fundo', parsed.base],
    ['Acordes', parsed.accords],
  ];

  return (
    <Modal
      open={open}
      title="Colar notas"
      subtitle="Da Fragrantica, do Parfumo ou do site da marca"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={ClipboardPaste}
            disabled={!hasNotes(parsed)}
            onClick={() => {
              onApply(parsed);
              setText('');
              onClose();
            }}
          >
            Preencher
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted">
          Abra a página do perfume, selecione a <strong>pirâmide de notas</strong> (ou a frase “Top notes are…” da
          descrição), copie e cole abaixo. Só o texto que você colar é lido — o app não acessa o site.
          {search.length > 2 && (
            <>
              {' '}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`${search} fragrantica`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Procurar “{search}” <ExternalLink size={11} aria-hidden />
              </a>
            </>
          )}
        </p>
        <textarea
          className="input paste-notes__input"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Top Notes\nBergamot\nPepper\nMiddle Notes\nLavender\nBase Notes\nAmbroxan\nCedar'}
          aria-label="Texto copiado com as notas"
        />
        {text.trim() && (
          <dl className="paste-notes__preview">
            {hasNotes(parsed) ? (
              rows.map(([label, list]) =>
                list.length ? (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{list.join(', ')}</dd>
                  </div>
                ) : null,
              )
            ) : (
              <p className="muted small">Não reconhecemos notas nesse texto. Copie a pirâmide (com “Top Notes”, “Middle Notes”, “Base Notes”) ou a frase da descrição.</p>
            )}
          </dl>
        )}
        {hasNotes(parsed) && <p className="note-sheet__hint">“Preencher” substitui as notas e os acordes atuais do formulário.</p>}
      </div>
    </Modal>
  );
}
