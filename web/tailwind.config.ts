import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--sf-primary) / <alpha-value>)",
        surface: "rgb(var(--sf-surface) / <alpha-value>)",
        canvas: "rgb(var(--sf-bg) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        "card-hover": "0 4px 10px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
        popover: "0 12px 32px -8px rgb(15 23 42 / 0.22), 0 4px 12px -4px rgb(15 23 42 / 0.12)",
      },
      transitionTimingFunction: {
        "spring-out": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "none" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
        "scale-in": "scale-in 0.15s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-up": "slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
