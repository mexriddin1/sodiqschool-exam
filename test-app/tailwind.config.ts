import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#06113C",
        brandOrange: "#FF8A32",
      },
    },
  },
  plugins: [],
} satisfies Config;
