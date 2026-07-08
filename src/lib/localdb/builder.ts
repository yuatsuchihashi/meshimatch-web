// ============================================================
// LocalDB – supabase-js 互換のクエリビルダー (使用サブセットのみ)
// ============================================================
// アプリ内で実際に使われているチェーンだけを再現する:
//   from(t).select(sel).eq().neq().in().not("col","is",null)
//     .order().single().maybeSingle()
//   from(t).insert(v).select().single()
//   from(t).update(v).eq()
//   from(t).upsert(v, { onConflict }).select().single()
//   from(t).delete().eq().eq()
// ビルダーは PromiseLike で、await 時に execute(query) へ委譲する。
// サーバーでは直接エンジン、ブラウザでは /api/localdb 経由で実行される。
// ============================================================

export type DbFilter =
  | { op: "eq" | "neq"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] }
  | { op: "not_is_null"; column: string };

export interface DbQuery {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  values?: Record<string, unknown> | Record<string, unknown>[];
  select: string | null;
  filters: DbFilter[];
  order?: { column: string; ascending: boolean } | null;
  single?: "single" | "maybe" | null;
  onConflict?: string | null;
}

export interface DbError {
  message: string;
  code?: string;
}

export interface DbResult {
  data: unknown;
  error: DbError | null;
}

export type ExecuteFn = (query: DbQuery) => Promise<DbResult>;

class LocalQueryBuilder implements PromiseLike<DbResult> {
  private query: DbQuery;
  private execute: ExecuteFn;

  constructor(table: string, execute: ExecuteFn) {
    this.execute = execute;
    this.query = {
      table,
      action: "select",
      select: null,
      filters: [],
      order: null,
      single: null,
      onConflict: null,
    };
  }

  select(columns?: string) {
    // insert/update/upsert の後の .select() は「返り値あり」を意味する。
    // アクションが select のままなら射影文字列として扱う。
    this.query.select = columns ?? "*";
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.query.action = "insert";
    this.query.values = values;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.query.action = "update";
    this.query.values = values;
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ) {
    this.query.action = "upsert";
    this.query.values = values;
    this.query.onConflict = options?.onConflict ?? null;
    return this;
  }

  delete() {
    this.query.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.query.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.query.filters.push({ op: "neq", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.query.filters.push({ op: "in", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    // 使用箇所は .not("profile_id", "is", null) のみ
    if (operator === "is" && value === null) {
      this.query.filters.push({ op: "not_is_null", column });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.query.order = { column, ascending: options?.ascending ?? true };
    return this;
  }

  single() {
    this.query.single = "single";
    return this;
  }

  maybeSingle() {
    this.query.single = "maybe";
    return this;
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute(this.query).then(onfulfilled, onrejected);
  }
}

export function createBuilderFactory(execute: ExecuteFn) {
  return {
    from(table: string) {
      return new LocalQueryBuilder(table, execute);
    },
  };
}
