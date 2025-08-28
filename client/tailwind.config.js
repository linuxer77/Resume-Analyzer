/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0B0D10",
          light: "#0B0D10",
        },
        foreground: {
          DEFAULT: "#E6E8EB",
          light: "#0B0D10",
        },
        card: "#111418",
        muted: "#707A8A",
        primary: "#7C3AED",
        primaryDark: "#5B21B6",
        accent: "#22D3EE",
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(0,0,0,0.35)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
