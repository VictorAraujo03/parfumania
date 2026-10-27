/**
 * Estratégia de migração do esquema de dados.
 *
 * - Cada versão do esquema recebe um número inteiro (CURRENT_SCHEMA_VERSION).
 * - Para evoluir a estrutura, incremente a versão e registre em MIGRATIONS
 *   uma função que converte o snapshot da versão N-1 para a versão N.
 * - As migrações rodam em sequência na inicialização e também ao importar
 *   um backup de versão anterior.
 * - Após migrar, os normalizadores (normalize.ts) completam campos ausentes.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export interface DatabaseSnapshot {
  schemaVersion: number;
  perfumes: unknown[];
  usageLogs: unknown[];
  offers: unknown[];
  settings: unknown;
}

type Migration = (db: DatabaseSnapshot) => DatabaseSnapshot;

const MIGRATIONS: Record<number, Migration> = {
  // Exemplo para uma futura versão 2:
  // 2: (db) => ({ ...db, perfumes: db.perfumes.map((p) => ({ ...p, newField: null })) }),
};

export class MigrationError extends Error {}

export function migrate(db: DatabaseSnapshot): DatabaseSnapshot {
  if (db.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      `Os dados foram criados por uma versão mais nova do Parfumania (esquema ${db.schemaVersion}).`,
    );
  }
  let current = db;
  for (let v = db.schemaVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    current = step ? step(current) : current;
    current = { ...current, schemaVersion: v };
  }
  return current;
}
