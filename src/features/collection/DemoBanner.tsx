import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Notice } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { pluralize } from '../../utils/format';

/** Aviso sobre perfumes de demonstração, com remoção em um clique. */
export function DemoBanner() {
  const { perfumes, settings, updateSettings, removeDemoData } = useAppData();
  const { notify } = useToast();
  const [confirm, setConfirm] = useState(false);
  const demoCount = perfumes.filter((p) => p.isDemo).length;
  if (demoCount === 0 || settings.demoBannerDismissed) return null;

  return (
    <>
      <Notice
        tone="demo"
        icon={FlaskConical}
        action={
          <div className="notice__buttons">
            <Button size="sm" variant="ghost" onClick={() => void updateSettings({ demoBannerDismissed: true })}>
              Manter
            </Button>
            <Button size="sm" onClick={() => setConfirm(true)}>
              Remover exemplos
            </Button>
          </div>
        }
      >
        Você está vendo {pluralize(demoCount, 'perfume de demonstração', 'perfumes de demonstração')} (selo{' '}
        <strong>Demo</strong>). Edite-os ou remova-os quando quiser começar sua coleção real.
      </Notice>
      <ConfirmDialog
        open={confirm}
        title="Remover exemplos?"
        danger
        confirmLabel="Remover"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const n = await removeDemoData();
          setConfirm(false);
          notify(`${pluralize(n, 'exemplo removido', 'exemplos removidos')}.`);
        }}
      >
        Os perfumes marcados como demonstração e seus registros de uso serão excluídos. Perfumes que você editou já
        são considerados seus e serão mantidos.
      </ConfirmDialog>
    </>
  );
}
