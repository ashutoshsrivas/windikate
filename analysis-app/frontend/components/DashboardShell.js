'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function DashboardShell({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = api.getToken();
        if (!token) { router.replace('/'); return; }
        api.me()
            .then(({ user }) => {
                if (!user.onboarded_at) { router.replace('/onboarding'); return; }
                setUser(user);
            })
            .catch(() => { api.clearToken(); router.replace('/'); });
    }, [router]);

    function logout() { api.clearToken(); router.replace('/'); }

    if (!user) return null;

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-ink-950/80 border-b border-white/5">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7l3 11 3-7 2 7 3-11"/></svg>
                        </span>
                        <span className="text-lg font-semibold tracking-tight">windikate</span>
                        <span className="ml-1.5 px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono uppercase tracking-wider text-white/60 border border-white/10">analysis</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 text-sm">
                        <Link href="/dashboard" className={`hover:text-white ${pathname === '/dashboard' ? 'text-white' : 'text-white/65'}`}>Dashboard</Link>
                        <Link href="/onboarding" className={`hover:text-white ${pathname === '/onboarding' ? 'text-white' : 'text-white/65'}`}>Preferences</Link>
                    </nav>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-sm font-semibold">
                                {(user.display_name || user.email)[0]?.toUpperCase()}
                            </div>
                            <div className="text-xs leading-tight">
                                <div className="font-medium">{user.display_name || user.email}</div>
                                <div className="text-white/45">{prettyRole(user.role)}</div>
                            </div>
                        </div>
                        <button onClick={logout} className="text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5" aria-label="Log out">
                            <i className="bi bi-box-arrow-right" />
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">{children}</main>
        </div>
    );
}

function prettyRole(r) {
    return ({
        vc_analyst: 'VC Analyst',
        investment_associate: 'Investment Associate',
        incubator_manager: 'Incubator Manager',
        angel_investor: 'Angel Investor'
    })[r] || 'Analyst';
}
