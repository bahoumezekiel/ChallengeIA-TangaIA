/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        tanga: {
          ochre: '#C17A3B',
          'ochre-light': '#D4956A',
          'ochre-dark': '#9E5E23',
          green: '#2D5A27',
          'green-light': '#3D7A35',
          'green-dark': '#1E3D1A',
          ember: '#E8521B',
          'ember-light': '#F07040',
          'ember-dark': '#C13D0E',
          cream: '#FDF8F1',
          'cream-dark': '#F5EDE0',
          sand: '#E8D5B7',
          'sand-dark': '#D4B896',
          charcoal: '#2C2416',
          'charcoal-light': '#4A3F2F',
        },
        domain: {
          marketing: '#C17A3B',
          vente: '#2D5A27',
          admin_finance: '#1E40AF',
          support: '#7C3AED',
          autre: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'kente-pattern': "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(193,122,59,0.08) 4px, rgba(193,122,59,0.08) 8px), repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(45,90,39,0.06) 4px, rgba(45,90,39,0.06) 8px)",
        'kente-dense': "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(193,122,59,0.12) 3px, rgba(193,122,59,0.12) 6px), repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(45,90,39,0.10) 3px, rgba(45,90,39,0.10) 6px)",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
