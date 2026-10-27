import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, FlaskConical, SearchX } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { EmptyState, Notice, PageHeader } from '../components/ui';
import { PerfumeForm } from '../features/collection/PerfumeForm';
import { EMPTY_FORM, formFromCatalog, formFromPerfume, formToInput } from '../features/collection/perfumeFormModel';
import { uniqueBrands } from '../features/collection/filters';
import { useAppData, usePerfume } from '../hooks/useAppData';
import { useCatalog } from '../hooks/useCatalog';
import { useToast } from '../hooks/useToast';
import type { PerfumeStatus } from '../types';

export function PerfumeFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { perfumes, addPerfume, updatePerfume } = useAppData();
  const { notify } = useToast();
  const existing = usePerfume(id);
  const brands = useMemo(() => uniqueBrands(perfumes), [perfumes]);
  const catalog = useCatalog();

  const isEdit = !!id;
  const catalogEntry = !isEdit ? catalog.getById(params.get('catalog')) : undefined;
  const statusParam = params.get('status') as PerfumeStatus | null;

  const initial = useMemo(() => {
    if (existing) return formFromPerfume(existing);
    if (catalogEntry) return formFromCatalog(catalogEntry, statusParam ?? 'owned');
    return EMPTY_FORM;
    // Estado inicial calculado apenas uma vez por perfume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, catalogEntry?.id]);

  if (isEdit && !existing) {
    return (
      <div className="page">
        <EmptyState icon={SearchX} title="Perfume não encontrado" action={<ButtonLink to="/colecao">Voltar à coleção</ButtonLink>} />
      </div>
    );
  }

  const notice = existing?.isDemo ? (
    <Notice tone="demo" icon={FlaskConical}>
      Este é um perfume de demonstração. Ao salvar, ele passa a ser considerado seu e deixa de ser removido junto com os
      exemplos.
    </Notice>
  ) : catalogEntry?.source.kind === 'demo' ? (
    <Notice tone="info" icon={BookOpen}>
      Dados importados do catálogo de demonstração (não verificados): nome, marca, concentração, família e notas.
      Ocasiões, climas e percepções ficam em branco para você preencher a partir da sua experiência.
    </Notice>
  ) : undefined;

  return (
    <div className="page page--narrow">
      <Link to={existing ? `/colecao/${existing.id}` : '/colecao'} className="back-link">
        <ArrowLeft size={16} aria-hidden /> {existing ? existing.name : 'Coleção'}
      </Link>
      <PageHeader
        eyebrow={isEdit ? 'Editar perfume' : 'Novo perfume'}
        title={isEdit ? existing!.name : 'Cadastrar perfume'}
        description="Apenas nome e marca são obrigatórios. Todos os outros campos podem ficar em branco."
      />
      <PerfumeForm
        key={existing?.id ?? catalogEntry?.id ?? 'new'}
        initial={initial}
        initialImageId={existing?.imageId}
        brands={brands}
        notice={notice}
        submitLabel={isEdit ? 'Salvar alterações' : 'Adicionar à coleção'}
        onCancel={() => navigate(-1)}
        onSubmit={async (state, image) => {
          try {
            if (existing) {
              await updatePerfume(existing.id, formToInput(state, existing), image);
              notify('Alterações salvas.');
              navigate(`/colecao/${existing.id}`);
            } else {
              const input = formToInput(state);
              const created = await addPerfume(
input,
                image,
              );
              notify('Perfume adicionado à coleção.');
              navigate(`/colecao/${created.id}`, { replace: true });
            }
          } catch (err) {
            notify(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error');
          }
        }}
      />
    </div>
  );
}
