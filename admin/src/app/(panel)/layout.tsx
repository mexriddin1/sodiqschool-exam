"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api, ApiException } from "@/lib/api";

interface Me {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "EDITOR";
}

const NAV = [
  { href: "/dashboard", label: "Bosh sahifa" },
  { href: "/students", label: "O'quvchilar" },
  { href: "/subjects", label: "Fanlar" },
  { href: "/exams", label: "Imtihonlar" },
  { href: "/test-templates", label: "Test shablonlari" },
  { href: "/results", label: "Natijalar" },
  { href: "/audit", label: "Audit jurnali" },
  { href: "/docs", label: "Namunalar (JSON)" },
  { href: "/settings", label: "Sozlamalar", adminOnly: true },
  { href: "/users", label: "Boshqaruvchilar", adminOnly: true },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  // Sidebar is off-canvas on <lg screens. Route change closes it so a nav
  // click doesn't leave the drawer covering the page.
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    api<Me>("/api/admin/auth/me")
      .then(setMe)
      .catch((e) => {
        if (e instanceof ApiException && e.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      })
      .finally(() => setLoading(false));
  }, [router, pathname]);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  async function logout() {
    await api("/api/admin/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) return <div className="p-10 text-gray-500">Yuklanmoqda…</div>;
  if (!me) return null;

  const filteredNav = NAV.filter((n) => !n.adminOnly || me.role === "ADMIN");
  const current = filteredNav.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile top bar with hamburger + current page title */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-navy text-white px-4 py-3 shadow">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? "Menyuni yopish" : "Menyuni ochish"}
          className="p-2 -ml-2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {navOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
        <div className="text-sm font-semibold truncate">{current?.label ?? "Sodiq Admin"}</div>
        <img src="/logo-white.png" alt="Sodiq School" className="h-7 w-auto" />
      </div>

      {/* Drawer scrim */}
      {navOpen && (
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Menyuni yopish"
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        className={`bg-navy text-white p-4 flex flex-col
          w-72 lg:w-60
          fixed lg:sticky lg:top-0 lg:h-screen
          inset-y-0 left-0 z-50
          transform transition-transform duration-200
          ${navOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="mb-6 flex items-center justify-between">
          <img src="/logo-white.png" alt="Sodiq School" className="h-10 w-auto" />
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Menyuni yopish"
            className="lg:hidden text-white/80 hover:text-white p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {filteredNav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block rounded px-3 py-2 text-sm ${
                  active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="text-xs text-white/60 mt-4 pt-3 border-t border-white/10">
          <div className="truncate">{me.fullName}</div>
          <div className="truncate">{me.email}</div>
          <button onClick={logout} className="mt-2 text-white/80 hover:text-white underline">
            Chiqish
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
