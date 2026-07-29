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
      keyframes: {
        "penalty-float": {
          "0%": { opacity: "0", transform: "translateY(0)" },
          "15%": { opacity: "1", transform: "translateY(-4px)" },
          "80%": { opacity: "1", transform: "translateY(-14px)" },
          "100%": { opacity: "0", transform: "translateY(-22px)" },
        },
        "tile-pop": {
          "0%": { transform: "scale(0.85)" },
          "60%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "penalty-float": "penalty-float 1.1s ease-out forwards",
        "tile-pop": "tile-pop 220ms ease-out",
      },
    },
  },
  plugins: [],
};

