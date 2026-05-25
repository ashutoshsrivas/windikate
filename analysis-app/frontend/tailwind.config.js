/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
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
                brand: {
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9'
                }
            },
            boxShadow: {
                glow: '0 0 60px -10px rgba(139, 92, 246, 0.45)',
                card: '0 30px 80px -20px rgba(0, 0, 0, 0.6)'
            }
        }
    },
    plugins: []
};
