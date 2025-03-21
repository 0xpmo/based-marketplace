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
        "hero-pattern":
          "linear-gradient(to right bottom, rgba(22, 163, 74, 0.1), rgba(22, 163, 74, 0.05)), repeating-linear-gradient(45deg, rgba(34, 197, 94, 0.05) 0px, rgba(34, 197, 94, 0.05) 2px, transparent 2px, transparent 10px)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
