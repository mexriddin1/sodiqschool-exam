"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

interface Subject {
  id: string;
  key: string;   // free-form ALL_CAPS (MATH / PHYSICS / ...)
  name: string;
  order: number;
  active: boolean;
}


export default function SubjectsPage() {
  const [list, setList] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [delTarget, setDelTarget] = useState<Subject | null>(null);
  const [delPending, setDelPending] = useState(false);

  function refresh() {
    api<Subject[]>("/api/admin/subjects").then(setList).catch(() => undefined);
  }
  useEffect(refresh, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify({
          key: String(fd.get("key")).trim().toUpperCase(),
          name: String(fd.get("name")).trim(),
          order: Number(fd.get("order") || 0),
        }),
      });
      setShowForm(false);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Yaratishda xato");
    }
  }

  async function toggle(s: Subject, patch: Partial<Subject>) {
    try {
      await api(`/api/admin/subjects/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'zgartirishda xato");
    }
  }

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/subjects/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Fanlar</h1>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          <Icon name={showForm ? "x" : "plus"} size={16} />
          {showForm ? "Bekor qilish" : "Yangi fan"}
        </button>
      </div>
      <p className="text-sm text-gray-600">
        Sodiq School imtihonlaridagi fanlar ro'yxati. Imtihon yaratganda shu ro'yxatdan
        tanlanadi. Faol emas qilingan fanlar tanlash uchun ochilmaydi.
      </p>

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="label">Kalit (ALL_CAPS)</label>
              <input
                name="key"
                className="input font-mono uppercase"
                required
                pattern="[A-Z][A-Z0-9_]{1,31}"
                placeholder="masalan: PHYSICS"
                onChange={(e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""); }}
              />
            </div>
            <div>
              <label className="label">Ko'rsatiladigan nom</label>
              <input name="name" className="input" required placeholder="masalan: Fizika" />
            </div>
            <div>
              <label className="label">Tartib</label>
              <input name="order" type="number" defaultValue={list.length} className="input" />
            </div>
            <div>
              <button className="btn-primary" type="submit">Qo'shish</button>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Kalit ichki identifikator (masalan <code className="bg-gray-100 px-1 rounded">PHYSICS</code>) — faqat
            lotin katta harflar, raqamlar va <code className="bg-gray-100 px-1 rounded">_</code>. Ko'rsatiladigan nom
            har vaqt o'zbekcha bo'lishi mumkin.
          </div>
          {error && <div className="text-bad text-sm">{error}</div>}
        </form>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Nom</th>
                <th className="text-left px-4 py-2">Kalit</th>
                <th className="text-left px-4 py-2 w-24">Tartib</th>
                <th className="text-left px-4 py-2 w-32">Holat</th>
                <th className="text-right px-4 py-2 w-24">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    <input
                      className="input py-1 text-sm"
                      defaultValue={s.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== s.name) toggle(s, { name: e.target.value.trim() });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.key}</td>
                  <td className="px-4 py-2">
                    <input
                      className="input py-1 text-sm w-16"
                      type="number"
                      defaultValue={s.order}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== s.order) toggle(s, { order: v });
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={(e) => toggle(s, { active: e.target.checked })}
                      />
                      {s.active ? "Faol" : "Faol emas"}
                    </label>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(s)} variant="danger" />
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Fan yo'q.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && !showForm && <div className="text-bad text-sm">{error}</div>}

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Fanni o'chirish"
        itemLabel={delTarget?.name ?? ""}
        description="Bu fandan foydalanadigan natijalar bo'lsa, o'chirish rad etiladi. Uni faol emas qilib qo'yish tavsiya etiladi."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
