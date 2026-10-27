import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth';
import { CatalogProvider } from './hooks/useCatalog';
import { ToastProvider } from './hooks/useToast';
import { Root } from './Root';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

// A fonte de dados (local ou Supabase) é escolhida em Root.tsx conforme o login.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <CatalogProvider>
          <Root />
        </CatalogProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
