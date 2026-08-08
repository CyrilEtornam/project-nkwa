/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        nkwa: {
          50:  '#F6F2FE',
          100: '#EFE6FD',
          200: '#DDCBFB',
          600: '#7429DC',
          700: '#6322C8',
        },
        surface: '#FAF8FE',
        ink: {
          400: '#A89FBE',
          500: '#766C8A',
          700: '#433A57',
          900: '#1A1330',
        },
        service: {
          ambulance:   '#2FA86E',
          ambulanceBg: '#E1F5EA',
          fire:        '#E8772E',
          fireBg:      '#FCE6D8',
          police:      '#6322C8',
          policeBg:    '#EBE1FB',
          sos:         '#E0445B',
          sosBg:       '#FCE3E7',
        },
      },
      backgroundImage: {
        'nkwa-gradient': 'linear-gradient(135deg, #6322C8 0%, #8B3FE8 100%)',
      },
      boxShadow: {
        card:    '0 2px 10px rgba(99,34,200,0.08)',
        'card-lg': '0 8px 30px rgba(99,34,200,0.12)',
      },
      animation: {
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        'breathe':    'breathe 3.4s ease-in-out infinite',
        'screen-in':  'screenIn 0.28s ease-out both',
      },
      keyframes: {
        pulseRing: {
          '0%':   { transform: 'scale(0.9)', opacity: '0.7' },
          '70%':  { transform: 'scale(1.5)', opacity: '0'   },
          '100%': { transform: 'scale(1.5)', opacity: '0'   },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)'    },
          '50%':      { transform: 'scale(1.04)' },
        },
        screenIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'   },
        },
      },
    },
  },
  plugins: [],
}
