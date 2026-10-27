import { useMemo } from 'react';
import { App } from './App';
import { MigrationPrompt } from './features/account/MigrationPrompt';
import { AppDataProvider } from './hooks/useAppData';
import { useAuth } from './hooks/useAuth';
import { WeatherProvider } from './hooks/useWeather';
import { AuthPage, NewPasswordPage } from './pages/AuthPage';
import type { DataSource } from './services/storage/repositories';
import { createLocalDataSource } from './services/storage/localDataSource';
import { supabase } from './services/supabase/client';
import { createSupabaseDataSource } from './services/supabase/supabaseDataSource';

let localDataSource: DataSource | undefined;

function AppWithData({ dataSource, cloud }: { dataSource: DataSource; cloud: boolean }) {
  return (
    <AppDataProvider dataSource={dataSource}>
      <WeatherProvider>
        <App />
        {cloud && <MigrationPrompt />}
      </WeatherProvider>
    </AppDataProvider>
  );
}

function CloudApp({ userId }: { userId: string }) {
  const dataSource = useMemo(() => createSupabaseDataSource(supabase!, userId), [userId]);
  return <AppWithData key={userId} dataSource={dataSource} cloud />;
}

/**
 * Login obrigatório quando a nuvem (Supabase) está configurada.
 * Sem configuração (ex.: desenvolvimento), o app roda em modo local.
 */
export function Root() {
  const { status, user, recovering } = useAuth();

  if (status === 'unconfigured') {
    localDataSource ??= createLocalDataSource();
    return <AppWithData dataSource={localDataSource} cloud={false} />;
  }
  if (status === 'loading') return <div className="boot">Parfumania</div>;
  if (status === 'signedOut' || !user) return <AuthPage />;
  if (recovering) return <NewPasswordPage />;
  return <CloudApp userId={user.id} />;
}
