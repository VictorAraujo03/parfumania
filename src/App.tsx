import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from './components/ui';
import { useAppData } from './hooks/useAppData';
import { AppLayout } from './layouts/AppLayout';
import { CollectionPage } from './pages/CollectionPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PerfumeDetailPage } from './pages/PerfumeDetailPage';
import { PerfumeFormPage } from './pages/PerfumeFormPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { SettingsPage } from './pages/SettingsPage';
import type { ThemePreference } from './types';

// Páginas mais pesadas (gráficos) são carregadas sob demanda.
const StatisticsPage = lazy(() => import('./pages/StatisticsPage').then((m) => ({ default: m.StatisticsPage })));
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const PricesPage = lazy(() => import('./pages/PricesPage').then((m) => ({ default: m.PricesPage })));

function useTheme(theme: ThemePreference) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      root.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f6f3ee' : '#0d0c0b');
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

const PageFallback = () => <div className="page-loading" aria-busy="true" />;

export function App() {
  const { status, error, settings } = useAppData();
  useTheme(settings.theme);

  if (status === 'loading') return <div className="boot">Parfumania</div>;
  if (status === 'error') {
    return (
      <div className="boot">
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar seus dados">
          {error}
        </EmptyState>
      </div>
    );
  }

  // HashRouter funciona em qualquer hospedagem estática (Vercel, GitHub Pages) sem regras de rewrite.
  return (
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="colecao" element={<CollectionPage />} />
            <Route path="colecao/novo" element={<PerfumeFormPage />} />
            <Route path="colecao/:id" element={<PerfumeDetailPage />} />
            <Route path="colecao/:id/editar" element={<PerfumeFormPage />} />
            <Route path="recomendacoes" element={<RecommendationsPage />} />
            <Route path="estatisticas" element={<StatisticsPage />} />
            <Route path="explorar" element={<ExplorePage />} />
            <Route path="precos" element={<PricesPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
