import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F2F3F5",
        paper: "#FFFFFF",
        line: "#E3E5E9",
        edge: "#8A9096",
        ink: { DEFAULT: "#16181D", muted: "#5B616B" },
        ember: { DEFAULT: "#C2410C", deep: "#9A3412", tint: "#FDEDE4" },
        amber: { ink: "#8A4B00", tint: "#FFF4E5" },
        red: { ink: "#B42318", tint: "#FEF0EE" },
        teal: { ink: "#0F766E", tint: "#E6F4F2" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { card: "12px", control: "8px", tag: "4px" },
      boxShadow: { float: "0 12px 32px -16px rgba(22, 24, 29, 0.25)" },
    },
  },
  plugins: [],
};

export default config;
