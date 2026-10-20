/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#F8F7F4',
          subtle: '#F2EFE9',
          card: '#FFFFFF',
          border: '#E5E2DA',
          borderDark: '#C7C2B4',
        },
        ink: {
          DEFAULT: '#181715',
          secondary: '#4A4740',
          muted: '#7E7A70',
          subtle: '#A8A49A',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        editorial: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        'ultra-wide': '0.18em',
        'super-wide': '0.25em',
      }
    },
  },
  plugins: [],
}
