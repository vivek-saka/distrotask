/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces — near-black blue, not pure black (less harsh under long viewing)
        background: '#0B0E14',
        surface: '#141925',
        'surface-raised': '#1B2230',
        border: '#2D3548',
        'border-subtle': '#1F2531',

        // Text
        foreground: '#E8EAF0',
        muted: '#8B92A8',
        'muted-foreground': '#5C6480',

        // Status signal colors — distinct from default Tailwind palette
        signal: {
          success: '#00D9A3', // COMPLETED
          running: '#5B8DEF', // RUNNING
          warning: '#FFB454', // RETRYING
          danger: '#FF6B5B', // FAILED / DEAD_LETTERED
          neutral: '#8B92A8', // PENDING / CANCELLED
          queued: '#B68CFF', // QUEUED
        },

        // Priority accent colors
        priority: {
          critical: '#FF6B5B',
          high: '#FFB454',
          normal: '#5B8DEF',
          low: '#8B92A8',
        },

        primary: {
          DEFAULT: '#00D9A3',
          foreground: '#0B0E14',
        },
        destructive: {
          DEFAULT: '#FF6B5B',
          foreground: '#0B0E14',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
        sm: '4px',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'fade-slide-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-slide-in': 'fade-slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
