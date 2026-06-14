import './globals.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export const metadata = {
    title: 'Windikate · Investment Analysis Workflow',
    description: 'From pitch deck to partner-ready memo — onboarding, upload, intelligence, and reporting in one workspace.'
};

/* No-flash theme bootstrap — runs before React hydrates. Reads the user
 * preference from localStorage, falls back to system preference, and sets
 * the .dark class on <html> synchronously. */
const themeBootstrap = `
(function () {
    try {
        var saved = localStorage.getItem('windikate.theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var dark = saved ? saved === 'dark' : prefersDark;
        if (dark) document.documentElement.classList.add('dark');
        else      document.documentElement.classList.remove('dark');
    } catch (e) { /* ignore */ }
})();
`;

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
                <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
            </head>
            <body className="bg-surface-soft text-ink2 antialiased min-h-screen">
                {children}
            </body>
        </html>
    );
}
