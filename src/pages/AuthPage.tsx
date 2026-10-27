import { useState, type FormEvent } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { TextField } from '../components/fields';
import { Notice } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

type Mode = 'signin' | 'signup' | 'reset';

const MIN_PASSWORD = 8;

function BrandMark() {
  return (
    <div className="auth__brand">
      <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden>
        <rect x="13" y="3" width="6" height="5" rx="1" fill="currentColor" />
        <rect x="11.5" y="8" width="9" height="2.4" rx="0.8" fill="currentColor" opacity="0.6" />
        <rect x="7" y="10.5" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 22c3-2 7-2 10 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>
      <span>Parfumania</span>
    </div>
  );
}

export function AuthPage() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string>();
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(undefined);
    setSent(undefined);
    setPassword('');
    setConfirm('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD) {
        setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
        return;
      }
      if (password !== confirm) {
        setError('As senhas não coincidem.');
        return;
      }
    }
    if (mode === 'signin' && !password) {
      setError('Informe sua senha.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) setSent(`Enviamos um link de confirmação para ${email.trim()}. Abra-o para ativar sua conta e depois entre aqui.`);
      } else {
        await sendPasswordReset(email);
        setSent(`Se existir uma conta para ${email.trim()}, você receberá um link para criar uma nova senha.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ['Bem-vindo de volta', 'Entre para acessar sua coleção em qualquer aparelho.'],
    signup: ['Crie sua conta', 'Sua coleção, registros e preferências ficam salvos na nuvem.'],
    reset: ['Recuperar senha', 'Enviaremos um link para você criar uma nova senha.'],
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <BrandMark />
        {sent ? (
          <div className="stack">
            <div className="auth__sent-icon">
              <MailCheck size={26} strokeWidth={1.5} aria-hidden />
            </div>
            <h1 className="auth__title">Confira seu e-mail</h1>
            <p className="auth__subtitle">{sent}</p>
            <p className="field__hint">Não chegou? Verifique o spam ou tente de novo em alguns minutos.</p>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => switchMode('signin')}>
              Voltar para entrar
            </Button>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <div>
              <h1 className="auth__title">{titles[mode][0]}</h1>
              <p className="auth__subtitle">{titles[mode][1]}</p>
            </div>
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            {mode !== 'reset' && (
              <TextField
                label="Senha"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                hint={mode === 'signup' ? `Mínimo de ${MIN_PASSWORD} caracteres.` : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {mode === 'signup' && (
              <TextField
                label="Confirme a senha"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            )}
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
            </Button>
            <div className="auth__links">
              {mode === 'signin' && (
                <>
                  <button type="button" onClick={() => switchMode('reset')}>
                    Esqueci minha senha
                  </button>
                  <span>
                    Novo por aqui?{' '}
                    <button type="button" onClick={() => switchMode('signup')}>
                      Criar conta
                    </button>
                  </span>
                </>
              )}
              {mode !== 'signin' && (
                <button type="button" onClick={() => switchMode('signin')}>
                  <ArrowLeft size={14} aria-hidden /> Já tenho conta
                </button>
              )}
            </div>
          </form>
        )}
      </div>
      <p className="auth__footer">Seus dados são privados: só você tem acesso à sua coleção.</p>
    </div>
  );
}

export function NewPasswordPage() {
  const { updatePassword, signOut, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return setError('As senhas não coincidem.');
    setBusy(true);
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__panel stack" onSubmit={submit} noValidate>
        <BrandMark />
        <div>
          <h1 className="auth__title">Nova senha</h1>
          <p className="auth__subtitle">Defina uma nova senha para {user?.email}.</p>
        </div>
        <TextField label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <TextField label="Confirme a nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
        <button type="button" className="auth__plain" onClick={() => void signOut()}>
          Cancelar e sair
        </button>
      </form>
    </div>
  );
}

/** Mostrado quando o login é obrigatório mas o Supabase não foi configurado no build. */
export function CloudSetupNotice() {
  return (
    <Notice tone="warning">
      <strong>Modo local:</strong> a nuvem não está configurada (variáveis <code>VITE_SUPABASE_URL</code> e{' '}
      <code>VITE_SUPABASE_ANON_KEY</code>). Os dados ficam só neste navegador. Veja o README para ativar o login.
    </Notice>
  );
}
