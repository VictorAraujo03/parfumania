import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconOnly?: boolean;
  children?: ReactNode;
}

const classes = (variant: Variant, size: Size, iconOnly?: boolean, extra?: string) =>
  ['btn', `btn--${variant}`, `btn--${size}`, iconOnly && 'btn--icon', extra].filter(Boolean).join(' ');

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconOnly,
  children,
  className,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes(variant, size, iconOnly, className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconOnly,
  children,
  className,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={classes(variant, size, iconOnly, className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden />}
      {children}
    </Link>
  );
}
