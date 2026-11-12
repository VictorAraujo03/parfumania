import { describe, expect, it } from 'vitest';
import { translateSv } from './scentVerdict';

describe('ScentVerdict: tradução das frases', () => {
  it('traduz os modelos conhecidos', () => {
    expect(translateSv('Shares 7 of its 9 notes, including Grapefruit, Lemon, Bergamot').text).toBe(
      'Tem 7 das 9 notas em comum, como toranja, limão e bergamota.',
    );
    expect(translateSv('Every one of its 18 notes is in the original, including Grapefruit, Lemon').text).toBe(
      'Todas as 18 notas dele estão no original, como toranja e limão.',
    );
    expect(translateSv('Adds ambroxan and musk, drops aldehydes and amber').text).toBe(
      'Acrescenta ambroxan e almíscar; deixa de fora aldeídos e âmbar.',
    );
    expect(translateSv('Without cardamom and vetiver').text).toBe('Sem cardamomo e vetiver.');
    expect(translateSv('Near-identical note list, differs in proportion').translated).toBe(true);
  });

  it('mantém o original quando a frase é desconhecida', () => {
    expect(translateSv('A totally new phrase')).toEqual({ text: 'A totally new phrase', translated: false });
  });
});
