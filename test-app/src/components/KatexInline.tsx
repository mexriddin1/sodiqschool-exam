"use client";

// Same helper as admin's KatexInline — inline / block math via $...$ / $$...$$.

import { useEffect, useRef } from "react";

export default function KatexInline({ source, block }: { source: string; block?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const katex = await import("katex");
      if (disposed || !ref.current) return;
      const parts: { type: "text" | "block" | "inline"; content: string }[] = [];
      let buf = "";
      let mode: "text" | "block" | "inline" = "text";
      let i = 0;
      while (i < source.length) {
        const c = source[i];
        const next = source[i + 1];
        if (mode === "text" && c === "$" && next === "$") {
          if (buf) { parts.push({ type: "text", content: buf }); buf = ""; }
          mode = "block"; i += 2; continue;
        }
        if (mode === "text" && c === "$") {
          if (buf) { parts.push({ type: "text", content: buf }); buf = ""; }
          mode = "inline"; i += 1; continue;
        }
        if (mode === "block" && c === "$" && next === "$") {
          parts.push({ type: "block", content: buf }); buf = "";
          mode = "text"; i += 2; continue;
        }
        if (mode === "inline" && c === "$") {
          parts.push({ type: "inline", content: buf }); buf = "";
          mode = "text"; i += 1; continue;
        }
        buf += c; i++;
      }
      if (buf) parts.push({ type: mode === "text" ? "text" : mode, content: buf });

      ref.current.innerHTML = "";
      for (const p of parts) {
        if (p.type === "text") {
          const s = document.createElement("span");
          s.textContent = p.content;
          ref.current.appendChild(s);
        } else {
          const wrap = document.createElement("span");
          try {
            katex.default.render(p.content, wrap, { displayMode: p.type === "block", throwOnError: false });
          } catch {
            wrap.textContent = p.content;
          }
          ref.current.appendChild(wrap);
        }
      }
    })();
    return () => { disposed = true; };
  }, [source]);

  return <span ref={ref} className={block ? "block" : "inline"} />;
}
