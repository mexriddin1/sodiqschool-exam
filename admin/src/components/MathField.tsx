"use client";

// MathLive wrapper — LaTeX kiritish uchun. Prompt yozuvida va Fill-in-the-gap
// javoblarida ishlatiladi. Custom element sifatida ishlaydi, shuning uchun
// ClientOnly bo'lishi kerak (SSR paytida `HTMLElement` mavjud emas).

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

// Lazy-registers the <math-field> custom element on first mount.
let registered = false;
async function ensureRegistered() {
  if (registered || typeof window === "undefined") return;
  await import("mathlive");
  registered = true;
}

export default function MathField({ value, onChange, placeholder, ariaLabel, className }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    ensureRegistered().then(() => {
      if (disposed || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = ref.current as any;
      const handler = () => onChange(String(el.value ?? ""));
      el.addEventListener("input", handler);
      // Store off so we can remove on unmount.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).__sodiq_handler = handler;
    });
    return () => {
      disposed = true;
      const el = ref.current;
      if (!el) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = (el as any).__sodiq_handler as EventListener | undefined;
      if (h) el.removeEventListener("input", h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (el && (el as any).value !== value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).setValue?.(value) ?? ((el as any).value = value);
    }
  }, [value]);

  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — math-field is a custom element registered at runtime
    <math-field
      ref={ref as unknown as React.Ref<HTMLElement>}
      class={`math-field-input ${className ?? ""}`}
      placeholder={placeholder ?? ""}
      aria-label={ariaLabel ?? "Matematik ifoda"}
      style={{
        display: "inline-block",
        minWidth: "200px",
        padding: "6px 8px",
        border: "1px solid #d1d5db",
        borderRadius: "4px",
        background: "white",
      }}
    >
      {value}
    </math-field>
  );
}
