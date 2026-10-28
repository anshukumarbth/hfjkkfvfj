/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#f8fafc', // light canvas background (Slate 50)
          900: '#ffffff', // pure white card surface
          850: '#f1f5f9', // elevated/hover surface (Slate 100)
          800: '#e2e8f0', // subtle border (Slate 200)
          700: '#cbd5e1', // prominent border (Slate 300)
          600: '#94a3b8', // muted border / icon (Slate 400)
        },
        brand: {
          cyan: '#0284c7', // Sky 600 - accessible high-contrast on white
          electric: '#2563eb', // Blue 600
          emerald: '#059669', // Emerald 600
          amber: '#d97706', // Amber 600
          rose: '#e11d48', // Rose 600
        }
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        'glow-cyan': '0 0 20px -3px rgba(2, 132, 199, 0.2)',
        'glow-electric': '0 0 20px -3px rgba(37, 99, 235, 0.2)',
        'glow-emerald': '0 0 20px -3px rgba(5, 150, 105, 0.2)',
      }
    },
  },
  plugins: [],
};
