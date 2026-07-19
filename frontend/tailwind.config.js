/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cyberpunk: {
          bg: "#060913",
          panel: "#090f1e",
          neon: "#00f0ff",
          accent: "#ff9d00",
          danger: "#ff1d53",
          text: "#c2f1ff",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};