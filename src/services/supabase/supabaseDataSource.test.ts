import { describe, expect, it } from 'vitest';
import type { Perfume } from '../../types';
import { normalizePerfume } from '../storage/normalize';
import { createRemoteEntityRepository, friendlyError } from './supabaseDataSource';

/** Imitação mínima do query builder do Supabase sobre uma tabela em memória. */
type Row = { user_id: string; id: string; data: unknown; updated_at?: string };

function fakeDb(rows: Row[]) {
  const calls: string[] = [];
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Partial<Row> | Partial<Row>[] | undefined;
    let range: [number, number] | undefined;
    let single = false;
    const builder = {
      select() {
        op = 'select';
        return builder;
      },
      insert(p: Partial<Row> | Partial<Row>[]) {
        op = 'insert';
        payload = p;
        return builder;
      },
      update(p: Partial<Row>) {
        op = 'update';
        payload = p;
        return builder;
      },
      delete() {
        op = 'delete';
        return builder;
      },
      eq(col: keyof Row, v: string) {
        filters.push((r) => r[col] === v);
        return builder;
      },
      in(col: keyof Row, vs: string[]) {
        filters.push((r) => vs.includes(r[col] as string));
        return builder;
      },
      order() {
        return builder;
      },
      range(a: number, b: number) {
        range = [a, b];
        return builder;
      },
      maybeSingle() {
        single = true;
        return builder;
      },
      then(resolve: (v: { data: unknown; error: null }) => void) {
        calls.push(`${table}:${op}`);
        const match = (r: Row) => filters.every((f) => f(r));
        if (op === 'insert') {
          const list = Array.isArray(payload) ? payload : [payload!];
          rows.push(...(list as Row[]));
          return resolve({ data: null, error: null });
        }
        if (op === 'update') {
          rows.filter(match).forEach((r) => Object.assign(r, payload));
          return resolve({ data: null, error: null });
        }
        if (op === 'delete') {
          for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1);
          return resolve({ data: null, error: null });
        }
        let found = rows.filter(match).map((r) => ({ data: r.data }));
        if (range) found = found.slice(range[0], range[1] + 1);
        return resolve({ data: single ? found[0] ?? null : found, error: null });
      },
    };
    return builder;
  };
  return { db: { from } as never, calls };
}

const perfume = (id: string, name: string): Perfume => ({
  id,
  name,
  brand: 'Marca',
  topNotes: [],
  heartNotes: [],
  baseNotes: [],
  occasions: [],
  climates: [],
  periods: [],
  favorite: false,
  status: 'owned',
  dataSource: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('repositório na nuvem', () => {
  it('lista apenas os registros do usuário', async () => {
    const rows: Row[] = [
      { user_id: 'u1', id: 'a', data: perfume('a', 'Meu') },
      { user_id: 'u2', id: 'b', data: perfume('b', 'De outra pessoa') },
    ];
    const { db } = fakeDb(rows);
    const repo = createRemoteEntityRepository<Perfume>(db, 'perfumes', 'u1', normalizePerfume);
    expect((await repo.list()).map((p) => p.name)).toEqual(['Meu']);
  });

  it('cria, atualiza mesclando campos e exclui', async () => {
    const rows: Row[] = [];
    const { db } = fakeDb(rows);
    const repo = createRemoteEntityRepository<Perfume>(db, 'perfumes', 'u1', normalizePerfume);
    await repo.create(perfume('a', 'Original'));
    expect(rows[0]).toMatchObject({ user_id: 'u1', id: 'a' });
    const updated = await repo.update('a', { favorite: true });
    expect(updated).toMatchObject({ name: 'Original', favorite: true });
    expect((rows[0].data as Perfume).favorite).toBe(true);
    await repo.remove('a');
    expect(rows).toHaveLength(0);
  });

  it('substitui tudo em lotes sem tocar em outros usuários', async () => {
    const rows: Row[] = [
      { user_id: 'u1', id: 'velho', data: perfume('velho', 'Velho') },
      { user_id: 'u2', id: 'x', data: perfume('x', 'Outro usuário') },
    ];
    const { db, calls } = fakeDb(rows);
    const repo = createRemoteEntityRepository<Perfume>(db, 'perfumes', 'u1', normalizePerfume);
    const many = Array.from({ length: 450 }, (_, i) => perfume(`p${i}`, `P${i}`));
    await repo.replaceAll(many);
    expect(rows.filter((r) => r.user_id === 'u1')).toHaveLength(450);
    expect(rows.find((r) => r.user_id === 'u2')).toBeDefined();
    expect(calls.filter((c) => c === 'perfumes:insert')).toHaveLength(3);
  });

  it('explica quando as tabelas não foram criadas', () => {
    expect(friendlyError({ message: 'relation "public.perfumes" does not exist', code: '42P01' }, 'carregar').message).toMatch(
      /supabase\/schema\.sql/,
    );
  });
});
