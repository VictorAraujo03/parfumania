import { describe, expect, it } from 'vitest';
import { translateScento } from './translate';

describe('tradução das frases da Scento', () => {
  it('traduz as frases das seleções por ocasião', () => {
    expect(translateScento('Warm and spicy with tobacco and ginger; dense and warm enough to carry through cold air.').text).toBe(
      'Quente e especiado, com tabaco e gengibre; denso e quente o bastante para atravessar o ar frio.',
    );
  });

  it('traduz as diferenças entre perfumes parecidos', () => {
    expect(translateScento('Leans more fruity and floral, with pear and jasmine sambac added.').text).toBe(
      'Puxa mais para o frutado e floral, com pera e jasmim sambac a mais.',
    );
    expect(translateScento('Adds cherry and cognac to a similar frame.').text).toBe('Acrescenta cereja e conhaque a uma estrutura parecida.');
  });

  it('traduz o resumo do perfume com pirâmide', () => {
    const t = translateScento(
      'Layton by Parfums de Marly belongs to Scento’s Wood & Root family: apple, bergamot and cardamom open onto lavender, violet and geranium, settling on patchouli, vanilla, guaiac wood and praline.',
    );
    expect(t.translated).toBe(true);
    expect(t.text).toBe(
      'Layton, de Parfums de Marly, é da família Madeiras e raízes da Scento: maçã, bergamota e cardamomo abrem para lavanda, violeta e gerânio, assentando em patchouli, baunilha, madeira de guaiaco e praliné.',
    );
  });

  it('traduz o guarda-roupa', () => {
    expect(translateScento('Built around Sauvage: Paradigme for daytime, Winter Palace for evening, Wood and Spices for a wild card.').text).toBe(
      'Montado em torno de Sauvage: Paradigme para o dia, Winter Palace para a noite e Wood and Spices como curinga.',
    );
  });

  it('mantém o original quando a frase foge dos modelos', () => {
    const t = translateScento('A completely new kind of sentence.');
    expect(t.translated).toBe(false);
    expect(t.text).toBe('A completely new kind of sentence.');
  });
});
