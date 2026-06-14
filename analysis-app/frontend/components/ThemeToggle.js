'use client';

import { useEffect, useState } from 'react';

/* Reads/writes the .dark class on <html> and persists to localStorage.
 * The initial value is computed from whatever the no-flash bootstrap put
 * on <html>, so the toggle is always consistent with what's rendered. */
export default function ThemeToggle({ compact = false }) {
    const [theme, setTheme] = useState('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
        // Enable smooth transitions after first paint
        requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'));
    }, []);

    function toggle() {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        if (next === 'dark') document.documentElement.classList.add('dark');
        else                 document.documentElement.classList.remove('dark');
        try { localStorage.setItem('windikate.theme', next); } catch {}
    }

    if (!mounted) {
        // Render a static placeholder of identical size before mount, so the
        // sidebar doesn't shift when the toggle hydrates.
        return <div className={compact ? 'w-8 h-8' : 'w-full h-9 rounded-lg bg-surface-raised/40'} />;
    }

    if (compact) {
        return (
            <button onClick={toggle}
                title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                aria-label="Toggle theme"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink2-muted hover:text-ink2 hover:bg-surface-raised">
                <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
            </button>
        );
    }

    return (
        <button onClick={toggle}
            className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-edge bg-surface hover:bg-surface-raised text-sm">
            <span className="inline-flex items-center gap-2.5 text-ink2">
                <i className={`bi ${theme === 'dark' ? 'bi-moon-stars-fill text-brand-300' : 'bi-sun-fill text-amber-500'}`} />
                <span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
            </span>
            <span className="text-[10px] font-mono text-ink2-faint">⌘+J</span>
        </button>
    );
}
