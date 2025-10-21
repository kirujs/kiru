import type { Config } from "tailwindcss"

export default {
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx}",
    "../shared/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(220, 20, 60)",
        "primary-light": "rgb(228 50 86)",
      },
    },
  },
  plugins: [],
} satisfies Config
