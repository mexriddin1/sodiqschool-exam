// Standalone, PROD-SAFE seeder for the LearningResource table only. Unlike
// the full `seed.ts` (which also creates a sample exam/students/results), this
// touches ONLY learning resources — safe to run on production once, to migrate
// the bundled resources.json into the DB. Idempotent: no-op when rows exist.
//
//   npm run seed:resources --workspace backend

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = resolve(__dirname, "../../packages/compute/src/data/resources.json");

export async function seedLearningResources(prisma: PrismaClient): Promise<number> {
  const count = await prisma.learningResource.count();
  if (count > 0) {
    console.log(`= learning resources: ${count} row(s) exist — skipped`);
    return 0;
  }
  const json = JSON.parse(readFileSync(RESOURCES_PATH, "utf8")) as Record<string, unknown>;
  const SUBJECTS = ["MATH", "ENGLISH", "CRITICAL_THINKING"] as const;
  const LANGS = ["uz", "en"] as const;
  const rows: Prisma.LearningResourceCreateManyInput[] = [];
  for (const subject of SUBJECTS) {
    const subjMap = json[subject] as Record<string, { uz?: unknown[]; en?: unknown[] }> | undefined;
    if (!subjMap) continue;
    for (const [topic, byLang] of Object.entries(subjMap)) {
      for (const lang of LANGS) {
        const items = (byLang[lang] ?? []) as {
          type: string; title: string; provider?: string; url?: string; note?: string;
        }[];
        items.forEach((it, i) => {
          rows.push({
            subject,
            topic,
            lang,
            type: it.type as Prisma.LearningResourceCreateManyInput["type"],
            title: it.title,
            provider: it.provider ?? null,
            url: it.url ?? null,
            note: it.note ?? null,
            order: i,
          });
        });
      }
    }
  }
  if (rows.length === 0) return 0;
  await prisma.learningResource.createMany({ data: rows });
  console.log(`✔ learning resources: ${rows.length} row(s) seeded from resources.json`);
  return rows.length;
}

// Run directly (not when imported by seed.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  seedLearningResources(prisma)
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
