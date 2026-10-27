import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BookOpen, ImagePlus, Trash2, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { ChipMultiSelect } from '../../components/ChipGroup';
import { Field, SelectField, TextAreaField, TextField } from '../../components/fields';
import { PerfumeImage } from '../../components/PerfumeImage';
import { RatingInput, ScaleInput } from '../../components/ScaleInput';
import { Notice } from '../../components/ui';
import {
  CLIMATES,
  CONCENTRATIONS,
  FAMILIES,
  OCCASIONS,
  PERIODS,
  SCALE_LABELS,
  STATUSES,
} from '../../data/options';
import type { ImageChange } from '../../hooks/useAppData';
import { useImage } from '../../hooks/useImage';
import { prepareImage } from '../../utils/image';
import { toDateKey } from '../../utils/date';
import { useCatalog } from '../../hooks/useCatalog';
import { CatalogAutocomplete } from './CatalogAutocomplete';
import { applyCatalogEntry, validatePerfumeForm, type FormErrors, type PerfumeFormState } from './perfumeFormModel';

interface PerfumeFormProps {
  initial: PerfumeFormState;
  initialImageId?: string;
  brands: string[];
  submitLabel: string;
  notice?: ReactNode;
  onSubmit(state: PerfumeFormState, image: ImageChange): Promise<void>;
  onCancel(): void;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="form-section">
      <header className="form-section__header">
        <h2 className="form-section__title">{title}</h2>
        {description && <p className="form-section__desc">{description}</p>}
      </header>
      <div className="form-section__body">{children}</div>
    </section>
  );
}

