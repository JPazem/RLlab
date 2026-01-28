import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // THIS IS THE SWITCH
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
