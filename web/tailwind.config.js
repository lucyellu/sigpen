/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        console: {
          bg: "#0a0d12",
          surface: "#11151c",
          line: "#1b212c",
          dim: "#6b7382",
          ink: "#cdd5e0",
        },
        sol: {
          DEFAULT: "#e8a23c",
          dim: "#8a5f22",
        },
        terra: {
          DEFAULT: "#5fb3a3",
          dim: "#356c63",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "system-ui",
          "sans-serif",
        ],
      },
      fontFeatureSettings: {
        tnum: '"tnum"',
      },
    },
  },
  plugins: [],
};
