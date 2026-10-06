import { Pool, type PoolClient } from "pg";

export type SqlParams = Record<string, unknown>;
/** A pool or a client checked out for a transaction. */
type Executor = Pick<Pool, "query">;

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function getPool() {
  if (!globalForDb.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Missing DATABASE_URL. Set it in ".env.local" (see README).');
    globalForDb.__pgPool = new Pool({ connectionString });
  }
  return globalForDb.__pgPool;
}

/** Turns `@name` placeholders into `$1..$n` and returns the matching value list. */
function toPositional(text: string, params: SqlParams) {
  const values: unknown[] = [];
  const index = new Map<string, number>();
  const sql = text.replace(/@(\w+)/g, (_, name: string) => {
    if (!(name in params)) throw new Error(`Missing SQL parameter @${name}`);
    if (!index.has(name)) {
      values.push(params[name] ?? null);
      index.set(name, values.length);
    }
    return `$${index.get(name)}`;
  });
  return { sql, values };
}

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function camelize<T>(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v])) as T;
}

async function run(text: string, params: SqlParams, tx?: PoolClient) {
  const { sql, values } = toPositional(text, params);
  const executor: Executor = tx ?? getPool();
  return executor.query(sql, values);
}

/** Runs a query and returns rows with camelCase keys (new_id -> newId). */
export async function query<T = Record<string, unknown>>(text: string, params: SqlParams = {}, tx?: PoolClient) {
  const result = await run(text, params, tx);
  return result.rows.map((r) => camelize<T>(r));
}

/** Runs a statement and returns the number of affected rows. */
export async function execute(text: string, params: SqlParams = {}, tx?: PoolClient) {
  return (await run(text, params, tx)).rowCount ?? 0;
}

export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
