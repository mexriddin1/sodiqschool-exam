"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import FilterBar, { FilterField, StatBadge } from "@/components/FilterBar";
import { Icon } from "@/components/Icon";
import { Pagination, Paginated } from "@/components/Pagination";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  prev: unknown;
  next: unknown;
  adminUser: { id: string; fullName: string; email: string } | null;
}

const ENTITY_TYPES = ["Student", "Exam", "Result", "AdminUser", "TestTemplate"];
const ACTIONS = ["create", "update", "delete", "publish", "unpublish", "archive", "reset-password"];

const PAGE_TAKE = 20;

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [q, setQ] = useState("");

  function refresh() {
    const qs = new URLSearchParams();
    if (entityType) qs.set("entityType", entityType);
    if (action) qs.set("action", action);
    if (q) qs.set("q", q);
    qs.set("page", String(page));
    qs.set("take", String(PAGE_TAKE));
    setLoading(true);
    api<Paginated<AuditEntry>>(`/api/admin/audit-logs?${qs}`)
      .then((d) => { setItems(d.items); setTotal(d.total); setPages(d.pages); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }

  useEffect(() => { setPage(1); }, [entityType, action, q]);
  useEffect(refresh, [entityType, action, q, page]);

  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    for (const r of items) byAction[r.action] = (byAction[r.action] ?? 0) + 1;
    return byAction;
  }, [items]);

  const anyFilter = !!(entityType || action || q);
  function resetFilters() { setEntityType(""); setAction(""); setQ(""); }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy">Audit jurnali</h1>

      <FilterBar
        showReset={anyFilter}
        onReset={resetFilters}
        stats={
          <>
            <StatBadge variant="primary">{total} yozuv</StatBadge>
            {Object.entries(stats).map(([a, n]) => (
              <StatBadge key={a}>{a}: {n}</StatBadge>
            ))}
          </>
        }
      >
        <FilterField label="Qidirish" className="flex-1 min-w-[180px]">
          <input className="input" placeholder="admin, obyekt, amal" value={q} onChange={(e) => setQ(e.target.value)} />
        </FilterField>
        <FilterField label="Obyekt turi">
          <select className="input" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">Hammasi</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FilterField>
        <FilterField label="Amal">
          <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Hammasi</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </FilterField>
      </FilterBar>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Vaqt</th>
                <th className="text-left px-4 py-2">Admin</th>
                <th className="text-left px-4 py-2">Amal</th>
                <th className="text-left px-4 py-2">Obyekt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Fragment key={it.id}>
                  <tr className="border-t align-top">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{new Date(it.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{it.adminUser?.fullName ?? "—"}</td>
                    <td className="px-4 py-2"><span className="badge bg-gray-100 text-gray-700">{it.action}</span></td>
                    <td className="px-4 py-2">{it.entityType} <span className="text-gray-400 font-mono text-xs">{it.entityId.slice(0, 8)}</span></td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setOpen(open === it.id ? null : it.id)} className="text-navy hover:bg-navy/10 inline-flex items-center justify-center w-8 h-8 rounded-md" title={open === it.id ? "Yopish" : "Tafsilot"} aria-label={open === it.id ? "Yopish" : "Tafsilot"}>
                        <Icon name={open === it.id ? "chevronUp" : "chevronDown"} />
                      </button>
                    </td>
                  </tr>
                  {open === it.id && (
                    <tr className="border-t bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="font-medium text-gray-600 mb-1">prev</div>
                            <pre className="bg-white p-2 rounded border overflow-auto max-h-60">{JSON.stringify(it.prev, null, 2)}</pre>
                          </div>
                          <div>
                            <div className="font-medium text-gray-600 mb-1">next</div>
                            <pre className="bg-white p-2 rounded border overflow-auto max-h-60">{JSON.stringify(it.next, null, 2)}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  {total === 0 ? "Audit jurnali bo'sh" : "Filtrlarga mos yozuv topilmadi."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} take={PAGE_TAKE} total={total} pages={pages} loading={loading} onChange={setPage} />
      </div>
    </div>
  );
}
