/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16a34a', // Green
          light: '#22c55e',
          dark: '#15803d',
        },
        secondary: {
          DEFAULT: '#f59e0b', // Amber/Accent
          light: '#fbbf24',
          dark: '#d97706',
        },
        light: {
          DEFAULT: '#f8fafc',
          lighter: '#ffffff',
          dark: '#e2e8f0',
        },
        dark: {
          DEFAULT: '#0f172a',
          light: '#1e293b',
          darker: '#020617',
        },
      },
    },
  },
  plugins: [],
}