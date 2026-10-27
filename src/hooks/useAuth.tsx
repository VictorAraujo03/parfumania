import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { appRedirectUrl, supabase } from '../services/supabase/client';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: AuthStatus;
  user?: User;
  /** true após abrir o link de "esqueci minha senha": pede a nova senha. */
  recovering: boolean;
  signIn(email: string, password: string): Promise<void>;
  /** Retorna true se a conta precisa ser confirmada por e-mail. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Mensagens do Supabase Auth em português. */
export function authErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).';
  if (/user already registered/i.test(msg)) return 'Já existe uma conta com este e-mail. Use "Entrar".';
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.';
  if (/same password|different from the old/i.test(msg)) return 'A nova senha precisa ser diferente da atual.';
  if (/invalid email|unable to validate email/i.test(msg)) return 'Informe um e-mail válido.';
  if (/failed to fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.';
  return msg || 'Algo deu errado. Tente novamente.';
}

/** Remove do endereço os tokens deixados pelos links de e-mail (o app usa rotas com #). */
function cleanAuthHash() {
  if (/access_token=|error_description=|type=recovery|type=signup/.test(window.location.hash)) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const isRecoveryLink = /type=recovery/.test(window.location.hash);
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (isRecoveryLink && d.session) setRecovering(true);
      setSession(d.session);
      setStatus(d.session ? 'signedIn' : 'signedOut');
      cleanAuthHash();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const client = () => {
      if (!supabase) throw new Error('A nuvem não está configurada.');
      return supabase;
    };
    return {
      status,
      user: session?.user,
      recovering,
      async signIn(email, password) {
        const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(authErrorMessage(error));
      },
      async signUp(email, password) {
        const { data, error } = await client().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: appRedirectUrl() },
        });
        if (error) throw new Error(authErrorMessage(error));
        return { needsConfirmation: !data.session };
      },
      async sendPasswordReset(email) {
        const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: appRedirectUrl() });
        if (error) throw new Error(authErrorMessage(error));
      },
      async updatePassword(password) {
        const { error } = await client().auth.updateUser({ password });
        if (error) throw new Error(authErrorMessage(error));
        setRecovering(false);
      },
      async signOut() {
        await client().auth.signOut();
        setRecovering(false);
      },
    };
  }, [status, session, recovering]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return ctx;
}
