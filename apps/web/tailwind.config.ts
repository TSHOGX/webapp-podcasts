import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",      /* 20px */
        md: "calc(var(--radius) - 4px)",  /* 16px */
        sm: "calc(var(--radius) - 8px)",  /* 12px */
        xl: "calc(var(--radius) + 4px)",  /* 24px */
        "2xl": "calc(var(--radius) + 12px)", /* 32px */
        "3xl": "calc(var(--radius) + 20px)", /* 40px */
      },
      boxShadow: {
        "soft": "0 2px 16px -2px hsl(var(--foreground) / 0.06)",
        "soft-lg": "0 4px 24px -4px hsl(var(--foreground) / 0.08)",
        "glow": "0 0 24px -6px hsl(var(--primary) / 0.25)",
        "inner-soft": "inset 0 2px 4px 0 hsl(var(--foreground) / 0.02)",
      },
      transitionDuration: {
        "400": "400ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
