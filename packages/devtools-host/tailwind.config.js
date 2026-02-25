/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{tsx,css,ts}",
    "./node_modules/devtools-shared/src/**/*.{tsx,css,ts}",
  ],
  theme: {
    extend: {
      colors: {
        crimson: "crimson",
      },
    },
  },
  plugins: [],
}
