import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState icon={Compass} title="Página não encontrada" action={<ButtonLink to="/" variant="primary">Ir para o início</ButtonLink>}>
        O endereço acessado não existe.
      </EmptyState>
    </div>
  );
}
