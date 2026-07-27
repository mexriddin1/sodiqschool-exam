"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

type SubjectKey = "MATH" | "ENGLISH" | "CRITICAL_THINKING";
type Lang = "uz" | "en";
type ResType = "video" | "platform" | "book" | "channel" | "app";

interface Resource {
  id: string;
  subject: SubjectKey;
  topic: string;
  lang: Lang;
  type: ResType;
  title: string;
  provider: string | null;
  url: string | null;
  note: string | null;
  order: number;
  active: boolean;
}

const SUBJECTS: { key: SubjectKey; label: string }[] = [
  { key: "MATH", label: "Matematika" },
  { key: "ENGLISH", label: "Ingliz tili" },
  { key: "CRITICAL_THINKING", label: "Tanqidiy fikrlash" },
];
const SUBJECT_LABEL: Record<SubjectKey, string> = {
  MATH: "Matematika", ENGLISH: "Ingliz tili", CRITICAL_THINKING: "Tanqidiy fikrlash",
};
const TYPES: ResType[] = ["video", "platform", "book", "channel", "app"];
const TYPE_LABEL: Record<ResType, string> = {
  video: "Video", platform: "Platforma", book: "Kitob", channel: "Kanal", app: "Ilova",
};

export default function ResourcesPage() {
  const [list, setList] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterSubject, setFilterSubject] = useState<SubjectKey | "">("");
  const [filterTopic, setFilterTopic] = useState("");
  const [delTarget, setDelTarget] = useState<Resource | null>(null);
  const [delPending, setDelPending] = useState(false);

  function refresh() {
    api<Resource[]>("/api/admin/resources").then(setList).catch(() => undefined);
  }
  useEffect(refresh, []);

  // Topic suggestions: existing distinct topics + reserved keys.
  const topicOptions = useMemo(() => {
    const set = new Set<string>(["_default", "_nextLevel"]);
    for (const r of list) set.add(r.topic);
    return [...set].sort();
  }, [list]);

  const filtered = useMemo(
    () => list.filter((r) =>
      (!filterSubject || r.subject === filterSubject) &&
      (!filterTopic || r.topic.toLowerCase().includes(filterTopic.toLowerCase()))),
    [list, filterSubject, filterTopic],
  );

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/admin/resources", {
        method: "POST",
        body: JSON.stringify({
          subject: fd.get("subject"),
          topic: String(fd.get("topic")).trim(),
          lang: fd.get("lang"),
          type: fd.get("type"),
          title: String(fd.get("title")).trim(),
          provider: String(fd.get("provider") || "").trim() || undefined,
          url: String(fd.get("url") || "").trim() || undefined,
          note: String(fd.get("note") || "").trim() || undefined,
          order: Number(fd.get("order") || 0),
        }),
      });
      (e.target as HTMLFormElement).reset();
      setShowForm(false);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Yaratishda xato");
    }
  }

  async function patch(r: Resource, data: Partial<Resource>) {
    try {
      await api(`/api/admin/resources/${r.id}`, { method: "PATCH", body: JSON.stringify(data) });
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'zgartirishda xato");
    }
  }

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/resources/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Resurslar</h1>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          <Icon name={showForm ? "x" : "plus"} size={16} />
          {showForm ? "Bekor qilish" : "Yangi resurs"}
        </button>
      </div>
      <p className="text-sm text-gray-600">
        Roadmap (Rivojlanish yo'li) uchun o'quv resurslari. Har mavzudan hisobotda 2 ta o'zbekcha +
        2 ta inglizcha ko'rsatiladi. Mavzu nomi kanonik nom bilan mos bo'lsa o'sha mavzuga,
        <code className="bg-gray-100 px-1 rounded mx-1">_default</code> bo'lsa butun fanga,
        <code className="bg-gray-100 px-1 rounded mx-1">_nextLevel</code> bo'lsa keyingi daraja (A→B)
        bosqichiga biriktiriladi.
      </p>

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Fan</label>
              <select name="subject" className="input" required defaultValue="MATH">
                {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mavzu</label>
              <input name="topic" className="input" required list="topic-list" placeholder="masalan: Kasr amallari yoki _default" />
              <datalist id="topic-list">{topicOptions.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label className="label">Til</label>
              <select name="lang" className="input" required defaultValue="uz">
                <option value="uz">O'zbekcha</option>
                <option value="en">Inglizcha</option>
              </select>
            </div>
            <div>
              <label className="label">Tur</label>
              <select name="type" className="input" required defaultValue="video">
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Sarlavha</label>
              <input name="title" className="input" required placeholder="masalan: Kasrlar — qo'shish va ayirish" />
            </div>
            <div>
              <label className="label">Manba (ixtiyoriy)</label>
              <input name="provider" className="input" placeholder="masalan: Khan Academy" />
            </div>
            <div>
              <label className="label">Tartib</label>
              <input name="order" type="number" defaultValue={0} className="input" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="label">Havola (URL, ixtiyoriy)</label>
              <input name="url" type="url" className="input" placeholder="https://..." />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="label">Izoh (ixtiyoriy)</label>
              <input name="note" className="input" placeholder="qisqa izoh" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" type="submit">Qo'shish</button>
            {error && <div className="text-bad text-sm">{error}</div>}
          </div>
        </form>
      )}

      <div className="card p-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Fan bo'yicha</label>
          <select className="input py-1 text-sm" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value as SubjectKey | "")}>
            <option value="">Hammasi</option>
            {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Mavzu qidirish</label>
          <input className="input py-1 text-sm" value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} placeholder="mavzu..." />
        </div>
        <div className="text-xs text-gray-500 ml-auto">{filtered.length} ta resurs</div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Fan</th>
                <th className="text-left px-3 py-2">Mavzu</th>
                <th className="text-left px-3 py-2">Til</th>
                <th className="text-left px-3 py-2">Tur</th>
                <th className="text-left px-3 py-2">Sarlavha</th>
                <th className="text-left px-3 py-2">Manba</th>
                <th className="text-left px-3 py-2">Havola</th>
                <th className="text-left px-3 py-2 w-16">Tartib</th>
                <th className="text-left px-3 py-2 w-20">Holat</th>
                <th className="text-right px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2 text-xs">{SUBJECT_LABEL[r.subject]}</td>
                  <td className="px-3 py-2">
                    <input className="input py-1 text-xs w-32" defaultValue={r.topic}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.topic) patch(r, { topic: v }); }} />
                  </td>
                  <td className="px-3 py-2">
                    <select className="input py-1 text-xs" value={r.lang} onChange={(e) => patch(r, { lang: e.target.value as Lang })}>
                      <option value="uz">UZ</option><option value="en">EN</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select className="input py-1 text-xs" value={r.type} onChange={(e) => patch(r, { type: e.target.value as ResType })}>
                      {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input className="input py-1 text-xs w-48" defaultValue={r.title}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.title) patch(r, { title: v }); }} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="input py-1 text-xs w-28" defaultValue={r.provider ?? ""}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (r.provider ?? "")) patch(r, { provider: v }); }} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="input py-1 text-xs w-40" defaultValue={r.url ?? ""} placeholder="https://..."
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (r.url ?? "")) patch(r, { url: v }); }} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="input py-1 text-xs w-14" type="number" defaultValue={r.order}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== r.order) patch(r, { order: v }); }} />
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={r.active} onChange={(e) => patch(r, { active: e.target.checked })} />
                      {r.active ? "Faol" : "—"}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(r)} variant="danger" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">Resurs yo'q.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && !showForm && <div className="text-bad text-sm">{error}</div>}

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Resursni o'chirish"
        itemLabel={delTarget?.title ?? ""}
        confirmWord="o'chirish"
        description="Bu resurs roadmapdan olib tashlanadi. Vaqtincha yashirish uchun uni 'Faol' belgisini olib qo'ying."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
