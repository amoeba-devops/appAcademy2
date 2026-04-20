import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          DEFAULT: "#0E1E3A",
          700: "#182B4F",
          500: "#2A4061",
        },
        gold: {
          DEFAULT: "#C9A656",
          deep: "#A8893E",
        },
        cream: {
          DEFAULT: "#FAF7EE",
          deep: "#F2ECDB",
        },
        "heraldic-gold": "#C9A656",
        "deep-ink": "#0B0D14",
        "ama-accent": "#6F4DB8",
        // Amoeba Standard Palette (admin-mode primary) — Web Style Guide v2.0 §5
        "amb-primary": {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          DEFAULT: "#6366F1",
        },
        "amb-success": "#10B981",
        "amb-warning": "#F59E0B",
        "amb-error": "#EF4444",
        "amb-info": "#3B82F6",
        // shadcn CSS variable colors
        // shadcn tokens — CSS 변수가 이미 oklch() 색상값이므로 hsl() 래퍼 제거 (FIX-260420-01)
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      fontFamily: {
        display: [
          "var(--font-noto-serif-kr)",
          "Noto Serif KR",
          "ui-serif",
          "serif",
        ],
        body: [
          "var(--font-noto-sans-kr)",
          "var(--font-inter)",
          "var(--font-noto-sans-sc)",
          "Pretendard",
          "Inter",
          "Noto Sans",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
