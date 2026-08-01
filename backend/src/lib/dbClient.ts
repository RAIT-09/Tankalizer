type QueryParams = Record<string, unknown>;

type Statement = {
  sql: string;
  params?: QueryParams;
};

export class DbClient {
  constructor(private readonly d1: typeof DB) {}

  private compile(sql: string, params: QueryParams = {}): { sql: string; values: unknown[] } {
    const values: unknown[] = [];
    const compiledSql = sql.replace(/:(\w+)/g, (placeholder, key: string) => {
      if (!Object.prototype.hasOwnProperty.call(params, key)) {
        return placeholder;
      }

      const value = params[key];
      if (value === undefined) {
        throw new Error(`Bind value for :${key} is undefined.`);
      }

      values.push(value);
      return '?';
    });

    return { sql: compiledSql, values };
  }

  async query<T>(sql: string, params?: QueryParams): Promise<T[]> {
    const compiled = this.compile(sql, params);
    const result = await this.d1.prepare(compiled.sql).bind(...compiled.values).all<T>();
    return result.results;
  }

  async run(sql: string, params?: QueryParams): Promise<{ changes: number }> {
    const compiled = this.compile(sql, params);
    const result = await this.d1.prepare(compiled.sql).bind(...compiled.values).run();
    return { changes: result.meta.changes };
  }

  batch(stmts: Statement[]) {
    const preparedStatements = stmts.map(({ sql, params }) => {
      const compiled = this.compile(sql, params);
      return this.d1.prepare(compiled.sql).bind(...compiled.values);
    });
    return this.d1.batch(preparedStatements);
  }
}
