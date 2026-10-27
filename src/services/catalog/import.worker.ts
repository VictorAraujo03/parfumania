import { importCatalogCsv } from './csvImport';

/** Processa o CSV fora da thread principal para não travar a interface. */
self.onmessage = (ev: MessageEvent<{ text: string; label: string }>) => {
  try {
    const { entries } = importCatalogCsv(ev.data.text, ev.data.label);
    self.postMessage({ ok: true, entries });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : 'Falha ao ler o arquivo.' });
  }
};
