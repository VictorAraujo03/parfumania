import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, MoreHorizontal, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { NAV_ITEMS } from './navItems';

function Logo() {
  return (
    <NavLink to="/" className="logo" aria-label="Parfumania — início">
      <span className="logo__mark" aria-hidden>
        <svg viewBox="0 0 32 32" width="26" height="26">
          <rect x="13" y="3" width="6" height="5" rx="1" fill="currentColor" />
          <rect x="11.5" y="8" width="9" height="2.4" rx="0.8" fill="currentColor" opacity="0.6" />
          <rect x="7" y="10.5" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 22c3-2 7-2 10 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </svg>
      </span>
      <span className="logo__text">Parfumania</span>
    </NavLink>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'is-active' : ''}`;

export function AppLayout() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const secondary = NAV_ITEMS.filter((i) => !i.primaryMobile);
  const secondaryActive = secondary.some((i) => location.pathname.startsWith(i.to));

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>

      <aside className="sidebar" aria-label="Navegação principal">
        <Logo />
        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass} title={label}>
              <Icon size={19} strokeWidth={1.6} aria-hidden />
              <span className="nav-link__label">{label}</span>
              {badge && <span className="nav-link__badge">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <NavLink to="/colecao/novo" className="btn btn--primary btn--md sidebar__cta">
            <Plus size={17} aria-hidden />
            <span className="nav-link__label">Adicionar perfume</span>
          </NavLink>
          {user ? (
            <div className="sidebar__user">
              <span className="sidebar__email" title={user.email}>
                {user.email}
              </span>
              <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={() => void signOut()} aria-label="Sair" title="Sair">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <p className="sidebar__note">Dados salvos apenas neste navegador.</p>
          )}
        </div>
      </aside>

      <header className="topbar">
        <Logo />
        <NavLink to="/colecao/novo" className="btn btn--primary btn--sm btn--icon" aria-label="Adicionar perfume">
          <Plus size={18} />
        </NavLink>
      </header>

      <main id="main" className="main">
        <div className="main__inner">
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {NAV_ITEMS.filter((i) => i.primaryMobile).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}>
            <Icon size={21} strokeWidth={1.6} aria-hidden />
            <span>{label.replace('Minha ', '')}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav__item ${secondaryActive ? 'is-active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <MoreHorizontal size={21} strokeWidth={1.6} aria-hidden />
          <span>Mais</span>
        </button>
      </nav>

      <Modal open={moreOpen} title="Mais opções" onClose={() => setMoreOpen(false)} size="sm">
        <div className="more-menu">
          {secondary.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={19} strokeWidth={1.6} aria-hidden />
              <span className="nav-link__label">{label}</span>
              {badge && <span className="nav-link__badge">{badge}</span>}
            </NavLink>
          ))}
          {user && (
            <button type="button" className="nav-link" onClick={() => void signOut()}>
              <LogOut size={19} strokeWidth={1.6} aria-hidden />
              <span className="nav-link__label">Sair ({user.email})</span>
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
