/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        "surface-bright": "var(--color-surface-bright)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        dim: "var(--color-text-dim)",
        accent: "var(--color-accent)",
        "accent-dim": "var(--color-accent-dim)",
        "accent-border": "var(--color-accent-border)",
        danger: "var(--color-danger)",
        "danger-dim": "var(--color-danger-dim)",
        "danger-solid": "var(--color-danger-solid)",
        warning: "var(--color-warning)",
        "warning-dim": "var(--color-warning-dim)",
        success: "var(--color-success)",
        "success-dim": "var(--color-success-dim)",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", "13px"],
        xs: ["11px", "15px"],
        sm: ["12px", "16px"],
        base: ["14px", "20px"],
        lg: ["16px", "24px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
      },
      letterSpacing: {
        widest: "0.18em",
      },
    },
    // Technical Brutalism: sharp corners everywhere except pill severity badges.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "100px",
      pill: "100px",
    },
  },
  plugins: [],
};
