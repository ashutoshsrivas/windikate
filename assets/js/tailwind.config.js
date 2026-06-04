/* Windikate · Studio
   Light, editorial creative-agency palette. Shared across every page. */
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
                mono:    ['JetBrains Mono', 'ui-monospace', 'monospace']
            },
            colors: {
                /* Paper · the off-white canvas the whole site lives on */
                paper: {
                    50:  '#fefdfa',
                    100: '#faf8f2',
                    200: '#f3efe5',
                    300: '#e8e2d1',
                    400: '#d6ceb8'
                },
                /* Ink · text & dark contrast surfaces */
                ink: {
                    50:  '#f5f5f4',
                    300: '#a8a29e',
                    500: '#57534e',
                    700: '#292524',
                    900: '#0c0a09',
                    950: '#050402'
                },
                /* Brand · violet stays; tuned for light backgrounds */
                brand: {
                    50:  '#f5f3ff',
                    100: '#ede9fe',
                    300: '#c4b5fd',
                    500: '#7c3aed',
                    600: '#6d28d9',
                    700: '#5b21b6'
                },
                /* Accents · used sparingly to flag categories */
                tangerine: '#f97316',
                forest:    '#0f766e',
                rose:      '#e11d48',
                sun:       '#eab308'
            },
            fontSize: {
                'display-1': ['clamp(56px, 8vw, 132px)', { lineHeight: '0.95', letterSpacing: '-0.035em' }],
                'display-2': ['clamp(40px, 5.4vw, 88px)',  { lineHeight: '1.02', letterSpacing: '-0.028em' }],
                'display-3': ['clamp(32px, 3.6vw, 56px)',  { lineHeight: '1.08', letterSpacing: '-0.02em' }]
            },
            boxShadow: {
                paper: '0 1px 0 rgba(12,10,9,0.04), 0 1px 3px rgba(12,10,9,0.04)',
                lift:  '0 18px 50px -18px rgba(12,10,9,0.18)',
                card:  '0 30px 80px -30px rgba(12,10,9,0.24)'
            },
            spacing: {
                section: '7rem'
            },
            animation: {
                'marquee': 'marquee 30s linear infinite',
                'spin-slow': 'spin 12s linear infinite'
            },
            keyframes: {
                marquee: {
                    '0%':   { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' }
                }
            }
        }
    }
};