export function PerfumeForm({ initial, initialImageId, brands, submitLabel, notice, onSubmit, onCancel }: PerfumeFormProps) {
  const [state, setState] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [image, setImage] = useState<ImageChange>({ kind: 'keep' });
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storedImage = useImage(initialImageId);
  const { getById } = useCatalog();
  const catalogEntry = getById(state.catalogId);

  const set = <K extends keyof PerfumeFormState>(key: K, value: PerfumeFormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const text = (key: keyof PerfumeFormState) => ({
    value: state[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  const previewSrc = image.kind === 'set' ? image.dataUrl : image.kind === 'remove' ? undefined : storedImage;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImageBusy(true);
    try {
      const dataUrl = await prepareImage(file);
      setImage({ kind: 'set', dataUrl });
      setErrors((e) => ({ ...e, image: undefined }));
    } catch (err) {
      setErrors((e) => ({ ...e, image: err instanceof Error ? err.message : 'Imagem inválida.' }));
    } finally {
      setImageBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validatePerfumeForm(state);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    try {
      await onSubmit(state, image);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="perfume-form" onSubmit={submit} noValidate>
      {notice}
      {catalogEntry && catalogEntry.source.kind === 'import' && (
        <Notice
          tone="info"
          icon={BookOpen}
          action={
            <Button size="sm" variant="ghost" icon={X} onClick={() => setState((s) => ({ ...s, catalogId: undefined }))}>
              Desvincular
            </Button>
          }
        >
          Preenchido com <strong>{catalogEntry.name}</strong> ({catalogEntry.brand}) da base <strong>{catalogEntry.source.label}</strong>.
          Dados comunitários não verificados — confira e ajuste. Ocasiões, climas e percepções continuam sendo seus.
        </Notice>
      )}

      <Section title="Informações básicas">
        <div className="form-grid">
          <CatalogAutocomplete
            value={state.name}
            error={errors.name}
            onChange={(v) => set('name', v)}
            onSelect={(entry) => {
              setState((s) => applyCatalogEntry(s, entry));
              setErrors({});
            }}
          />
          <Field label="Marca" error={errors.brand}>
            {(id, describedBy) => (
              <>
                <input
                  id={id}
                  className="input"
                  list="brand-options"
                  required
                  maxLength={80}
                  aria-invalid={!!errors.brand}
                  aria-describedby={describedBy}
                  placeholder="Ex.: Hermès"
                  {...text('brand')}
                />
                <datalist id="brand-options">
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <SelectField
            label="Concentração"
            optional
            options={CONCENTRATIONS}
            placeholder="Não informada"
            {...text('concentration')}
          />
          {state.concentration === 'other' && (
            <TextField label="Qual concentração?" optional error={errors.concentrationOther} {...text('concentrationOther')} />
          )}
          <SelectField label="Status na coleção" options={STATUSES} {...text('status')} />
          <TextField label="Ano de lançamento" optional inputMode="numeric" maxLength={4} error={errors.year} {...text('year')} />
          <TextField label="Perfumista(s)" optional placeholder="Separe por vírgula" {...text('perfumers')} />
          <TextField label="Volume original (ml)" optional inputMode="decimal" error={errors.volumeMl} {...text('volumeMl')} />
          <TextField
            label="Volume restante estimado (ml)"
            optional
            inputMode="decimal"
            error={errors.remainingMl}
            {...text('remainingMl')}
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={state.favorite} onChange={(e) => set('favorite', e.target.checked)} />
          <span>Marcar como favorito</span>
        </label>
      </Section>

      <Section
        title="Características olfativas"
        description="Preencha apenas o que você conhece. Separe as notas por vírgula."
      >
        <div className="form-grid">
          <SelectField
            label="Família olfativa"
            optional
            options={FAMILIES}
            placeholder="Não informada"
            hint={
              catalogEntry?.familyFromAccord && state.family === catalogEntry.family
                ? 'Sugerida a partir do acorde principal da base — ajuste se discordar.'
                : undefined
            }
            {...text('family')}
          />
          <TextField label="Acordes principais" optional placeholder="Amadeirado, Especiado" {...text('accords')} />
        </div>
        <div className="form-grid form-grid--3">
          <TextAreaField label="Notas de saída" optional rows={2} placeholder="Bergamota, pimenta" {...text('topNotes')} />
          <TextAreaField label="Notas de coração" optional rows={2} placeholder="Lavanda, gerânio" {...text('heartNotes')} />
          <TextAreaField label="Notas de fundo" optional rows={2} placeholder="Vetiver, cedro" {...text('baseNotes')} />
        </div>
        <div className="form-grid form-grid--3">
          <ScaleInput label="Intensidade percebida" labels={SCALE_LABELS.intensity} value={state.intensity} onChange={(v) => set('intensity', v)} />
          <ScaleInput label="Projeção percebida" labels={SCALE_LABELS.projection} value={state.projection} onChange={(v) => set('projection', v)} />
          <ScaleInput label="Fixação observada" labels={SCALE_LABELS.longevity} value={state.longevity} onChange={(v) => set('longevity', v)} />
        </div>
      </Section>

      <Section
        title="Preferências de utilização"
        description="Usadas pelo motor de recomendação. Sem elas, a confiança das recomendações diminui."
      >
        <div className="field">
          <span className="field__label">Ocasiões recomendadas</span>
          <ChipMultiSelect options={OCCASIONS} value={state.occasions} onChange={(v) => set('occasions', v)} ariaLabel="Ocasiões" />
        </div>
        <div className="field">
          <span className="field__label">Climas preferenciais</span>
          <ChipMultiSelect options={CLIMATES} value={state.climates} onChange={(v) => set('climates', v)} ariaLabel="Climas" />
        </div>
        <div className="field">
          <span className="field__label">Períodos de utilização</span>
          <ChipMultiSelect options={PERIODS} value={state.periods} onChange={(v) => set('periods', v)} ariaLabel="Períodos" />
        </div>
      </Section>

      <Section title="Informações de compra">
        <div className="form-grid">
          <TextField
            label="Data de aquisição"
            optional
            type="date"
            max={toDateKey(new Date())}
            error={errors.acquiredAt}
            {...text('acquiredAt')}
          />
          <TextField label="Preço pago (R$)" optional inputMode="decimal" error={errors.pricePaid} {...text('pricePaid')} />
        </div>
      </Section>

      <Section title="Imagem e observações pessoais">
        <div className="image-picker">
          <PerfumeImage
            src={previewSrc}
            name={state.name || 'Perfume'}
            brand={state.brand}
            family={state.family || undefined}
            className="image-picker__preview"
          />
          <div className="image-picker__controls">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden"
              id="perfume-image-input"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <Button icon={ImagePlus} onClick={() => fileRef.current?.click()} disabled={imageBusy}>
              {imageBusy ? 'Processando…' : previewSrc ? 'Trocar imagem' : 'Escolher imagem'}
            </Button>
            {previewSrc && (
              <Button variant="ghost" icon={Trash2} onClick={() => setImage({ kind: 'remove' })}>
                Remover imagem
              </Button>
            )}
            <p className={errors.image ? 'field__error' : 'field__hint'}>
              {errors.image ?? 'JPG, PNG ou WebP até 5 MB. A imagem é reduzida e salva apenas neste navegador.'}
            </p>
          </div>
        </div>
        <div className="field">
          <span className="field__label">
            Avaliação pessoal <span className="field__optional">opcional</span>
          </span>
          <RatingInput value={state.rating} onChange={(v) => set('rating', v)} />
        </div>
        <TextAreaField label="Observações" optional rows={4} maxLength={2000} error={errors.notes} {...text('notes')} />
      </Section>

      {Object.values(errors).some(Boolean) && (
        <Notice tone="warning">Revise os campos destacados antes de salvar.</Notice>
      )}

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={saving || imageBusy}>
          {saving ? 'Salvando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
