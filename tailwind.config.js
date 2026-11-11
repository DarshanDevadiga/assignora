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
        'card-hover': '0 8px 24px -4px rgba(91, 33, 246, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)',
        'card-elevated': '0 12px 32px -4px rgba(91, 33, 246, 0.10), 0 4px 12px -2px rgba(0, 0, 0, 0.05)',
        'modal': '0 24px 38px -6px rgba(15, 23, 42, 0.16), 0 10px 16px -6px rgba(91, 33, 246, 0.08)',
        'purple-glow': '0 4px 14px 0 rgba(91, 33, 246, 0.28)',
        'glow-sm': '0 2px 8px 0 rgba(91, 33, 246, 0.20)',
        'glow-md': '0 4px 16px 0 rgba(91, 33, 246, 0.28)',
        'glow-lg': '0 8px 28px -2px rgba(91, 33, 246, 0.36)',
        'glow-green': '0 2px 10px 0 rgba(16, 185, 129, 0.25)',
        'glow-amber': '0 2px 10px 0 rgba(245, 158, 11, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out forwards',
        'slide-up': 'slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-up': 'scaleUp 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmerWave 2s infinite linear',
        'subtle-pulse': 'pulseSubtle 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translate3d(0, 8px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.96) translate3d(0, 4px, 0)' },
          '100%': { opacity: '1', transform: 'scale(1) translate3d(0, 0, 0)' },
        },
        shimmerWave: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.88', transform: 'scale(0.985)' },
        },
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
