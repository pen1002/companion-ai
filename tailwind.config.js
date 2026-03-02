/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 시니어 친화적 큰 폰트 사이즈
      fontSize: {
        'senior-sm': ['18px', { lineHeight: '1.6' }],
        'senior-base': ['20px', { lineHeight: '1.6' }],
        'senior-lg': ['24px', { lineHeight: '1.5' }],
        'senior-xl': ['28px', { lineHeight: '1.4' }],
        'senior-2xl': ['32px', { lineHeight: '1.3' }],
        'senior-3xl': ['40px', { lineHeight: '1.2' }],
      },
      // 고대비 색상 팔레트
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warm: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        senior: {
          bg: '#fefce8',
          card: '#ffffff',
          text: '#1c1917',
          muted: '#57534e',
          border: '#d6d3d1',
          success: '#16a34a',
          warning: '#ea580c',
          info: '#0284c7',
        },
      },
      // 부드러운 그림자 (shadow-soft 포함!)
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
        'senior': '0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.06)',
        'senior-lg': '0 8px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
        'alarm': '0 0 0 4px rgba(239, 68, 68, 0.3), 0 8px 40px -4px rgba(239, 68, 68, 0.4)',
      },
      // 애니메이션
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'alarm-pulse': 'alarmPulse 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        alarmPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 0 0 20px rgba(239, 68, 68, 0)' },
        },
      },
      // 둥근 모서리
      borderRadius: {
        'senior': '16px',
        'senior-lg': '24px',
      },
    },
  },
  plugins: [],
};
