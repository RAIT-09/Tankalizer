import { describe, expect, it } from 'vitest';
import { DbClient } from './dbClient.js';

type RecordedStatement = {
  sql: string;
  values: unknown[];
};

class D1Stub {
  readonly statements: RecordedStatement[] = [];

  prepare(sql: string) {
    const recorded: RecordedStatement = { sql, values: [] };
    this.statements.push(recorded);

    const statement = {
      bind: (...values: unknown[]) => {
        recorded.values = values;
        return statement;
      },
      all: async () => ({ results: [], success: true, meta: {} }),
      run: async () => ({ results: [], success: true, meta: { changes: 1 } }),
    };

    return statement;
  }

  async batch() {
    return [];
  }
}

const createClient = () => {
  const d1 = new D1Stub();
  return { d1, client: new DbClient(d1 as unknown as typeof DB) };
};

describe('DbClient', () => {
  it('単一の名前付きプレースホルダを変換する', async () => {
    const { d1, client } = createClient();

    await client.query('SELECT * FROM users WHERE id = :id', { id: 'user-1' });

    expect(d1.statements).toEqual([
      { sql: 'SELECT * FROM users WHERE id = ?', values: ['user-1'] },
    ]);
  });

  it('複数の名前付きプレースホルダを出現順に変換する', async () => {
    const { d1, client } = createClient();

    await client.run('UPDATE users SET name = :name WHERE id = :id', {
      id: 'user-1',
      name: '歌人',
    });

    expect(d1.statements).toEqual([
      { sql: 'UPDATE users SET name = ? WHERE id = ?', values: ['歌人', 'user-1'] },
    ]);
  });

  it('同じプレースホルダの繰り返しをすべてbind配列へ追加する', async () => {
    const { d1, client } = createClient();

    await client.query('SELECT :user_id, :user_id, :user_id', { user_id: 'user-1' });

    expect(d1.statements).toEqual([
      { sql: 'SELECT ?, ?, ?', values: ['user-1', 'user-1', 'user-1'] },
    ]);
  });

  it('paramsにないプレースホルダは素通しする', async () => {
    const { d1, client } = createClient();

    await client.query('SELECT * FROM users WHERE id = :missing', {});

    expect(d1.statements).toEqual([
      { sql: 'SELECT * FROM users WHERE id = :missing', values: [] },
    ]);
  });

  it('bind対象の値がundefinedならD1を呼ぶ前に失敗する', async () => {
    const { d1, client } = createClient();

    await expect(client.query('SELECT * FROM users WHERE id = :id', { id: undefined })).rejects.toThrow(
      'Bind value for :id is undefined.'
    );
    expect(d1.statements).toEqual([]);
  });
});
