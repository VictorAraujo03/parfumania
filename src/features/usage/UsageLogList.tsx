import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RatingDisplay } from '../../components/ScaleInput';
import { Badge } from '../../components/ui';
import { ENVIRONMENTS, OCCASIONS, labelOf } from '../../data/options';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import type { UsageLog } from '../../types';
import { formatDateTime } from '../../utils/date';
import { describeSnapshot } from '../weather/describe';
import { UsageDialog } from './UsageDialog';

interface UsageLogListProps {
  logs: UsageLog[];
  showPerfume?: boolean;
  limit?: number;
}

export function UsageLogList({ logs, showPerfume = true, limit }: UsageLogListProps) {
  const { perfumes, deleteUsage, settings } = useAppData();
  const { notify } = useToast();
  const [editing, setEditing] = useState<UsageLog>();
  const [deleting, setDeleting] = useState<UsageLog>();
  const [expanded, setExpanded] = useState(false);

  const sorted = [...logs].sort((a, b) => b.usedAt.localeCompare(a.usedAt));
  const visible = limit && !expanded ? sorted.slice(0, limit) : sorted;
  const byId = new Map(perfumes.map((p) => [p.id, p]));

  return (
    <>
      <ul className="log-list">
        {visible.map((l) => {
          const p = byId.get(l.perfumeId);
          return (
            <li key={l.id} className="log-item">
              <div className="log-item__main">
                {showPerfume && (
                  <p className="log-item__title">
                    {p ? <Link to={`/colecao/${p.id}`}>{p.name}</Link> : 'Perfume removido'}
                    {p && <span className="muted"> · {p.brand}</span>}
                  </p>
                )}
                <p className="log-item__date">{formatDateTime(new Date(l.usedAt))}</p>
                <div className="log-item__tags">
                  {l.occasion && <Badge>{labelOf(OCCASIONS, l.occasion)}</Badge>}
                  {l.environment && <Badge>{labelOf(ENVIRONMENTS, l.environment)}</Badge>}
                  <RatingDisplay value={l.rating} size={12} />
                </div>
                {l.weather && (
                  <p className="log-item__weather">
                    <CloudSun size={13} aria-hidden /> {describeSnapshot(l.weather, settings.temperatureUnit)}
                  </p>
                )}
                {l.notes && <p className="log-item__notes">{l.notes}</p>}
              </div>
              <div className="log-item__actions">
                <Button variant="ghost" size="sm" iconOnly icon={Pencil} aria-label="Editar registro" onClick={() => setEditing(l)} />
                <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label="Excluir registro" onClick={() => setDeleting(l)} />
              </div>
            </li>
          );
        })}
      </ul>
      {limit && sorted.length > limit && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Mostrar menos' : `Ver todos (${sorted.length})`}
        </Button>
      )}

      <UsageDialog open={!!editing} log={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        title="Excluir registro?"
        danger
        confirmLabel="Excluir"
        onCancel={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteUsage(deleting.id);
          setDeleting(undefined);
          notify('Registro excluído.');
        }}
      >
        Este registro de uso será removido e as estatísticas serão recalculadas.
      </ConfirmDialog>
    </>
  );
}
