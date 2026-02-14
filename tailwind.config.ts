import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: "#fdf8f0",
          100: "#f9eddb",
          200: "#f2d9b5",
          300: "#e9bf86",
          400: "#dfa055",
          500: "#d78833",
          600: "#c87029",
          700: "#a65724",
          800: "#854623",
          900: "#6c3b1f",
          950: "#3a1d0f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
