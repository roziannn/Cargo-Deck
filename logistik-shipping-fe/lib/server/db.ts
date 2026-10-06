import sql from "mssql";

type TypedParam = { type: sql.ISqlTypeFactoryWithNoParams | sql.ISqlType; value: unknown };
export type SqlParams = Record<string, unknown | TypedParam>;

const globalForDb = globalThis as unknown as { __mssqlPool?: Promise<sql.ConnectionPool> };

function getPool() {
  if (!globalForDb.__mssqlPool) {
    const connectionString = process.env.DB_CONNECTION_STRING;
    if (!connectionString) throw new Error('Missing DB_CONNECTION_STRING. Set it in ".env.local" (see ".env.example").');
    globalForDb.__mssqlPool = new sql.ConnectionPool(connectionString).connect().catch((err) => {
      globalForDb.__mssqlPool = undefined;
      throw err;
    });
  }
  return globalForDb.__mssqlPool;
}

export const guid = (value: string | null | undefined): TypedParam => ({ type: sql.UniqueIdentifier, value: value ?? null });

function bind(request: sql.Request, params: SqlParams) {
  for (const [name, param] of Object.entries(params)) {
    if (param && typeof param === "object" && "type" in param && "value" in param) {
      const p = param as TypedParam;
      request.input(name, p.type as sql.ISqlType, p.value);
    } else {
      request.input(name, param as never);
    }
  }
  return request;
}

export async function query<T = Record<string, unknown>>(text: string, params: SqlParams = {}, tx?: sql.Transaction) {
  const request = tx ? new sql.Request(tx) : (await getPool()).request();
  const result = await bind(request, params).query(text);
  return result.recordset as unknown as T[];
}

export async function execute(text: string, params: SqlParams = {}, tx?: sql.Transaction) {
  const request = tx ? new sql.Request(tx) : (await getPool()).request();
  const result = await bind(request, params).query(text);
  return result.rowsAffected.reduce((a, b) => a + b, 0);
}

export async function withTransaction<T>(fn: (tx: sql.Transaction) => Promise<T>) {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}
