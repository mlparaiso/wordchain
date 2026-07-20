/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "chain-purple": "#6C5CE7",
        "chain-pink": "#FF6B9D",
        "chain-yellow": "#FFD93D",
        "chain-yellow-shadow": "#e0b800",
        "chain-green": "#4CD964",
        "chain-locked": "#2d2d3a",
      },
      fontFamily: {
        display: ["Baloo 2", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

