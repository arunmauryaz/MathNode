/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mn: {
          canvas: '#161616',
          dot: '#242428',
          topbar: '#1E1E22',
          rail: '#18181B',
          drawer: '#1B1B1E',
          node: '#222227',
          nodeHeader: '#27272E',
          inset: '#141417',
          modal: '#1E1E22',
          modalTitle: '#232328',
          borderSubtle: '#2B2B32',
          borderHighlight: '#363640',
          borderFocused: '#4B78D8',
          textPrimary: '#EDEDED',
          textSecondary: '#8E8E96',
          textMuted: '#686872',
          textSuccess: '#34D399',
          btnPriBg: '#2563EB',
          btnPriHighlight: '#60A5FA',
          btnPriLip: '#1D4ED8',
          btnSecBg: '#26262B',
          btnSecHighlight: '#383840',
          btnSecLip: '#141417',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
