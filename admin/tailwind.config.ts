import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#06113C",
        orange: "#FF8A32",
        good: "#2F9E6B",
        warn: "#C98A12",
        bad: "#D2503F",
      },
    },
  },
  plugins: [],
};

export default config;
