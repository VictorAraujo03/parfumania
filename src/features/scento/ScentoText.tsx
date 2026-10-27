import { translateScento } from '../../services/scento/translate';

/** Frase da Scento em português (traduzida por modelos); o original fica no título. */
export function ScentoText({ text, className, quote }: { text: string; className?: string; quote?: boolean }) {
  const t = translateScento(text);
  const content = quote ? `“${t.text}”` : t.text;
  const props = {
    className,
    lang: t.translated ? 'pt-BR' : 'en',
    title: t.translated ? `Original (Scento): ${text}` : undefined,
  };
  return quote ? <blockquote {...props}>{content}</blockquote> : <p {...props}>{content}</p>;
}
