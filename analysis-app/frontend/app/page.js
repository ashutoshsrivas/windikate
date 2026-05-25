'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../lib/api';

/* Entry point.
 *   • no token       → show simple sign in / register inline
 *   • token + !onboarded → /onboarding
 *   • token + onboarded  → /dashboard
 */
export default function HomePage() {
    const router = useRouter();
    const [mode, setMode] = useState('login');
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = api.getToken();
        if (!token) { setBusy(false); return; }
        api.me()
            .then(({ user }) => router.replace(user.onboarded_at ? '/dashboard' : '/onboarding'))
            .catch(() => { api.clearToken(); setBusy(false); });
    }, [router]);

    async function submit(e) {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);
        const body = Object.fromEntries(form.entries());
        try {
            const fn = mode === 'login' ? api.login : api.register;
            const { token, user } = await fn(body);
            api.setToken(token);
            router.replace(user.onboarded_at ? '/dashboard' : '/onboarding');
        } catch (err) {
            setError(err.body?.error || err.message);
        }
    }

    if (busy) return <div className="min-h-screen flex items-center justify-center text-white/50">Checking session…</div>;

    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-md">
                <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7l3 11 3-7 2 7 3-11"/></svg>
                    </span>
                    <span className="text-xl font-semibold tracking-tight">windikate</span>
                </Link>

                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back.' : 'Create your workspace.'}</h1>
                    <p className="mt-2 text-white/55 text-sm">{mode === 'login' ? 'Sign in to your analysis workspace' : 'A few seconds to set up your account'}</p>
                </div>

                <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-gradient-to-br from-ink-800/80 to-ink-900/80 p-7 space-y-4">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-xs font-medium text-white/60 mb-1.5">What should Windikate call you?</label>
                            <input name="display_name" placeholder="e.g. Riya" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none" />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">Email</label>
                        <input name="email" type="email" required placeholder="you@fund.vc" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">Password</label>
                        <input name="password" type="password" required minLength={8} placeholder="••••••••" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none" />
                    </div>
                    {error && (
                        <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>
                    )}
                    <button type="submit" className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-medium px-5 py-3 rounded-xl shadow-glow transition-all">
                        {mode === 'login' ? 'Sign in' : 'Create account'}<i className="bi bi-arrow-right" />
                    </button>
                </form>

                <p className="text-center text-sm text-white/55 mt-6">
                    {mode === 'login' ? (
                        <>Don't have an account? <button onClick={() => setMode('register')} className="text-brand-300 hover:text-brand-200 font-medium">Create one →</button></>
                    ) : (
                        <>Already have one? <button onClick={() => setMode('login')} className="text-brand-300 hover:text-brand-200 font-medium">Sign in →</button></>
                    )}
                </p>
            </div>
        </main>
    );
}
