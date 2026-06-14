'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import ThemeToggle from '../../../components/ThemeToggle';

export default function InviteLayout({ children }) {
    useEffect(() => {
        // Enable smooth transitions after first paint (the no-flash bootstrap
        // already applied the right theme synchronously).
        requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'));
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-edge bg-surface/80 backdrop-blur-md sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7l3 11 3-7 2 7 3-11"/></svg>
                        </span>
                        <div>
                            <div className="text-base font-semibold tracking-tight leading-none">windikate</div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-ink2-faint mt-1">SAMAJ intake</div>
                        </div>
                    </Link>
                    <ThemeToggle compact />
                </div>
            </header>
            <main className="flex-1 w-full max-w-4xl mx-auto px-6 lg:px-10 py-10">{children}</main>
            <footer className="text-center text-xs text-ink2-faint py-6">
                Windikate · SAMAJ · evidence-anchored digital-twin elicitation.
            </footer>
        </div>
    );
}
