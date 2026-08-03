/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#3B0764',
        },
        accent: {
          DEFAULT: '#3B82F6',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
        },
        dark: {
          DEFAULT: '#0F0F0F',
          50: '#111111',
          100: '#161616',
          200: '#1E1E1E',
          300: '#2A2A2A',
          400: '#3F3F3F',
          500: '#555555',
          600: '#888888',
          700: '#999999',
          800: '#AAAAAA',
          900: '#BBBBBB',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
