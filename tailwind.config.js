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
          "TheSans",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        /**
         * Brand scales taken from the SifyForms mark: a deep plum ground that
         * graduates toward magenta, with the queen's orchid as the accent.
         *
         *   plum  - surfaces, the gradient's dark end, sidebar and hero grounds
         *   brand - the accent: buttons, links, active state, the gradient's light end
         *   ink   - neutrals, biased toward plum so greys read as chosen, not default
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
          50: "#FBF3F9",
          100: "#F6E4F1",
          200: "#EFC9E4",
          300: "#E3A3D2",
          400: "#D373BB",
          500: "#C24BA4",
          600: "#AE3690",
          700: "#8F2B76",
          800: "#75255F",
          900: "#61224F",
          950: "#3B0F2E",
        },
        ink: {
          50: "#FAF9FC",
          100: "#F3F1F7",
          200: "#E7E3EE",
          300: "#D3CDDD",
          400: "#A79FB6",
          500: "#7D758C",
          600: "#5F586D",
          700: "#4A4455",
          800: "#332F3C",
          900: "#221F29",
          950: "#15131A",
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

