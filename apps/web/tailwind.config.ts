/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pact: {
          bg: "#07090c",
          panel: "#0d1117",
          border: "#1c2330",
          muted: "#8b9bb4",
          text: "#e8eef7",
          accent: "#3d9cf0",
          good: "#3dd68c",
          bad: "#f07178",
          warn: "#e6c07b",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Segoe UI", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["var(--font-display)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(61, 156, 240, 0.12)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(28,35,48,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(28,35,48,0.5) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
