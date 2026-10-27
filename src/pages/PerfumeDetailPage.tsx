import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Droplet, Heart, Pencil, SearchX, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PerfumeImage } from '../components/PerfumeImage';
import { RatingDisplay } from '../components/ScaleInput';
import { Badge, Card, CardHeader, DemoBadge, EmptyState } from '../components/ui';
import {
  CLIMATES,
  CONCENTRATIONS,
  FAMILIES,
  OCCASIONS,
  PERIODS,
  SCALE_LABELS,
  STATUSES,
  labelOf,
} from '../data/options';
import { NotesPyramid } from '../features/collection/NotesPyramid';
import { UsageDialog } from '../features/usage/UsageDialog';
import { UsageLogList } from '../features/usage/UsageLogList';
import { useAppData, usePerfume } from '../hooks/useAppData';
import { useCatalog } from '../hooks/useCatalog';
import { useToast } from '../hooks/useToast';
import type { Scale } from '../types';
import { formatDate, formatDateTime, parseDateKey } from '../utils/date';
import { formatCurrency, pluralize } from '../utils/format';

function ScaleView({ label, value, labels }: { label: string; value?: Scale; labels: readonly string[] }) {
  return (
    <div className="scale-view">
      <span className="scale-view__label">{label}</span>
      {value ? (
        <>
          <span className="scale-view__dots" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= value ? 'is-on' : ''} />
            ))}
          </span>
          <span className="scale-view__text">{labels[value - 1]}</span>
        </>
      ) : (
        <span className="muted">Não informado</span>
      )}
    </div>
  );
}

function ChipList<T extends string>({ values, options }: { values: T[]; options: { value: T; label: string }[] }) {
  if (values.length === 0) return <span className="muted">Não informado</span>;
  return (
    <div className="chip-group chip-group--static">
      {values.map((v) => (
        <span key={v} className="chip chip--static">
          {labelOf(options, v)}
        </span>
      ))}
    </div>
  );
}

