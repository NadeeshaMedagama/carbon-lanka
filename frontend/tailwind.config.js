/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary accent — emerald (vibrant, modern, professional)
        carbon: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",   // bright highlight
          500: "#10b981",   // primary action
          600: "#059669",   // button / hover
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
        // Backgrounds — slate (neutral, high contrast, professional)
        forest: {
          50:   "#334155",   // slate-700  — muted element
          dark: "#020617",   // slate-950  — page background
          mid:  "#0f172a",   // slate-900  — secondary surface
          light: "#1e293b",  // slate-800  — card / panel
        },
      },
    },
  },
  plugins: [],
};
