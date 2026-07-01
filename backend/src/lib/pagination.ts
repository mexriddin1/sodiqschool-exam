import type { Request } from "express";

// Server-side pagination for list endpoints. Clients pass ?page=N&take=M;
// we clamp `take` so a runaway request can't drag in the whole table.
//
// Response shape (via `ok(res, wrapPaginated(...))`):
//   { items: T[], total, page, take, pages }
//
// Defaults are picked for a school of ~1k students / ~1k results: 50 per page
// keeps DB round-trips cheap and JSON responses under ~200 KB.

export interface PaginationInput {
  page: number;     // 1-based
  take: number;
  skip: number;     // (page - 1) * take
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  take: number;
  pages: number;
}

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

export function parsePagination(req: Request, opts?: { defaultTake?: number; maxTake?: number }): PaginationInput {
  const defTake = opts?.defaultTake ?? DEFAULT_TAKE;
  const maxTake = opts?.maxTake ?? MAX_TAKE;
  const rawPage = Number(req.query.page ?? 1);
  const rawTake = Number(req.query.take ?? defTake);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const take = Number.isFinite(rawTake) && rawTake > 0 ? Math.min(Math.floor(rawTake), maxTake) : defTake;
  return { page, take, skip: (page - 1) * take };
}

export function wrapPaginated<T>(items: T[], total: number, p: PaginationInput): Paginated<T> {
  return {
    items,
    total,
    page: p.page,
    take: p.take,
    pages: Math.max(1, Math.ceil(total / p.take)),
  };
}
