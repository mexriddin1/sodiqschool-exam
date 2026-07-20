"use client";

// Root layout'da (yoki error.tsx yetib bormaydigan joyda) throw bo'lsa ishlaydi.
// global-error O'ZI <html>/<body> render qilishi SHART — u layout'ni almashtiradi.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[test-app] global error:", error);
  }, [error]);

  return (
    <html lang="uz">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Nimadir noto&apos;g&apos;ri ketdi</h1>
            <p style={{ color: "#555", margin: "0 0 20px", lineHeight: 1.5 }}>
              Iltimos, sahifani yangilang. Javoblaringiz saqlangan.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => reset()}
                style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "#1e2a5a", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
              >
                Qayta urinish
              </button>
              <button
                onClick={() => location.reload()}
                style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid #ccc", background: "#fff", color: "#333", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
              >
                Sahifani yangilash
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
