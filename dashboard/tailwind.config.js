/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "hsl(var(--background))",
          elevated: "hsl(var(--background-elevated))",
        },
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          muted: "hsl(var(--foreground-muted))",
          subtle: "hsl(var(--foreground-subtle))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          hover: "hsl(var(--surface-hover))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "hsl(var(--border-subtle))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          teal: "#29A19C", /* Active states, toggles ON, success */
          gold: "#E5C07B", /* Premium highlights, profits, logo */
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        serif: ["ITC Garamond Std", "Cormorant Garamond", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Signal processing animations
        "pulse-soft": "pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-urgent": "pulse-urgent 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 1.5s linear infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.3s ease-out forwards",
        "flash-success": "flash-success 0.4s ease-out",
        "dot-pulse": "dot-pulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Signal received - soft blue pulse
        "pulse-soft": {
          "0%, 100%": {
            borderColor: "rgba(96, 165, 250, 0.3)",
            boxShadow: "0 0 0 0 rgba(96, 165, 250, 0)",
          },
          "50%": {
            borderColor: "rgba(96, 165, 250, 0.8)",
            boxShadow: "0 0 20px 2px rgba(96, 165, 250, 0.3)",
          },
        },
        // Pending confirmation - urgent attention pulse
        "pulse-urgent": {
          "0%, 100%": {
            borderColor: "rgba(59, 130, 246, 0.5)",
            boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.4)",
          },
          "50%": {
            borderColor: "rgba(59, 130, 246, 1)",
            boxShadow: "0 0 25px 4px rgba(59, 130, 246, 0.5)",
          },
        },
        // Parsing - amber shimmer
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Fade in for new elements
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Slide out for dismiss
        "slide-out-right": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(100px)", opacity: "0" },
        },
        // Validated - green flash
        "flash-success": {
          "0%": { borderColor: "rgba(52, 211, 153, 0)" },
          "50%": { borderColor: "rgba(52, 211, 153, 1)" },
          "100%": { borderColor: "rgba(52, 211, 153, 0.2)" },
        },
        // Animated ellipsis dots
        "dot-pulse": {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
