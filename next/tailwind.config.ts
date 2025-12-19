import baseConfig from "../tailwind.config";
import type { Config } from "tailwindcss";

export default {
  ...baseConfig,
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "../client/src/**/*.{js,jsx,ts,tsx}",
  ],
} satisfies Config;
