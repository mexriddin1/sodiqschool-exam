// Assembles active LearningResource rows into the catalog shape the roadmap
// engine consumes: subject → topic → { uz[], en[] }, mirroring the bundled
// resources.json. Shipped on GET /me and threaded into buildPrograms* so the
// roadmap render surfaces admin-managed resources (compute stays pure — it
// only receives this object, never touches the DB).

import { prisma } from "../db.js";

interface CatalogResource {
  type: string;
  title: string;
  provider?: string;
  url?: string;
  note?: string;
}
type LangBucket = { uz: CatalogResource[]; en: CatalogResource[] };
export type ResourceCatalog = Record<string, Record<string, LangBucket>>;

export async function buildResourceCatalog(): Promise<ResourceCatalog> {
  const rows = await prisma.learningResource.findMany({
    where: { active: true },
    orderBy: [{ subject: "asc" }, { topic: "asc" }, { lang: "asc" }, { order: "asc" }],
  });
  const catalog: ResourceCatalog = {};
  for (const r of rows) {
    const subj = (catalog[r.subject] ??= {});
    const topic = (subj[r.topic] ??= { uz: [], en: [] });
    const lang = r.lang === "en" ? "en" : "uz";
    topic[lang].push({
      type: r.type,
      title: r.title,
      ...(r.provider ? { provider: r.provider } : {}),
      ...(r.url ? { url: r.url } : {}),
      ...(r.note ? { note: r.note } : {}),
    });
  }
  return catalog;
}
