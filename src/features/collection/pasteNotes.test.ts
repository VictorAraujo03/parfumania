import { describe, expect, it } from 'vitest';
import { parsePastedNotes } from './pasteNotes';

describe('colar notas', () => {
  it('lê a pirâmide copiada (títulos em inglês) e traduz', () => {
    const text = `main accords
citrus
aromatic
fresh spicy
Perfume Pyramid
Top Notes
Calabrian bergamot
Pepper
Middle Notes
Sichuan Pepper
Lavender
Pink Pepper
Base Notes
Ambroxan
Cedar
Labdanum
Vote for Ingredients
Perfume rating 4.21 out of 5 with 30000 votes`;
    const p = parsePastedNotes(text);
    expect(p.top).toEqual(['Bergamota da Calábria', 'Pimenta']);
    expect(p.heart).toContain('Lavanda');
    expect(p.base).toEqual(['Ambroxan', 'Cedro', 'Ládano']);
    expect(p.accords).toEqual(['Cítrico', 'Aromático', 'Especiado fresco']);
  });

  it('lê a frase da descrição em inglês e em português', () => {
    const en = parsePastedNotes('Sauvage was launched in 2015. Top notes are Calabrian bergamot and Pepper; middle notes are Lavender, Geranium and Elemi; base notes are Ambroxan, Cedar and Labdanum.');
    expect(en.top).toEqual(['Bergamota da Calábria', 'Pimenta']);
    expect(en.heart).toEqual(['Lavanda', 'Gerânio', 'Elemi']);
    expect(en.base).toEqual(['Ambroxan', 'Cedro', 'Ládano']);
    const pt = parsePastedNotes('As notas de topo são bergamota e pimenta; as notas de coração são lavanda e gerânio; as notas de fundo são ambroxan e cedro.');
    expect(pt.top).toEqual(['Bergamota', 'Pimenta']);
    expect(pt.base).toEqual(['Ambroxan', 'Cedro']);
  });

  it('aceita "Saída: a, b" na mesma linha e listas simples', () => {
    const p = parsePastedNotes('Saída: limão, menta\nCoração: jasmim\nFundo: almíscar, cedro');
    expect(p.top).toEqual(['Limão', 'Menta']);
    expect(p.base).toEqual(['Almíscar', 'Cedro']);
    const linear = parsePastedNotes('Fragrance notes are vanilla, tobacco and tonka bean.');
    expect(linear.heart).toEqual(['Baunilha', 'Tabaco', 'Fava tonka']);
  });
});
