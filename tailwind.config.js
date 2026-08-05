/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{tsx,ts}',
    './hooks/**/*.{tsx,ts}',
    './services/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'cosmic-blue': 'rgb(var(--cosmic-blue-rgb) / <alpha-value>)',
        'star-purple': 'rgb(var(--star-purple-rgb) / <alpha-value>)',
        'nebula-pink': 'rgb(var(--nebula-pink-rgb) / <alpha-value>)',
        'galaxy-cyan': 'rgb(var(--galaxy-cyan-rgb) / <alpha-value>)',
        'hyper-green': 'rgb(var(--hyper-green-rgb) / <alpha-value>)',
        'solar-orange': 'rgb(var(--solar-orange-rgb) / <alpha-value>)',
      },
      fontFamily: {
        'sans': ['"Inter"', 'system-ui', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        pulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.8' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInUp: {
           '0%': { transform: 'translateY(20px)', opacity: '0' },
           '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        blurIn: {
           '0%': { filter: 'blur(12px)', opacity: '0' },
           '100%': { filter: 'blur(0)', opacity: '1' },
        },
         shake: {
            '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
            '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
            '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
            '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
        'subtle-pan': {
            '0%': { transform: 'translateX(0) translateY(0)' },
            '50%': { transform: 'translateX(5px) translateY(10px)' },
            '100%': { transform: 'translateX(0) translateY(0)' },
        },
        shimmer: {
            '0%': { backgroundPosition: '200% 0', opacity: 0.7 },
            '100%': { backgroundPosition: '-200% 0', opacity: 0.7 },
        },
        swirl: {
            'from': { transform: 'rotate(0deg) scale(1.4)', opacity: 0.4 },
            'to': { transform: 'rotate(360deg) scale(1.4)', opacity: 0 },
        },
        'ice-crack-anim': {
            '0%, 100%': { opacity: 0.9, transform: 'scale(1)' },
            '50%': { opacity: 1, transform: 'scale(1.05)' },
        },
        'pulse-glow': {
            '0%, 100%': { boxShadow: '0 0 10px 3px var(--nebula-pink)' },
            '50%': { boxShadow: '0 0 20px 8px var(--nebula-pink)' },
        },
      },
      animation: {
        pulse: 'pulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in-up': 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'blur-in': 'blurIn 0.6s ease-out forwards',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'subtle-pan': 'subtle-pan 60s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'swirl': 'swirl 4s linear infinite',
        'ice-crack-anim': 'ice-crack-anim 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 1.2s ease-in-out infinite',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
};
