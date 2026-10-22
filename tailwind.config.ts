import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oled: "#000000",
        surface: "rgba(255,255,255,0.04)",
        hairline: "rgba(255,255,255,0.08)",
        emerald: "#30D158",
        blue: "#0A84FF",
        amber: "#FF9F0A",
        ink: "#F2F3EF",
        muted: "#939993",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: ['"SF Pro Text"', '"SFMono-Regular"', "Consolas", "monospace"],
      },
      backdropBlur: { glass: "20px" },
      borderRadius: { card: "24px" },
      boxShadow: { glass: "inset 0 1px 0 rgba(255,255,255,0.025)" },
    },
  },
  plugins: [],
} satisfies Config;
