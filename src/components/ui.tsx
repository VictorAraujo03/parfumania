import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gold' | 'demo' | 'success' | 'warning' | 'danger';
  title?: string;
}) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function DemoBadge({ label = 'Demo' }: { label?: string }) {
  return (
    <Badge tone="demo" title="Dado de demonstração — pode ser editado ou removido">
      {label}
    </Badge>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
      <div className="empty-state__icon">
        <Icon size={compact ? 22 : 28} strokeWidth={1.4} aria-hidden />
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {children && <div className="empty-state__text">{children}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card__header">
      <div>
        <h2 className="card__title">{title}</h2>
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  to,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  /** Torna o bloco clicável, levando à lista correspondente. */
  to?: string;
}) {
  const body = (
    <>
      <div className="stat-tile__label">
        {Icon && <Icon size={15} aria-hidden />}
        {label}
        {to && <ChevronRight size={15} className="stat-tile__go" aria-hidden />}
      </div>
      <div className="stat-tile__value">{value}</div>
      {detail && <div className="stat-tile__detail">{detail}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="stat-tile stat-tile--link">
      {body}
    </Link>
  ) : (
    <div className="stat-tile">{body}</div>
  );
}

export function ScoreRing({ score, size = 64, muted }: { score: number; size?: number; muted?: boolean }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className={`score-ring ${muted ? 'score-ring--muted' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="score-ring__track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="score-ring__value"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-ring__label" aria-label={`Compatibilidade ${score} de 100`}>
        {score}
      </span>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange(v: NoInfer<T>): void;
  ariaLabel: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`tabs__tab ${value === t.value ? 'is-active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({
  icon: Icon,
  tone = 'info',
  children,
  action,
}: {
  icon?: LucideIcon;
  tone?: 'info' | 'demo' | 'warning';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`notice notice--${tone}`}>
      {Icon && <Icon size={18} aria-hidden className="notice__icon" />}
      <div className="notice__text">{children}</div>
      {action && <div className="notice__action">{action}</div>}
    </div>
  );
}
