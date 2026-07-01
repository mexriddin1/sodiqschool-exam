"use client";

// Shared pagination footer for admin list tables. All heavy list endpoints
// return `{ items, total, page, take, pages }`; this component turns that into
// a "Oldingi / Sahifa N / M / Keyingi" bar plus a page-size indicator.
//
// Mounted at the bottom of a `<table>` container, right after `</table>`.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  take: number;
  pages: number;
}

export function Pagination({
  page,
  take,
  total,
  pages,
  loading,
  onChange,
}: {
  page: number;
  take: number;
  total: number;
  pages: number;
  loading?: boolean;
  onChange: (nextPage: number) => void;
}) {
  // Empty-list case — hide entirely; the surrounding table already renders
  // its own empty state.
  if (total === 0) return null;
  const from = (page - 1) * take + 1;
  const to = Math.min(page * take, total);
  return (
    <div className="px-4 py-3 border-t flex items-center justify-between text-sm flex-wrap gap-3">
      <span className="text-gray-500">
        {from}–{to} / <b>{total}</b> ta
      </span>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary px-3 py-1 disabled:opacity-40"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
        >Oldingi</button>
        <span className="text-gray-600 whitespace-nowrap">Sahifa {page} / {pages}</span>
        <button
          type="button"
          className="btn-secondary px-3 py-1 disabled:opacity-40"
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page >= pages || loading}
        >Keyingi</button>
      </div>
    </div>
  );
}
