import { useEffect, useState } from 'react';
import { BellOff, BellRing, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import { ChipMultiSelect } from '../../components/ChipGroup';
import { Card, CardHeader, Notice } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  sendTestPush,
  storedPeriods,
  updatePeriods,
  type PushPeriod,
} from '../../services/notifications/push';

const PERIODS: { value: PushPeriod; label: string }[] = [
  { value: 'morning', label: 'Manhã (7h30–10h30)' },
  { value: 'afternoon', label: 'Tarde (12h–15h)' },
  { value: 'evening', label: 'Noite (18h30–21h30)' },
];

/** Notificações do perfume do dia, em horários sorteados dentro de cada período. */
export function NotificationsCard() {
  const { notify } = useToast();
  const support = pushSupport();
  const [active, setActive] = useState<boolean>();
  const [periods, setPeriods] = useState<PushPeriod[]>(['morning', 'evening']);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (support !== 'ok') return;
    let alive = true;
    (async () => {
      const sub = await currentSubscription().catch(() => null);
      if (!alive) return;
      setActive(!!sub);
      if (sub) {
        const saved = await storedPeriods().catch(() => undefined);
        if (alive && saved?.length) setPeriods(saved);
      }
    })();
    return () => {
      alive = false;
    };
  }, [support]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (support === 'ios-browser') {
    body = (
      <Notice icon={BellRing}>
        No iPhone, as notificações funcionam no app da tela de início. Abra o Parfumania pelo ícone (Safari → Compartilhar →
        “Adicionar à Tela de Início”) e ative por lá.
      </Notice>
    );
  } else if (support === 'no-cloud') {
    body = <p className="muted small">As notificações precisam do login na nuvem (o servidor é quem envia nos horários).</p>;
  } else if (support === 'no-key') {
    body = <p className="muted small">As notificações ainda não foram configuradas neste app (falta a chave VITE_VAPID_PUBLIC_KEY).</p>;
  } else if (support === 'unsupported') {
    body = <p className="muted small">Este navegador não oferece notificações.</p>;
  } else {
    body = (
      <div className="stack">
        <p className="small muted">
          Em horários sorteados dentro de cada período, você recebe uma sugestão da sua coleção de acordo com o clima — por
          exemplo: “Nossa, que calorzão! Que tal usar o Acqua di Giò hoje?”. Tocar na notificação abre o perfume.
        </p>
        <div>
          <p className="moment-ask__label">Quando avisar</p>
          <ChipMultiSelect
            options={PERIODS}
            value={periods}
            ariaLabel="Períodos das notificações"
            onChange={(v) => {
              setPeriods(v);
              if (active && v.length) void run(() => updatePeriods(v).then(() => notify('Períodos salvos.')));
            }}
          />
        </div>
        <div className="notifications__actions">
          {active ? (
            <>
              <Button
                variant="secondary"
                icon={Send}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const preview = await sendTestPush();
                    notify(preview ? `Enviada: “${preview.body}”` : 'Notificação de teste enviada.');
                  })
                }
              >
                Enviar um teste
              </Button>
              <Button
                variant="ghost"
                icon={BellOff}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await disablePush();
                    setActive(false);
                    notify('Notificações desativadas neste aparelho.');
                  })
                }
              >
                Desativar
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              icon={BellRing}
              disabled={busy || periods.length === 0}
              onClick={() =>
                run(async () => {
                  await enablePush(periods);
                  setActive(true);
                  notify('Notificações ativadas neste aparelho.');
                })
              }
            >
              {busy ? 'Ativando…' : 'Ativar notificações neste aparelho'}
            </Button>
          )}
        </div>
        {active && <p className="note-sheet__hint">Ativas neste aparelho. Cada aparelho (iPhone, computador) ativa separadamente.</p>}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="Notificações" subtitle="O perfume do dia, no seu celular." />
      {body}
    </Card>
  );
}
