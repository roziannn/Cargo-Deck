// Runs the SQL files in ../database in order (001_..., 002_..., ...) against the database from .env.local.
// Every file is idempotent, so running all of them again is safe.
//
//   pnpm db:migrate          run every file
//   pnpm db:migrate 007      run only files from 007 onwards
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: fall back to variables already in the environment
}

const env = process.env;
const host = env.DB_HOST ?? env.PGHOST;
const database = env.DB_NAME ?? env.PGDATABASE;
if (!host || !database) {
  console.error('Missing DB_HOST / DB_NAME. Put them in ".env.local" next to package.json and run this from that folder.');
  process.exit(1);
}

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../database");
const from = (process.argv[2] ?? "").padStart(3, "0");
const files = fs
  .readdirSync(dir)
  .filter((name) => /^\d{3}_.*\.sql$/.test(name))
  .sort()
  .filter((name) => from === "000" || name.slice(0, 3) >= from);

if (files.length === 0) {
  console.error(`No SQL files found in ${dir}${from !== "000" ? ` from ${from}` : ""}.`);
  process.exit(1);
}

const client = new pg.Client({
  host,
  port: Number(env.DB_PORT ?? env.PGPORT ?? 5432),
  user: env.DB_USER ?? env.PGUSER,
  password: env.DB_PASSWORD ?? env.PGPASSWORD,
  database,
  ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`Connected to ${database} on ${host}`);

  for (const name of files) {
    const sql = fs.readFileSync(path.join(dir, name), "utf8");
    try {
      // one query string = one implicit transaction: a file either applies completely or not at all
      await client.query(sql);
      console.log(`  ok   ${name}`);
    } catch (error) {
      console.error(`  FAIL ${name}`);
      console.error(`       ${error.message}`);
      if (error.position) {
        const at = Number(error.position);
        const line = sql.slice(0, at).split("\n").length;
        console.error(`       near line ${line}: ${sql.split("\n")[line - 1]?.trim().slice(0, 100)}`);
      }
      console.error("Stopped. Nothing from this file was applied; fix the problem and run the command again.");
      process.exitCode = 1;
      break;
    }
  }
} catch (error) {
  console.error(`Could not connect: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
