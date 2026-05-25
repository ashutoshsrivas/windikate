import './globals.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export const metadata = {
    title: 'Windikate · Investment Analysis Workflow',
    description: 'From pitch deck to partner-ready memo — onboarding, upload, intelligence, and reporting in one workspace.'
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
            </head>
            <body className="bg-ink-950 text-white antialiased min-h-screen">
                <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                    <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-700/20 blur-[120px]" />
                    <div className="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full bg-brand-600/15 blur-[140px]" />
                    <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-900/20 blur-[100px]" />
                </div>
                <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] bg-grid" />
                {children}
            </body>
        </html>
    );
}
