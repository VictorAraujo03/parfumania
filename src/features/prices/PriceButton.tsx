import { useState } from 'react';
import { Tag } from 'lucide-react';
import { Button } from '../../components/Button';
import { STORE_PRICES_AVAILABLE } from '../../services/prices/storePrices';
import { PriceCompareDialog, type PriceTarget } from './PriceCompareDialog';

/** Botão "Ver preços": consulta as lojas sem sair do app. */
export function PriceButton({
  target,
  label = 'Ver preços',
  size = 'sm',
  variant = 'ghost',
}: {
  target: PriceTarget;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const [open, setOpen] = useState(false);
  if (!STORE_PRICES_AVAILABLE) return null;
  return (
    <>
      <Button size={size} variant={variant} icon={Tag} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <PriceCompareDialog target={open ? target : undefined} onClose={() => setOpen(false)} />
    </>
  );
}
