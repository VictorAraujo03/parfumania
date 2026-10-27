import { useRef, useState } from 'react';
import { Database, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/ui';
import { PARFUMO_PRESET, useCatalog } from '../../hooks/useCatalog';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../utils/date';

/** Importação e remoção da base de perfumes usada no autocompletar e em Explorar. */
export function CatalogManagement() {
  const { meta, busy, importFile, importFromUrl, clear } = useCatalog();
  const { notify } = useToast();
  const { settings, updateSettings } = useAppData();
  const isPreset = meta?.label === PARFUMO_PRESET.label;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handle(promise: Promise<{ count: number; withNotes: number }>, preset?: 'parfumo') {
    try {
      const m = await promise;
      // Base pública: os outros aparelhos da conta baixam sozinhos. Arquivo próprio: só aqui.
      if (settings.catalogPreset !== preset) await updateSettings({ catalogPreset: preset });
      notify(`Base importada: ${m.count.toLocaleString('pt-BR')} perfumes (${m.withNotes.toLocaleString('pt-BR')} com notas).`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao importar a base.', 'error');
    }
  }

  return (
    <div className="stack">
      {meta ? (
        <div className="catalog-status">
          <Database size={18} aria-hidden />
          <div>
            <p>
              <strong>{meta.label}</strong> — {meta.count.toLocaleString('pt-BR')} perfumes,{' '}
              {meta.withNotes.toLocaleString('pt-BR')} com pirâmide olfativa
            </p>
            <p className="field__hint">
              Importada em {formatDateTime(new Date(meta.importedAt))}. {meta.sourceNote}
            </p>
          </div>
        </div>
      ) : (
        <p className="muted small">
          Nenhuma base importada. Com uma base, o campo “Nome” do cadastro sugere perfumes e versões (EDT, EDP, Parfum,
          flankers) e preenche marca, ano, perfumistas, acordes e notas automaticamente.
        </p>
      )}

      {isPreset && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.catalogPreset === 'parfumo'}
            onChange={(e) => void updateSettings({ catalogPreset: e.target.checked ? 'parfumo' : undefined })}
          />
          <span>
            Baixar automaticamente nos meus outros aparelhos ao entrar na conta (cerca de 13 MB em cada um)
          </span>
        </label>
      )}

      <div className="button-row">
        <Button icon={Download} variant={meta ? 'secondary' : 'primary'} disabled={busy} onClick={() => setConfirmDownload(true)}>
          {busy ? 'Importando…' : meta ? 'Baixar Parfumo novamente' : 'Baixar base Parfumo (~59 mil perfumes)'}
        </Button>
        <Button icon={Upload} disabled={busy} onClick={() => fileRef.current?.click()}>
          Importar CSV
        </Button>
        {meta && (
          <Button icon={Trash2} variant="ghost" disabled={busy} onClick={() => setConfirmClear(true)}>
            Remover base
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="visually-hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handle(importFile(f));
          }}
        />
      </div>

      <Notice>
        <strong>Formatos aceitos:</strong> CSV com colunas de nome e marca e, opcionalmente, concentração, ano, notas de
        saída/coração/fundo, acordes e perfumistas. Os cabeçalhos são reconhecidos automaticamente — inclusive os do
        conjunto <em>Fragrantica.com Fragrance Dataset</em> do Kaggle (<code>fra_cleaned.csv</code>, que você baixa com
        sua conta) e cabeçalhos em português. As notas mais comuns são traduzidas para o português. A base fica só neste
        navegador e não entra no backup JSON.
      </Notice>

      <ConfirmDialog
        open={confirmDownload}
        title="Baixar a base Parfumo?"
        confirmLabel="Baixar e importar"
        onCancel={() => setConfirmDownload(false)}
        onConfirm={() => {
          setConfirmDownload(false);
          void handle(importFromUrl(PARFUMO_PRESET), 'parfumo');
        }}
      >
        <p>
          Serão baixados cerca de 13 MB do repositório público do TidyTuesday no GitHub. {PARFUMO_PRESET.sourceNote}
        </p>
        <p style={{ marginTop: 8 }}>Uma base importada anteriormente será substituída.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmClear}
        title="Remover a base importada?"
        danger
        confirmLabel="Remover"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clear();
          if (settings.catalogPreset) await updateSettings({ catalogPreset: undefined });
          setConfirmClear(false);
          notify('Base removida. Seus perfumes cadastrados não foram alterados.');
        }}
      >
        As sugestões voltarão a usar apenas o catálogo de demonstração. Os perfumes que você já cadastrou mantêm todos os
        dados.
      </ConfirmDialog>
    </div>
  );
}
