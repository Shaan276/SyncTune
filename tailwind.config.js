/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          purple: "hsl(270 95% 65%)",
          cyan: "hsl(190 95% 60%)",
          pink: "hsl(330 95% 60%)",
        }
      },
    },
  },
  plugins: [],
};
