"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiException } from "@/lib/api";
import { Icon, IconButton } from "@/components/Icon";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import FilterBar, { FilterField, StatBadge } from "@/components/FilterBar";
import { Pagination, Paginated } from "@/components/Pagination";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  isActive: boolean;
  createdAt: string;
}

const PAGE_TAKE = 10;

export default function AdminUsersPage() {
  const [list, setList] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [delTarget, setDelTarget] = useState<AdminUser | null>(null);
  const [delPending, setDelPending] = useState(false);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | "ADMIN" | "EDITOR">("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [sort, setSort] = useState<"created-desc" | "name-asc" | "email-asc">("created-desc");

  function refresh() {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (role) qs.set("role", role);
    if (active) qs.set("active", active);
    qs.set("page", String(page));
    qs.set("take", String(PAGE_TAKE));
    setLoading(true);
    api<Paginated<AdminUser>>(`/api/admin/users?${qs}`)
      .then((d) => { setList(d.items); setTotal(d.total); setPages(d.pages); })
      .catch((e) => {
        if (e instanceof ApiException && e.status === 403) {
          setError("Faqat ADMIN roli boshqaruvchilarni boshqara oladi");
        }
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { setPage(1); }, [q, role, active, sort]);
  useEffect(refresh, [q, role, active, page]);

  const filtered = useMemo(() => {
    return [...list].sort((a, b) => {
      switch (sort) {
        case "name-asc": return a.fullName.localeCompare(b.fullName);
        case "email-asc": return a.email.localeCompare(b.email);
        case "created-desc": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [list, sort]);

  const stats = useMemo(() => {
    let admins = 0, editors = 0, activeN = 0, inactive = 0;
    for (const u of filtered) {
      if (u.role === "ADMIN") admins++; else editors++;
      if (u.isActive) activeN++; else inactive++;
    }
    return { admins, editors, active: activeN, inactive };
  }, [filtered]);

  const anyFilter = !!(q || role || active || sort !== "created-desc");
  function resetFilters() { setQ(""); setRole(""); setActive(""); setSort("created-desc"); }
  useEffect(() => {
    api<{ id: string }>("/api/admin/auth/me").then(setMe).catch(() => undefined);
  }, []);

  async function onDelete() {
    if (!delTarget) return;
    setDelPending(true);
    try {
      await api(`/api/admin/users/${delTarget.id}`, { method: "DELETE" });
      setDelTarget(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "O'chirishda xato");
    } finally {
      setDelPending(false);
    }
  }

  async function onEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    try {
      await api(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: String(fd.get("fullName")),
          ...(password && { password }),
        }),
      });
      setEditing(null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiException ? err.error.message : "Saqlashda xato");
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: String(fd.get("fullName")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
          role: String(fd.get("role")),
        }),
      });
      setShowForm(false);
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Saqlashda xato");
    }
  }

  async function toggle(u: AdminUser, patch: Partial<AdminUser>) {
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      refresh();
    } catch (e) {
      setError(e instanceof ApiException ? e.error.message : "Yangilashda xato");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Boshqaruvchilar</h1>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((v) => !v)}>
          <Icon name={showForm ? "x" : "plus"} size={16} />
          {showForm ? "Bekor qilish" : "Yangi qo'shish"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="label">F.I.O.</label>
            <input name="fullName" required className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Email</label>
            <input name="email" type="email" required className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Parol (kamida 8 belgi)</label>
            <input name="password" type="password" minLength={8} required className="input" />
          </div>
          <div>
            <label className="label">Rol</label>
            <select name="role" defaultValue="EDITOR" className="input">
              <option value="EDITOR">EDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div className="col-span-full">
            <button className="btn-primary inline-flex items-center gap-2" type="submit">
              <Icon name="save" size={16} /> Saqlash
            </button>
          </div>
        </form>
      )}

      {error && <div className="text-bad text-sm">{error}</div>}

      {editing && (
        <form onSubmit={onEditSubmit} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="col-span-full font-medium text-sm">
            Tahrirlash: <span className="text-gray-600">{editing.email}</span>
          </div>
          <div className="col-span-2">
            <label className="label">F.I.O.</label>
            <input name="fullName" defaultValue={editing.fullName} required className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Yangi parol (ixtiyoriy, kamida 8 belgi)</label>
            <input name="password" type="password" minLength={8} className="input" placeholder="o'zgartirmaslik uchun bo'sh qoldiring" />
          </div>
          <div className="col-span-full flex gap-2">
            <button className="btn-primary inline-flex items-center gap-2" type="submit">
              <Icon name="save" size={16} /> Saqlash
            </button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setEditing(null)}>
              <Icon name="x" size={16} /> Bekor
            </button>
          </div>
        </form>
      )}

      <FilterBar
        showReset={anyFilter}
        onReset={resetFilters}
        stats={
          <>
            <StatBadge variant="primary">{total} boshqaruvchi</StatBadge>
            {stats.admins > 0 && <StatBadge variant="good">ADMIN: {stats.admins}</StatBadge>}
            {stats.editors > 0 && <StatBadge>EDITOR: {stats.editors}</StatBadge>}
            {stats.inactive > 0 && <StatBadge variant="bad">O'chirilgan: {stats.inactive}</StatBadge>}
          </>
        }
      >
        <FilterField label="Qidirish" className="flex-1 min-w-[180px]">
          <input className="input" placeholder="ism yoki email" value={q} onChange={(e) => setQ(e.target.value)} />
        </FilterField>
        <FilterField label="Rol">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as "" | "ADMIN" | "EDITOR")}>
            <option value="">Hammasi</option>
            <option value="ADMIN">ADMIN</option>
            <option value="EDITOR">EDITOR</option>
          </select>
        </FilterField>
        <FilterField label="Holat">
          <select className="input" value={active} onChange={(e) => setActive(e.target.value as "" | "true" | "false")}>
            <option value="">Hammasi</option>
            <option value="true">Faol</option>
            <option value="false">O'chirilgan</option>
          </select>
        </FilterField>
        <FilterField label="Tartiblash">
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="created-desc">Yangi qo'shilgan ↓</option>
            <option value="name-asc">Ism A-Z</option>
            <option value="email-asc">Email A-Z</option>
          </select>
        </FilterField>
      </FilterBar>

      <div className="card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">F.I.O.</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Rol</th>
              <th className="text-left px-4 py-2">Holat</th>
              <th className="text-right px-4 py-2 w-28">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-medium">{u.fullName}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => toggle(u, { role: e.target.value as "ADMIN" | "EDITOR" })}
                    className="input py-1 text-xs"
                  >
                    <option value="EDITOR">EDITOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggle(u, { isActive: !u.isActive })}
                    className={`badge ${u.isActive ? "bg-good text-white" : "bg-gray-200 text-gray-700"}`}
                  >
                    {u.isActive ? "Faol" : "O'chirilgan"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <IconButton icon="edit" label="Tahrirlash" onClick={() => setEditing(u)} variant="primary" />
                    {me?.id !== u.id && (
                      <IconButton icon="delete" label="O'chirish" onClick={() => setDelTarget(u)} variant="danger" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                {total === 0 ? "Boshqaruvchi yo'q" : "Filtrlarga mos boshqaruvchi topilmadi."}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination page={page} take={PAGE_TAKE} total={total} pages={pages} loading={loading} onChange={setPage} />
      </div>

      <DeleteConfirmDialog
        open={!!delTarget}
        title="Boshqaruvchini o'chirish"
        itemLabel={delTarget?.fullName ?? ""}
        confirmWord={delTarget?.email ?? ""}
        description="Boshqaruvchi tizimga kira olmaydi va uning audit yozuvlari saqlanadi (adminUserId null bo'ladi)."
        pending={delPending}
        onCancel={() => setDelTarget(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
