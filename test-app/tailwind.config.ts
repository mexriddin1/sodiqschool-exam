import type { Config } from "tailwindcss";

// Ranglar/shriftlar globals.css dagi tokenlarga ishora qiladi — token esa
// client/src/styles/tokens.css dan ko'chirilgan. Qiymatni ikki joyda
// yozmaslik uchun var() orqali o'qiymiz: brend rangi o'zgarsa, bitta joy.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "var(--navy)",
        "navy-soft": "var(--navy-soft)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-weak": "var(--accent-weak)",
        ink: "var(--ink)",
        body: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        surface: "var(--surface)",
        inset: "var(--inset)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        pos: "var(--pos)",
        "pos-weak": "var(--pos-weak)",
        warn: "var(--warn)",
        "warn-weak": "var(--warn-weak)",
        neg: "var(--neg)",
        "neg-weak": "var(--neg-weak)",
        info: "var(--info)",
        "info-weak": "var(--info-weak)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-text)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
    },
  },
  plugins: [],
} satisfies Config;
