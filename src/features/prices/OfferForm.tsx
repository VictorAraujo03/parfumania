import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { SelectField, TextAreaField, TextField } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { CONCENTRATIONS, OFFER_CONDITIONS } from '../../data/options';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import type { Concentration, OfferCondition, PriceOffer } from '../../types';
import { toDateTimeLocal } from '../../utils/date';

interface OfferFormProps {
  open: boolean;
  offer?: PriceOffer;
  onClose(): void;
}

interface State {
  perfumeId: string;
  perfumeName: string;
  brand: string;
  concentration: Concentration | '';
  volumeMl: string;
  condition: OfferCondition;
  store: string;
  price: string;
  shipping: string;
  url: string;
  checkedAt: string;
  notes: string;
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export function OfferForm({ open, offer, onClose }: OfferFormProps) {
  const { perfumes, addOffer, updateOffer } = useAppData();
  const { notify } = useToast();
  const [s, setS] = useState<State>();
  const [errors, setErrors] = useState<Partial<Record<keyof State, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setS({
      perfumeId: offer?.perfumeId ?? '',
      perfumeName: offer?.perfumeName ?? '',
      brand: offer?.brand ?? '',
      concentration: offer?.concentration ?? '',
      volumeMl: offer?.volumeMl?.toString() ?? '',
      condition: offer?.condition ?? 'new',
      store: offer?.store ?? '',
      price: offer?.price.toString() ?? '',
      shipping: offer?.shipping?.toString() ?? '',
      url: offer?.url ?? '',
      checkedAt: toDateTimeLocal(offer ? new Date(offer.checkedAt) : new Date()),
      notes: offer?.notes ?? '',
    });
  }, [open, offer]);

  if (!s) return null;
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((x) => (x ? { ...x, [k]: v } : x));

  function pickPerfume(id: string) {
    const p = perfumes.find((x) => x.id === id);
    setS((x) =>
      x && p
        ? { ...x, perfumeId: id, perfumeName: p.name, brand: p.brand, concentration: p.concentration ?? '', volumeMl: p.volumeMl?.toString() ?? x.volumeMl }
        : x && { ...x, perfumeId: '' },
    );
  }

  async function save() {
    if (!s) return;
    const e: typeof errors = {};
    const price = num(s.price);
    const shipping = num(s.shipping);
    const volume = num(s.volumeMl);
    if (!s.perfumeName.trim()) e.perfumeName = 'Informe o perfume.';
    if (!s.brand.trim()) e.brand = 'Informe a marca.';
    if (!s.store.trim()) e.store = 'Informe a loja.';
    if (price === undefined || Number.isNaN(price) || price <= 0) e.price = 'Informe um preço válido.';
    if (shipping !== undefined && (Number.isNaN(shipping) || shipping < 0)) e.shipping = 'Frete inválido.';
    if (volume !== undefined && (Number.isNaN(volume) || volume <= 0)) e.volumeMl = 'Volume inválido.';
    if (s.url && !/^https?:\/\/\S+$/i.test(s.url.trim())) e.url = 'Use um endereço iniciado por http:// ou https://.';
    if (!s.checkedAt || Number.isNaN(new Date(s.checkedAt).getTime())) e.checkedAt = 'Informe quando o preço foi consultado.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const input = {
      perfumeId: s.perfumeId || undefined,
      perfumeName: s.perfumeName.trim(),
      brand: s.brand.trim(),
      concentration: s.concentration || undefined,
      volumeMl: volume,
      condition: s.condition,
      store: s.store.trim(),
      price: price!,
      shipping,
      url: s.url.trim() || undefined,
      checkedAt: new Date(s.checkedAt).toISOString(),
      source: offer?.source ?? 'manual',
      notes: s.notes.trim() || undefined,
    };
    if (offer) await updateOffer(offer.id, input);
    else await addOffer(input);
    notify(offer ? 'Oferta atualizada.' : 'Oferta registrada.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? 'Editar oferta' : 'Registrar oferta manualmente'}
      subtitle="Informe um preço que você consultou. Nada é buscado automaticamente."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Salvar oferta
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <SelectField
          label="Perfume da coleção"
          optional
          hint="Ou digite os dados ao lado para qualquer perfume."
          options={perfumes.map((p) => ({ value: p.id, label: `${p.name} — ${p.brand}` }))}
          placeholder="Outro perfume"
          value={s.perfumeId}
          onChange={(e) => pickPerfume(e.target.value)}
        />
        <TextField label="Perfume" value={s.perfumeName} error={errors.perfumeName} onChange={(e) => set('perfumeName', e.target.value)} />
        <TextField label="Marca" value={s.brand} error={errors.brand} onChange={(e) => set('brand', e.target.value)} />
        <SelectField label="Concentração" optional options={CONCENTRATIONS} placeholder="Não informada" value={s.concentration} onChange={(e) => set('concentration', e.target.value as Concentration | '')} />
        <TextField label="Volume (ml)" optional inputMode="decimal" value={s.volumeMl} error={errors.volumeMl} onChange={(e) => set('volumeMl', e.target.value)} />
        <SelectField label="Condição" options={OFFER_CONDITIONS} value={s.condition} onChange={(e) => set('condition', e.target.value as OfferCondition)} />
        <TextField label="Loja" value={s.store} error={errors.store} onChange={(e) => set('store', e.target.value)} />
        <TextField label="Preço (R$)" inputMode="decimal" value={s.price} error={errors.price} onChange={(e) => set('price', e.target.value)} />
        <TextField label="Frete (R$)" optional hint="Deixe vazio se desconhecido; 0 para grátis." inputMode="decimal" value={s.shipping} error={errors.shipping} onChange={(e) => set('shipping', e.target.value)} />
        <TextField label="Consultado em" type="datetime-local" value={s.checkedAt} error={errors.checkedAt} onChange={(e) => set('checkedAt', e.target.value)} />
        <TextField label="URL do produto" optional type="url" value={s.url} error={errors.url} onChange={(e) => set('url', e.target.value)} className="form-grid__wide" />
        <TextAreaField label="Observações" optional rows={2} value={s.notes} onChange={(e) => set('notes', e.target.value)} className="form-grid__wide" />
      </div>
    </Modal>
  );
}
