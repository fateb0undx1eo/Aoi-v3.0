import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          130: "#EFF0F3",
          160: "#EBEDEF",
          200: "#E3E5E8",
          230: "#dbdee1",
          300: "#C4C9CE",
          400: "#80848E",
          500: "#4E5058",
          600: "#949ba4",
          630: "#202225",
          700: "#17181A",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "embed-label": "#ABABAB",
        muted: "#5C5E65",
        "muted-dark": "#959BA3",
        background: {
          DEFAULT: "hsl(var(--background))",
          secondary: "#F3F3F4",
          "secondary-dark": "#37373D",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          normal: "#D9D9DC",
          "normal-dark": "#4A4A51",
        },
        blurple: {
          50: "#eef3ff",
          100: "#e0e9ff",
          200: "#c6d6ff",
          260: "#C9CDFB",
          300: "#a4b9fd",
          400: "#8093f9",
          DEFAULT: "#5865f2",
          500: "#5865f2",
          600: "#4654c0",
          700: "#3a48a3",
          800: "#2f2fa4",
          900: "#2d2f82",
          950: "#1a1a4c",
        },
        blue: {
          345: "#00a8fc",
          430: "#00a8fc",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;
