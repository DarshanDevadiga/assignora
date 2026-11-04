/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#5B21F6',
          hover: '#4C1D95',
          secondary: '#8B5CF6',
          light: '#EDE9FE',
          activeNav: '#F1EDFF',
          border: '#DDD6FE',
          bg: '#F8F9FF',
          secondaryBg: '#F5F3FF',
          surface: '#FFFFFF',
          heading: '#111827',
          body: '#374151',
          muted: '#64748B',
          line: '#E5E7EB',
          success: '#16A34A',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#2563EB',
          chart: {
            purple: '#5B21F6',
            lightPurple: '#8B5CF6',
            lavender: '#C4B5FD',
            green: '#16A34A',
            yellow: '#F59E0B',
            red: '#EF4444',
            slate: '#94A3B8'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(91, 33, 246, 0.08), 0 2px 4px -2px rgba(91, 33, 246, 0.06)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'purple-glow': '0 4px 14px 0 rgba(91, 33, 246, 0.3)',
      },
      borderRadius: {
        'card': '14px',
        'input': '9px',
        'btn': '9px',
      }
    },
  },
  plugins: [],
}
