/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
            },
            colors: {
                ink: {
                    950: '#06060a',
                    900: '#0a0a12',
                    800: '#101019',
                    700: '#16161f',
                    600: '#1d1d28'
                },
                paper: {
                    50:  '#fafaf7',
                    100: '#f4f3ee',
                    200: '#e8e6dd',
                    300: '#d5d3c8',
                    400: '#a6a39a',
                    500: '#6b6a64'
                },
                brand: {
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9'
                },
                /* Semantic surface tokens driven by CSS variables so the same
                 * class renders correctly in both light and dark mode. */
                surface: {
                    DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
                    soft:    'rgb(var(--surface-soft) / <alpha-value>)',
                    raised:  'rgb(var(--surface-raised) / <alpha-value>)',
                    sunk:    'rgb(var(--surface-sunk) / <alpha-value>)'
                },
                edge: 'rgb(var(--edge) / <alpha-value>)',
                ink2: {
                    DEFAULT: 'rgb(var(--text) / <alpha-value>)',
                    muted:   'rgb(var(--text-muted) / <alpha-value>)',
                    faint:   'rgb(var(--text-faint) / <alpha-value>)'
                }
            },
            boxShadow: {
                glow: '0 0 60px -10px rgba(139, 92, 246, 0.45)',
                card: '0 30px 80px -20px rgba(0, 0, 0, 0.6)',
                soft: '0 6px 20px -8px rgba(10, 10, 18, 0.08)'
            }
        }
    },
    plugins: []
};
