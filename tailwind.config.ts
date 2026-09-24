import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1c1917", soft: "#57534e", faint: "#a8a29e" },
        brand: { DEFAULT: "#b45309", dark: "#92400e", light: "#fef3c7" },
      },
    },
  },
  plugins: [],
};
export default config;
