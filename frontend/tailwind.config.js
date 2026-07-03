/** @type {import('tailwindcss').Config} */

// Nkwa design tokens.
//
// Nkwa is Twi for "life" — the palette is built on deep greens (life, and the
// colour of Ghana's health services) with kente gold as the live-signal accent.
// Red is deliberately absent from the chrome: it is reserved for genuine
// severity (CRITICAL, fire, SOS) so it never loses meaning for a caller in
// distress.
//
// Type roles:
//   display — Saira SemiCondensed: civic-signage voice for headings and badges
//   sans    — Hanken Grotesk: warm, highly legible body text
//   mono    — Spline Sans Mono: dispatch-console details (timer, step labels)
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Saira Semi Condensed"', '"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono:    ['"Spline Sans Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        nkwa: {
          50:  '#F0F7F2',
          100: '#DFEEE4',
          200: '#C0E0CD',
          300: '#8FC7A8',
          400: '#4FAA7D',
          500: '#1E8A5C',
          600: '#0F7249',
          700: '#0B5737',
          800: '#083F28',
          900: '#06301F',
        },
        gold: {
          300: '#F7D070',
          400: '#EFB93F',
          500: '#E3A414',
          600: '#B98208',
        },
        surface: '#F6F9F4',
        ink: {
          400: '#7D9083',
          500: '#5C7264',
          700: '#31473A',
          900: '#0F231A',
        },
        service: {
          ambulance:   '#0F7249',
          ambulanceBg: '#DFEEE4',
          fire:        '#D64524',
          fireBg:      '#FBE4DC',
          police:      '#2148C0',
          policeBg:    '#E2E9FB',
          sos:         '#C21E3A',
          sosBg:       '#FADEE3',
        },
      },
      backgroundImage: {
        'nkwa-gradient': 'linear-gradient(155deg, #0B5737 0%, #0F7249 100%)',
      },
      boxShadow: {
        card:      '0 2px 10px rgba(11, 87, 55, 0.07)',
        'card-lg': '0 10px 32px rgba(11, 87, 55, 0.14)',
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
