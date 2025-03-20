// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pepe: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        background: "#121212",
        foreground: "#f8f8f8",
        card: "#1e1e1e",
        "card-foreground": "#f8f8f8",
        border: "#3a3a3a",
        input: "#2a2a2a",
      },
      animation: {
        "bounce-slow": "bounce 3s infinite",
        "spin-slow": "spin A linear",
        "pulse-slow": "pulse 4s infinite",
      },
      backgroundImage: {
        "pepe-pattern": "url('/images/pepe-pattern.png')",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
