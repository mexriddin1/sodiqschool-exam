// Boots a local embedded Postgres for smoke testing without requiring a system
// install. Writes the data dir under .pg-data, exposes port 54399, and
// terminates the process via SIGINT/SIGTERM.

import EmbeddedPostgres from "embedded-postgres";
import { mkdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PG_PORT = Number(process.env.PG_PORT ?? 54399);
const PG_USER = process.env.PG_USER ?? "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD ?? "postgres";
const DATA_DIR = resolve(root, ".pg-data");

await mkdir(DATA_DIR, { recursive: true });

// Postgres marks a successful initdb with a PG_VERSION file. If it's there,
// we reuse the cluster; otherwise we (re-)initdb.
async function isInitialised() {
  try {
    await stat(resolve(DATA_DIR, "PG_VERSION"));
    return true;
  } catch {
    return false;
  }
}

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: PG_USER,
  password: PG_PASSWORD,
  port: PG_PORT,
  persistent: true,
  // createPostgresUser is linux-only (it runs `groupadd`/`useradd`).
  createPostgresUser: false,
  // Force UTF-8. Default Windows locale is WIN1252 which rejects √, ✓, etc.
  initdbFlags: ["--encoding=UTF8", "--no-locale"],
});

if (await isInitialised()) {
  console.log("[pg] reusing existing cluster at", DATA_DIR);
} else {
  console.log("[pg] initialising at", DATA_DIR);
  await pg.initialise();
}

console.log("[pg] starting on port", PG_PORT);
await pg.start();

// Create the smoke DB if missing.
try {
  await pg.createDatabase("sodiq_exam");
  console.log("[pg] created database sodiq_exam");
} catch (e) {
  if (!String(e?.message ?? e).match(/already exists/i)) throw e;
  console.log("[pg] database sodiq_exam already exists");
}

console.log(
  `[pg] DATABASE_URL=postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/sodiq_exam`,
);
console.log("[pg] ready. Ctrl-C to stop.");

const stop = async () => {
  console.log("\n[pg] stopping…");
  try { await pg.stop(); } catch {}
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
