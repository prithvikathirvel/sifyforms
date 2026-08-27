/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter Variable",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "var(--font-geist)",
          "Geist Variable",
          "Inter Variable",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        /**
         * Brand scales taken from the SifyForms mark: a deep plum ground that
         * graduates toward magenta, with the queen's orchid as the accent.
         *
         *   plum  - surfaces, the gradient's dark end, sidebar and hero grounds
         *   brand - single-hue primary scale centered on #521E99
         *   ink   - clean slate neutrals shared across product and public pages
         */
        plum: {
          50: "#F4F1FA",
          100: "#E9E3F5",
          200: "#D5C9EC",
          300: "#B7A4DC",
          400: "#9578C7",
          500: "#7B57B1",
          600: "#674499",
          700: "#57387E",
          800: "#4A2A6E",
          900: "#3D2459",
          950: "#26143A",
        },
        brand: {
          50: "#F7F4FB",
          100: "#EEE8F6",
          200: "#DDD0EC",
          300: "#C4ABE0",
          400: "#A47ECD",
          500: "#7B4CAF",
          600: "#521E99",
          700: "#451980",
          800: "#391669",
          900: "#2E1254",
          950: "#1D0A37",
        },
        ink: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
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
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, hsl(var(--brand-from)) 0%, hsl(var(--brand-mid)) 55%, hsl(var(--brand-to)) 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, hsl(var(--brand-from) / 0.08) 0%, hsl(var(--brand-to) / 0.14) 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}

