import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "accent-1": "var(--accent-1)",
        "accent-2": "var(--accent-2)",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "var(--foreground)",
            maxWidth: "none",
            a: {
              color: "var(--accent-1)",
              "&:hover": {
                color: "var(--accent-2)",
              },
            },
            "ul > li": {
              marginTop: "0.25em",
              marginBottom: "0.25em",
            },
            "ul > li::marker": {
              color: "var(--accent-1)",
            },
            strong: {
              color: "var(--foreground)",
              fontWeight: "600",
            },
            p: {
              marginTop: "0.75em",
              marginBottom: "0.75em",
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
