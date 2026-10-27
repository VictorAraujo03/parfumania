import { useRef, useState } from 'react';
import { Download, FlaskConical, Trash2, Upload } from 'lucide-react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { downloadJson } from '../../services/storage/backup';
import { toDateKey } from '../../utils/date';
import { pluralize } from '../../utils/format';

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export function DataManagement() {
  const { perfumes, usageLogs, offers, exportData, importData, removeDemoData, loadDemoData, resetAll, dataSource } = useAppData();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const demoCount = perfumes.filter((p) => p.isDemo).length;

  async function doExport() {
    const backup = await exportData();
    downloadJson(`parfumania-backup-${toDateKey(new Date())}.json`, backup);
    notify('Backup exportado.');
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    if (file.size > MAX_BACKUP_BYTES) {
      notify('Arquivo grande demais para um backup do Parfumania.', 'error');
      return;
    }
    setPendingImport(await file.text());
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setBusy(true);
    try {
      const r = await importData(pendingImport);
      notify(
        `Backup restaurado: ${pluralize(r.perfumes, 'perfume', 'perfumes')}, ${pluralize(r.usageLogs, 'registro', 'registros')}, ${pluralize(r.offers, 'oferta', 'ofertas')}.`,
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao importar.', 'error');
    } finally {
      setBusy(false);
      setPendingImport(undefined);
    }
  }

  return (
    <div className="stack">
      <p className="muted small">
        Atualmente: {pluralize(perfumes.length, 'perfume', 'perfumes')}, {pluralize(usageLogs.length, 'registro de uso', 'registros de uso')} e{' '}
        {pluralize(offers.length, 'oferta', 'ofertas')}
        {dataSource.remote
          ? ', salvos na sua conta. Exporte backups de vez em quando por segurança.'
          : ', salvos apenas neste navegador. Limpar os dados do navegador apaga tudo — exporte backups com frequência.'}
      </p>
      <div className="button-row">
        <Button icon={Download} onClick={() => void doExport()}>
          Exportar JSON
        </Button>
        <Button icon={Upload} onClick={() => fileRef.current?.click()}>
          Importar JSON
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => void readFile(e.target.files?.[0])} />
      </div>
      <div className="button-row">
        {demoCount > 0 ? (
          <Button
            variant="ghost"
            icon={FlaskConical}
            onClick={async () => notify(`${pluralize(await removeDemoData(), 'exemplo removido', 'exemplos removidos')}.`)}
          >
            Remover {pluralize(demoCount, 'exemplo', 'exemplos')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            icon={FlaskConical}
            onClick={async () => notify(`${pluralize(await loadDemoData(), 'exemplo carregado', 'exemplos carregados')}.`)}
          >
            Carregar exemplos de demonstração
          </Button>
        )}
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmReset(true)}>
          Apagar todos os dados
        </Button>
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        title="Restaurar backup?"
        confirmLabel="Substituir dados"
        danger
        busy={busy}
        onCancel={() => setPendingImport(undefined)}
        onConfirm={() => void confirmImport()}
      >
        Os dados atuais (perfumes, registros, ofertas, imagens e configurações) serão <strong>substituídos</strong> pelo
        conteúdo do arquivo. Considere exportar um backup antes.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmReset}
        title="Apagar todos os dados?"
        confirmLabel="Apagar tudo"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          await resetAll();
          setConfirmReset(false);
          notify('Todos os dados foram apagados.');
        }}
      >
        Perfumes, registros de uso, ofertas, imagens e configurações serão excluídos permanentemente
        {dataSource.remote ? ' da sua conta, em todos os aparelhos' : ' deste navegador'}.
      </ConfirmDialog>
    </div>
  );
}
