import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        "violet-glow": "0 0 36px rgba(124, 58, 237, 0.38)"
      }
    }
  },
  plugins: []
} satisfies Config;
