import { useEffect, useState } from 'react';
import { Copy, KeyRound, LayoutGrid, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card, CardHeader } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/date';
import { WIDGET_AVAILABLE, createWidgetScript, hasWidgetToken, revokeWidgetToken } from '../../services/widget/widgetToken';

/** Widget do iPhone pelo app Scriptable: gera o script com a chave pessoal. */
export function WidgetCard() {
  const { notify } = useToast();
  const [status, setStatus] = useState<{ active: boolean; lastUsedAt?: string }>();
  const [script, setScript] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!WIDGET_AVAILABLE) return;
    hasWidgetToken().then(setStatus).catch(() => setStatus({ active: false }));
  }, []);

  if (!WIDGET_AVAILABLE) return null;

  async function generate() {
    setBusy(true);
    const pending = createWidgetScript();
    // O Safari só permite copiar dentro do próprio toque: registramos a cópia já
    // agora, com o texto "prometido", e ela se completa quando o script fica pronto.
    const copied =
      typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write
        ? navigator.clipboard
            .write([new ClipboardItem({ 'text/plain': pending.then((s) => new Blob([s], { type: 'text/plain' })) })])
            .then(() => true, () => false)
        : Promise.resolve(false);
    try {
      const s = await pending;
      setScript(s);
      setStatus({ active: true });
      if (await copied) notify('Script copiado. Cole no Scriptable.');
      else await copy(s);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      notify('Script copiado. Cole no Scriptable.');
    } catch {
      notify('Não deu para copiar sozinho: selecione o texto abaixo e copie.', 'info');
    }
  }

  return (
    <Card>
      <CardHeader title="Widget do iPhone" subtitle="Perfume do dia, clima e alternativas na tela de início — pelo app Scriptable (grátis)." />
      <div className="stack">
        <ol className="widget-steps">
          <li>
            Instale o <strong>Scriptable</strong> na App Store.
          </li>
          <li>
            Toque em <strong>{status?.active ? 'Gerar novo script' : 'Gerar e copiar script'}</strong> abaixo.
          </li>
          <li>
            No Scriptable, toque em <strong>+</strong>, cole o script e dê o nome <strong>Parfumania</strong>.
          </li>
          <li>
            Na tela de início, segure um espaço vazio → <strong>Editar</strong> → <strong>Adicionar widget</strong> →
            Scriptable → escolha o tamanho (pequeno, médio ou grande) → toque no widget e em <strong>Script</strong>{' '}
            escolha Parfumania. Também dá para pôr na tela bloqueada.
          </li>
        </ol>
        <div className="notifications__actions">
          <Button variant="primary" icon={status?.active ? KeyRound : LayoutGrid} onClick={generate} disabled={busy}>
            {busy ? 'Gerando…' : status?.active ? 'Gerar novo script' : 'Gerar e copiar script'}
          </Button>
          {script && (
            <Button variant="secondary" icon={Copy} onClick={() => copy(script)}>
              Copiar script
            </Button>
          )}
          {status?.active && (
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={async () => {
                await revokeWidgetToken();
                setStatus({ active: false });
                setScript(undefined);
                notify('Chave do widget revogada. O widget para de atualizar.');
              }}
            >
              Revogar chave
            </Button>
          )}
        </div>
        {script && <textarea className="input paste-notes__input" rows={5} readOnly value={script} aria-label="Script do widget" onFocus={(e) => e.target.select()} />}
        <p className="note-sheet__hint">
          O script leva uma chave pessoal que só serve para ler o perfume do dia — não compartilhe. Gerar um novo script
          revoga o anterior.
          {status?.active && status.lastUsedAt ? ` Última atualização do widget: ${formatDateTime(new Date(status.lastUsedAt))}.` : ''}
        </p>
      </div>
    </Card>
  );
}
