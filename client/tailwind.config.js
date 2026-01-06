/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        steam: {
          bg: '#1b2838',
          'bg-dark': '#171a21',
          'bg-light': '#2a475e',
          'bg-card': '#1e2b3a',
          text: '#c7d5e0',
          'text-muted': '#8f98a0',
          accent: '#66c0f4',
          border: '#3d4f5f',
        },
        platform: {
          steam: '#1b2838',
          gamepass: '#107c10',
          eaplay: '#ff4747',
          ubisoftplus: '#0070ff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
