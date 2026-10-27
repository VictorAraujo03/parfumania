import { BarChart3, Compass, Home, Library, Settings, Sparkles, Tag, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exibido diretamente na barra inferior do celular. */
  primaryMobile?: boolean;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, primaryMobile: true },
  { to: '/colecao', label: 'Minha coleção', icon: Library, primaryMobile: true },
  { to: '/recomendacoes', label: 'Recomendações', icon: Sparkles, primaryMobile: true },
  { to: '/estatisticas', label: 'Estatísticas', icon: BarChart3, primaryMobile: true },
  { to: '/explorar', label: 'Explorar perfumes', icon: Compass },
  { to: '/precos', label: 'Preços', icon: Tag, badge: 'Manual' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];
