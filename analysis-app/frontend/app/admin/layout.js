'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '../../lib/api';

const TABS = [
    { key: '',         label: 'Overview', icon: 'bi-speedometer2' },
    { key: 'users',    label: 'Users',    icon: 'bi-people' },
    { key: 'settings', label: 'Settings', icon: 'bi-gear' },
    { key: 'usage',    label: 'Usage',    icon: 'bi-graph-up' }
];

export default function AdminLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState(null);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        if (!api.getToken()) { router.replace('/'); return; }
        api.me()
            .then(({ user }) => {
                if (user.role !== 'admin') { setDenied(true); return; }
                setUser(user);
            })
            .catch(() => { api.clearToken(); router.replace('/'); });
    }, [router]);

    if (denied) return (
        <main className="min-h-screen flex items-center justify-center px-6 text-center">
            <div>
                <i className="bi bi-shield-exclamation text-6xl text-rose-400 block mb-4"></i>
                <h1 className="text-3xl font-bold">Admin only</h1>
                <p className="text-white/60 mt-2 max-w-md mx-auto">Your account isn’t in the admin role. Ask an existing admin to promote you from the Users tab.</p>
                <Link href="/dashboard" className="mt-6 inline-block px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500">← Back to dashboard</Link>
            </div>
        </main>
    );

    if (!user) return null;

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-ink-950/85 border-b border-white/5">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">← App</Link>
                        <h1 className="text-lg font-semibold">Admin</h1>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="text-white/65">{user.display_name || user.email}</span>
                        <span className="px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-300 text-[11px] font-mono uppercase">admin</span>
                    </div>
                </div>
                <nav className="max-w-[1400px] mx-auto px-6 lg:px-10 flex gap-1 overflow-x-auto -mb-px">
                    {TABS.map(t => {
                        const href = '/admin' + (t.key ? '/' + t.key : '');
                        const active = pathname === href || (t.key === '' && pathname === '/admin');
                        return (
                            <Link key={t.key} href={href}
                                className={`inline-flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${active ? 'border-brand-500 text-white' : 'border-transparent text-white/55 hover:text-white'}`}>
                                <i className={`bi ${t.icon}`}></i>{t.label}
                            </Link>
                        );
                    })}
                </nav>
            </header>
            <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">{children}</main>
        </div>
    );
}
