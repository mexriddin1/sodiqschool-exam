/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: '#06113C',
        orange: '#FF8A32',
        'orange-soft': '#FFE7D2',
        grey: { lt: '#ECECEC', md: '#DBDBDB' },
        good: '#1f9d6b',
        ok: '#d9a417',
        bad: '#d24b3e',
      },
      fontFamily: {
        // Pragmatica Slab (headings) / Pragmatica (body) self-hosted as .woff2 in /public/fonts.
        // Fallback to Arial per brand guide.
        slab: ['"Pragmatica Slab"', '"Segoe UI Semibold"', 'Arial', 'sans-serif'],
        sans: ['Pragmatica', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
