"use client";

// Route-darajasidagi error boundary. Ilgari test-app'da HECH QANDAY error
// boundary yo'q edi — render/lifecycle'da bitta throw butun sahifani OQ qilib
// qo'yardi (Safari'da MathLive teardown shunga olib kelardi). Endi throw
// tiklanadigan ekranга aylanadi: o'quvchi qamalib qolmaydi, javoblari saqlangan.

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Safari konsolida ko'rinsin — aynan qaysi throw ekanini diagnoz qilish uchun.
    // eslint-disable-next-line no-console
    console.error("[test-app] render error:", error);
  }, [error]);

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Nimadir noto&apos;g&apos;ri ketdi</h1>
        <p style={{ color: "#555", margin: "0 0 20px", lineHeight: 1.5 }}>
          Iltimos, qayta urinib ko&apos;ring. Javoblaringiz saqlangan — davom eta olasiz.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => reset()} style={btn}>Qayta urinish</button>
          <button onClick={() => location.reload()} style={btnAlt}>Sahifani yangilash</button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};
const btn: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "none",
  background: "#1e2a5a",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
const btnAlt: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "#fff",
  color: "#333",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
