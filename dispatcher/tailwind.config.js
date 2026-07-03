/** @type {import('tailwindcss').Config} */

// Nkwa Dispatch console tokens — the night-watch counterpart to the caller
// app's daylight palette. Same identity (Nkwa greens, kente gold, Adinkrahene
// rings, one type trio), flipped onto a dark control-room surface.
//
// Severity colours are a reserved status palette (validated for CVD separation
// and ≥3:1 contrast on the dark surface). They always ship with an icon and a
// written label — never colour alone — and are never reused decoratively.
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
        bg:     '#0A1410',
        panel:  '#101E17',
        panel2: '#16281E',
        edge:   '#1F3629',
        edge2:  '#2C4A38',
        text: {
          hi:  '#E9F3EC',
          mid: '#9FB4A7',
          low: '#5F7568',
        },
        brand: {
          green: '#4FAA7D',
          deep:  '#0F7249',
          gold:  '#EFB93F',
          goldSoft: '#F7D070',
        },
        sev: {
          critical: '#FF5A70',
          urgent:   '#FFB020',
          ok:       '#4FAA7D',
          prank:    '#8C9DB5',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(239, 185, 63, 0.12)',
      },
      animation: {
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        'screen-in':  'screenIn 0.28s ease-out both',
        'card-in':    'cardIn 0.45s ease-out both',
      },
      keyframes: {
        pulseRing: {
          '0%':   { transform: 'scale(0.9)', opacity: '0.7' },
          '70%':  { transform: 'scale(1.6)', opacity: '0'   },
          '100%': { transform: 'scale(1.6)', opacity: '0'   },
        },
        screenIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'   },
        },
        cardIn: {
          '0%':   { opacity: '0', transform: 'translateY(-6px)', backgroundColor: 'rgba(239,185,63,0.10)' },
          '60%':  { opacity: '1', backgroundColor: 'rgba(239,185,63,0.06)' },
          '100%': { opacity: '1', transform: 'translateY(0)', backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}
