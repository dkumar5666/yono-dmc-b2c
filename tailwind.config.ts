import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#199ce0",
        accent: "#f5991c",
      },
    },
  },
  plugins: [],
};

export default config;
