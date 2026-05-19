/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d9efff',
          200: '#bae6fd',
          500: '#0f8fd2',
          600: '#0878b5',
          700: '#075f92',
          800: '#064d78'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 23, 42, 0.08)',
        glow: '0 24px 70px rgba(14, 165, 233, 0.18)'
      }
    }
  },
  plugins: []
}
