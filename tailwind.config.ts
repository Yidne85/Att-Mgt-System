import type { Config } from "tailwindcss";
export default {
  content: [
  "./app/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "./pages/**/*.{ts,tsx}",
  "./lib/**/*.{ts,tsx}",
],
  theme: { extend: {
      colors: {
        brand: {
          DEFAULT: "#A61C1C",
          dark: "#8E1515",
          light: "#C73434",
        },
      },
  } },
  plugins: [],
} satisfies Config;
