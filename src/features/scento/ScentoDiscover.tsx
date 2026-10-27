import { useEffect, useMemo, useState } from 'react';
import { Shirt, Sparkles } from 'lucide-react';
import { Button } from '../../components/Button';
import { ChipSingleSelect } from '../../components/ChipGroup';
import { Card, CardHeader, EmptyState } from '../../components/ui';
import { useAppData } from '../../hooks/useAppData';
import { resolveScento, scento, type Folio, type ScentoLean, type ScentoOccasion, type ScentoPick } from '../../services/scento/scento';
import { SCENTO_LEANS, SCENTO_OCCASIONS } from '../../services/scento/labels';
import type { Perfume } from '../../types';
import { ScentoCredit, ScentoPicks } from './ScentoPicks';

type Load<T> = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/** Explorar com a Scento: sugestões por ocasião e um guarda-roupa montado a partir dos seus favoritos. */
export function ScentoDiscover() {
  return (
    <div className="scento-discover">
      <OccasionEdit />
      <WardrobeBuilder />
    </div>
  );
}

function OccasionEdit() {
  const [occasion, setOccasion] = useState<ScentoOccasion>('office');
  const [lean, setLean] = useState<ScentoLean>();
  const [state, setState] = useState<Load<Folio<{ occasion: string; edit: ScentoPick[] }>>>({ status: 'idle' });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    scento
      .edit(occasion, lean)
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [occasion, lean]);

  const label = SCENTO_OCCASIONS.find((o) => o.value === occasion)?.label.toLowerCase() ?? occasion;

  return (
    <Card>
      <CardHeader title="Por ocasião" subtitle="Seleções da Scento para cada momento. Marcamos o que você já tem." />
      <div className="scento-discover__controls">
        <ChipSingleSelect
          options={SCENTO_OCCASIONS}
          value={occasion}
          onChange={(v) => v && setOccasion(v)}
          allowClear={false}
          ariaLabel="Ocasião"
        />
        <div className="scento-discover__lean">
          <span className="moment-ask__label">Estilo</span>
          <ChipSingleSelect options={SCENTO_LEANS} value={lean} onChange={setLean} ariaLabel="Estilo (opcional)" />
        </div>
      </div>
      {state.status === 'loading' && <p className="muted small" aria-busy="true">Consultando a Scento…</p>}
      {state.status === 'error' && <p className="muted small">{state.message}</p>}
      {state.status === 'ready' && (
        <>
          <blockquote className="scento__lede" lang="en">
            “{state.data.lede}”
          </blockquote>
          <ScentoPicks items={state.data.detail.edit} context={`seleção para ${label}`} />
          <ScentoCredit page={state.data.scento_page} />
        </>
      )}
    </Card>
  );
}

const MAX_LOVES = 6;

function WardrobeBuilder() {
  const { perfumes, updatePerfume } = useAppData();
  const owned = useMemo(
    () =>
      perfumes
        .filter((p) => p.status === 'owned' || p.status === 'decant')
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name)),
    [perfumes],
  );
  const [selected, setSelected] = useState<string[]>(() =>
    owned.filter((p) => p.favorite || (p.rating ?? 0) >= 4).slice(0, 4).map((p) => p.id),
  );
  const [size, setSize] = useState<'3' | '4' | '5'>('4');
  const [state, setState] = useState<Load<{ folio: Folio<{ wardrobe: ScentoPick[] }>; missing: Perfume[] }>>({ status: 'idle' });

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_LOVES ? s : [...s, id]));
  }

  async function build() {
    setState({ status: 'loading' });
    try {
      const chosen = owned.filter((p) => selected.includes(p.id));
      const slugs: string[] = [];
      const missing: Perfume[] = [];
      for (const p of chosen) {
        let slug = p.scentoId;
        if (!slug) {
          slug = (await resolveScento(p.name, p.brand)).slug;
          if (slug) void updatePerfume(p.id, { scentoId: slug }).catch(() => undefined);
        }
        if (slug) slugs.push(slug);
        else missing.push(p);
      }
      if (slugs.length === 0) {
        setState({ status: 'error', message: 'Nenhum dos perfumes escolhidos foi encontrado na Scento. Tente outros.' });
        return;
      }
      const folio = await scento.wardrobe(slugs, Number(size));
      setState({ status: 'ready', data: { folio, missing } });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  return (
    <Card>
      <CardHeader
        title="Monte seu guarda-roupa"
        subtitle={`Escolha até ${MAX_LOVES} perfumes que você ama; a Scento sugere o que completa a coleção (dia, noite, calor, frio…).`}
      />
      {owned.length === 0 ? (
        <EmptyState icon={Shirt} title="Coleção vazia" compact>
          Cadastre seus perfumes para montar um guarda-roupa.
        </EmptyState>
      ) : (
        <>
          <div className="chip-group" role="group" aria-label="Perfumes que você ama">
            {owned.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${on ? 'chip--active' : ''}`}
                  aria-pressed={on}
                  disabled={!on && selected.length >= MAX_LOVES}
                  onClick={() => toggle(p.id)}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="scento-discover__build">
            <span className="moment-ask__label">Sugestões</span>
            <ChipSingleSelect
              options={[
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
              ]}
              value={size}
              onChange={(v) => v && setSize(v)}
              allowClear={false}
              ariaLabel="Quantidade de sugestões"
            />
            <Button variant="primary" icon={Sparkles} onClick={build} disabled={selected.length === 0 || state.status === 'loading'}>
              {state.status === 'loading' ? 'Montando…' : 'Montar guarda-roupa'}
            </Button>
          </div>
          {state.status === 'error' && <p className="muted small">{state.message}</p>}
          {state.status === 'ready' && (
            <>
              <blockquote className="scento__lede" lang="en">
                “{state.data.folio.lede}”
              </blockquote>
              <ScentoPicks items={state.data.folio.detail.wardrobe} context="guarda-roupa montado a partir dos seus favoritos" />
              {state.data.missing.length > 0 && (
                <p className="muted small">
                  Não encontrados na Scento (ficaram de fora): {state.data.missing.map((p) => p.name).join(', ')}.
                </p>
              )}
              <ScentoCredit page={state.data.folio.scento_page} />
            </>
          )}
        </>
      )}
    </Card>
  );
}
