import { useEffect, useRef } from 'react';
import { useAppData } from '../../hooks/useAppData';
import { PARFUMO_PRESET, useCatalog } from '../../hooks/useCatalog';
import { useToast } from '../../hooks/useToast';
import { CATALOG_FORMAT_VERSION } from '../../services/catalog/csvImport';

/**
 * Se a conta usa a base Parfumo e este aparelho ainda não a tem (ou tem uma
 * versão de formato antiga), baixa automaticamente (uma tentativa por sessão). A base em si fica local em
 * cada aparelho; só a preferência é sincronizada na conta.
 */
export function CatalogAutoSync() {
  const { status, settings } = useAppData();
  const catalog = useCatalog();
  const { notify } = useToast();
  const tried = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || !catalog.ready || tried.current) return;
    if (settings.catalogPreset !== 'parfumo' || catalog.busy) return;
    // Base predefinida baixada num formato antigo (ex.: sem a nota da comunidade): atualiza uma vez.
    const outdated =
      catalog.meta?.label === PARFUMO_PRESET.label && (catalog.meta.formatVersion ?? 1) < CATALOG_FORMAT_VERSION;
    if (catalog.meta && !outdated) return;
    tried.current = true;
    notify(
      outdated ? 'Atualizando sua base de perfumes (agora com a nota da comunidade)…' : 'Baixando sua base de perfumes neste aparelho…',
      'info',
    );
    catalog
      .importFromUrl(PARFUMO_PRESET)
      .then((m) => notify(`Base de perfumes pronta: ${m.count.toLocaleString('pt-BR')} perfumes.`))
      .catch((err: unknown) =>
        notify(err instanceof Error ? `Base de perfumes: ${err.message}` : 'Não foi possível baixar a base de perfumes.', 'error'),
      );
  }, [status, settings.catalogPreset, catalog, notify]);

  return null;
}
