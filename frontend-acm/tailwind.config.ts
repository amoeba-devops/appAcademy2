import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        accent: {
          50: 'var(--acm-accent-50)',
          100: 'var(--acm-accent-100)',
          500: 'var(--acm-accent-500)',
          600: 'var(--acm-accent-600)',
          700: 'var(--acm-accent-700)',
        },
        status: {
          'active-bg': 'var(--status-active-50)',
          'active-fg': 'var(--status-active-700)',
          'warning-bg': 'var(--status-warning-50)',
          'warning-fg': 'var(--status-warning-700)',
          'danger-bg': 'var(--status-danger-50)',
          'danger-fg': 'var(--status-danger-700)',
        },
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      spacing: {
        sidebar: '240px',
        header: '56px',
      },
    },
  },
  plugins: [],
} satisfies Config;