export function PerfumeDetailPage() {
  const { id } = useParams();
  const perfume = usePerfume(id);
  const { usageLogs, deletePerfume, toggleFavorite } = useAppData();
  const { getById } = useCatalog();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const logs = useMemo(() => usageLogs.filter((l) => l.perfumeId === id), [usageLogs, id]);

  if (!perfume) {
    return (
      <div className="page">
        <EmptyState icon={SearchX} title="Perfume não encontrado" action={<ButtonLink to="/colecao">Voltar à coleção</ButtonLink>}>
          Ele pode ter sido excluído.
        </EmptyState>
      </div>
    );
  }

  const p = perfume;
  const concentration =
    p.concentration === 'other' ? p.concentrationOther || 'Outra' : labelOf(CONCENTRATIONS, p.concentration);
  const lastUse = logs.reduce<string | undefined>((m, l) => (!m || l.usedAt > m ? l.usedAt : m), undefined);
  const remainingPct = p.volumeMl && p.remainingMl !== undefined ? Math.min(100, (p.remainingMl / p.volumeMl) * 100) : undefined;
  const catalogSource = getById(p.catalogId)?.source;
  const sourceLabel =
    p.dataSource === 'manual'
      ? 'Cadastro manual'
      : catalogSource?.kind === 'import'
        ? `Dados da base ${catalogSource.label} (comunitários, não verificados)`
        : p.catalogId?.startsWith('imp-')
          ? 'Dados de uma base importada (comunitários, não verificados)'
          : 'Notas do catálogo de demonstração (referência resumida, não verificada)';

  return (
    <div className="page">
      <Link to="/colecao" className="back-link">
        <ArrowLeft size={16} aria-hidden /> Coleção
      </Link>

      <section className="detail-hero">
        <PerfumeImage imageId={p.imageId} name={p.name} brand={p.brand} family={p.family} className="detail-hero__image" />
        <div className="detail-hero__info">
          <p className="eyebrow">{p.brand || 'Marca não informada'}</p>
          <h1 className="page-title">{p.name}</h1>
          <div className="detail-hero__badges">
            {concentration && <Badge>{concentration}</Badge>}
            {p.year && <Badge>{p.year}</Badge>}
            {p.family && <Badge>{labelOf(FAMILIES, p.family)}</Badge>}
            <Badge tone={p.status === 'owned' ? 'gold' : 'neutral'}>{labelOf(STATUSES, p.status)}</Badge>
            {p.isDemo && <DemoBadge label="Demonstração" />}
          </div>
          <RatingDisplay value={p.rating} size={16} />
          <p className="detail-hero__usage">
            {pluralize(logs.length, 'utilização registrada', 'utilizações registradas')}
            {lastUse && ` · última em ${formatDateTime(new Date(lastUse))}`}
          </p>
          <div className="detail-hero__actions">
            <Button variant="primary" icon={Droplet} onClick={() => setRegisterOpen(true)} disabled={p.status !== 'owned' && p.status !== 'decant'}>
              Registrar uso
            </Button>
            <Button icon={Heart} onClick={() => void toggleFavorite(p.id)} aria-pressed={p.favorite} className={p.favorite ? 'is-fav' : ''}>
              {p.favorite ? 'Favorito' : 'Favoritar'}
            </Button>
            <ButtonLink to={`/colecao/${p.id}/editar`} icon={Pencil} variant="ghost">
              Editar
            </ButtonLink>
            <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <Card>
          <CardHeader title="Pirâmide olfativa" subtitle={sourceLabel} />
          <div className="stack">
            {p.accords && p.accords.length > 0 && (
              <div className="chip-group chip-group--static" aria-label="Acordes principais">
                {p.accords.map((a) => (
                  <span key={a} className="chip chip--static">
                    {a}
                  </span>
                ))}
              </div>
            )}
            <NotesPyramid top={p.topNotes} heart={p.heartNotes} base={p.baseNotes} />
            {p.perfumers && p.perfumers.length > 0 && (
              <p className="small">
                <span className="muted">Perfumista{p.perfumers.length > 1 ? 's' : ''}:</span> {p.perfumers.join(', ')}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Percepção" subtitle="Segundo a sua experiência" />
          <div className="stack">
            <ScaleView label="Intensidade" value={p.intensity} labels={SCALE_LABELS.intensity} />
            <ScaleView label="Projeção" value={p.projection} labels={SCALE_LABELS.projection} />
            <ScaleView label="Fixação" value={p.longevity} labels={SCALE_LABELS.longevity} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Quando usar" />
          <dl className="def-list">
            <dt>Ocasiões</dt>
            <dd>
              <ChipList values={p.occasions} options={OCCASIONS} />
            </dd>
            <dt>Climas</dt>
            <dd>
              <ChipList values={p.climates} options={CLIMATES} />
            </dd>
            <dt>Períodos</dt>
            <dd>
              <ChipList values={p.periods} options={PERIODS} />
            </dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Frasco e compra" />
          <dl className="def-list def-list--inline">
            <dt>Volume</dt>
            <dd>{p.volumeMl ? `${p.volumeMl} ml` : '—'}</dd>
            <dt>Restante</dt>
            <dd>
              {p.remainingMl !== undefined ? `${p.remainingMl} ml` : '—'}
              {remainingPct !== undefined && (
                <span className="progress" aria-label={`${Math.round(remainingPct)}% restante`}>
                  <span style={{ width: `${remainingPct}%` }} />
                </span>
              )}
            </dd>
            <dt>Aquisição</dt>
            <dd>{p.acquiredAt ? formatDate(parseDateKey(p.acquiredAt)) : '—'}</dd>
            <dt>Preço pago</dt>
            <dd>{p.pricePaid !== undefined ? formatCurrency(p.pricePaid) : '—'}</dd>
            <dt>Cadastrado em</dt>
            <dd>{formatDate(new Date(p.createdAt))}</dd>
          </dl>
        </Card>

        {p.notes && (
          <Card className="detail-grid__wide">
            <CardHeader title="Observações" />
            <p className="prewrap">{p.notes}</p>
          </Card>
        )}

        <Card className="detail-grid__wide">
          <CardHeader title="Histórico de utilização" />
          {logs.length === 0 ? (
            <EmptyState icon={Droplet} title="Nenhum uso registrado" compact>
              Registre quando usar este perfume para acompanhar suas estatísticas.
            </EmptyState>
          ) : (
            <UsageLogList logs={logs} showPerfume={false} limit={8} />
          )}
        </Card>
      </div>

      <UsageDialog open={registerOpen} perfumeId={p.id} onClose={() => setRegisterOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        title={`Excluir ${p.name}?`}
        danger
        confirmLabel="Excluir perfume"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deletePerfume(p.id);
          notify('Perfume excluído.');
          navigate('/colecao');
        }}
      >
        {logs.length > 0
          ? `O perfume e ${pluralize(logs.length, 'registro de uso', 'registros de uso')} serão excluídos permanentemente.`
          : 'O perfume será excluído permanentemente.'}{' '}
        Considere exportar um backup antes.
      </ConfirmDialog>
    </div>
  );
}
