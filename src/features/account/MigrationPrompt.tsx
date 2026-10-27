import { useEffect, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAppData } from '../../hooks/useAppData';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { buildBackup } from '../../services/storage/backup';
import { createLocalDataSource } from '../../services/storage/localDataSource';
import { pluralize } from '../../utils/format';

interface LocalSummary {
  perfumes: number;
  logs: number;
  offers: number;
}

const flagKey = (userId: string) => `parfumania.ui.migrationHandled.${userId}`;

/**
 * Primeiro acesso de uma conta vazia: se este navegador tem uma coleção salva
 * localmente (de antes do login), oferece enviá-la para a conta.
 */
export function MigrationPrompt() {
  const { status, perfumes, usageLogs, offers, importData } = useAppData();
  const { user } = useAuth();
  const { notify } = useToast();
  const [summary, setSummary] = useState<LocalSummary>();
  const [busy, setBusy] = useState(false);

  const cloudIsEmpty = perfumes.every((p) => p.isDemo) && usageLogs.length === 0 && offers.length === 0;

  useEffect(() => {
    if (status !== 'ready' || !user || !cloudIsEmpty) return;
    try {
      if (localStorage.getItem(flagKey(user.id))) return;
    } catch {
      return;
    }
    const local = createLocalDataSource();
    Promise.all([local.perfumes.list(), local.usage.list(), local.offers.list()])
      .then(([p, u, o]) => {
        const own = p.filter((x) => !x.isDemo);
        if (own.length || u.length || o.length) setSummary({ perfumes: own.length, logs: u.length, offers: o.length });
      })
      .catch(() => undefined);
    // Verifica apenas quando a conta termina de carregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  const done = () => {
    try {
      if (user) localStorage.setItem(flagKey(user.id), new Date().toISOString());
    } catch {
      /* sem persistência do aviso */
    }
    setSummary(undefined);
  };

  async function migrate() {
    setBusy(true);
    try {
      const local = createLocalDataSource();
      const [p, u, o, s, images] = await Promise.all([
        local.perfumes.list(),
        local.usage.list(),
        local.offers.list(),
        local.settings.get(),
        local.images.getAll(),
      ]);
      const backup = buildBackup({ perfumes: p, usageLogs: u, offers: o, settings: s }, images);
      const r = await importData(JSON.stringify(backup));
      notify(`Coleção enviada para sua conta: ${pluralize(r.perfumes, 'perfume', 'perfumes')}, ${pluralize(r.usageLogs, 'registro', 'registros')}.`);
      done();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao enviar os dados.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return null;
  const parts = [
    summary.perfumes && pluralize(summary.perfumes, 'perfume', 'perfumes'),
    summary.logs && pluralize(summary.logs, 'registro de uso', 'registros de uso'),
    summary.offers && pluralize(summary.offers, 'oferta', 'ofertas'),
  ].filter(Boolean);

  return (
    <Modal
      open
      onClose={done}
      title="Levar sua coleção para a conta?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={done} disabled={busy}>
            Começar do zero
          </Button>
          <Button variant="primary" icon={CloudUpload} onClick={() => void migrate()} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar para minha conta'}
          </Button>
        </>
      }
    >
      <p className="confirm-text">
        Encontramos {parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0]} salvos
        neste navegador antes do login. Enviando, eles ficam disponíveis em
        qualquer aparelho em que você entrar. Os dados locais continuam guardados aqui como cópia.
      </p>
    </Modal>
  );
}
