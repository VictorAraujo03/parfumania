import { useState } from 'react';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { Button } from '../../components/Button';
import { TextField } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { CloudSetupNotice } from '../../pages/AuthPage';

export function AccountCard() {
  const { status, user, signOut, updatePassword } = useAuth();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (status === 'unconfigured') return <CloudSetupNotice />;

  async function save() {
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setBusy(true);
    try {
      await updatePassword(password);
      notify('Senha alterada.');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="account-row">
        <span className="account-row__avatar" aria-hidden>
          <UserRound size={18} />
        </span>
        <div>
          <p className="account-row__email">{user?.email}</p>
          <p className="field__hint">Dados sincronizados na nuvem e disponíveis em qualquer aparelho em que você entrar.</p>
        </div>
      </div>
      <div className="button-row">
        <Button
          icon={KeyRound}
          onClick={() => {
            setPassword('');
            setConfirm('');
            setError(undefined);
            setOpen(true);
          }}
        >
          Alterar senha
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Alterar senha"
        size="sm"
        footer={
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        }
      >
        <div className="stack">
          <TextField label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <TextField label="Confirme a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="field__error">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
