'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import ThemeToggle from './ThemeToggle';

/* ------------------------------------------------------------------
 * SidebarShell — the canonical app shell used by every authed route.
 *
 *   <SidebarShell>
 *       …page content…
 *   </SidebarShell>
 *
 * Responsibilities:
 *   · auth gate (redirects to / if no token, /onboarding if incomplete)
 *   · loads `me` and exposes user on a CSS variable for the sidebar
 *   · renders a sticky left rail (collapsible), top breadcrumb, body
 *   · admin and SAMAJ links only render for users with the right role
 *
 * Sections shown in the rail:
 *   Workspace  ─ Dashboard, New analysis, Preferences
 *   SAMAJ      ─ Digital map, Group discussion
 *   Admin      ─ Overview, Users, Settings, Usage, SAMAJ console
 * ---------------------------------------------------------------- */

const NAV = [
    {
        section: 'Workspace',
        items: [
            { href: '/dashboard',    label: 'Dashboard',     icon: 'bi-house-door' },
            { href: '/onboarding',   label: 'Preferences',   icon: 'bi-sliders' }
        ]
    },
    {
        section: 'SAMAJ',
        items: [
            { href: '/samaj',            label: 'Digital map',     icon: 'bi-globe2' },
            { href: '/samaj/discussion', label: 'Group discussion', icon: 'bi-chat-square-dots' }
        ]
    },
    {
        section: 'Admin',
        adminOnly: true,
        items: [
            { href: '/admin',          label: 'Overview',  icon: 'bi-speedometer2' },
            { href: '/admin/users',    label: 'Users',     icon: 'bi-people' },
            { href: '/admin/samaj',    label: 'SAMAJ',     icon: 'bi-people-fill' },
            { href: '/admin/settings', label: 'Settings',  icon: 'bi-gear' },
            { href: '/admin/usage',    label: 'Usage',     icon: 'bi-graph-up' }
        ]
    }
];

export default function SidebarShell({ children, requireAdmin = false, breadcrumb = null }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState(null);
    const [denied, setDenied] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const token = api.getToken();
        if (!token) { router.replace('/'); return; }
        api.me()
            .then(({ user }) => {
                if (!user.onboarded_at && pathname !== '/onboarding') { router.replace('/onboarding'); return; }
                if (requireAdmin && user.role !== 'admin') { setDenied(true); return; }
                setUser(user);
            })
            .catch(() => { api.clearToken(); router.replace('/'); });
        try {
            const saved = localStorage.getItem('windikate.sidebar.collapsed');
            if (saved === '1') setCollapsed(true);
        } catch {}
    }, [router, pathname, requireAdmin]);

    function logout() { api.clearToken(); router.replace('/'); }
    function toggleRail() {
        setCollapsed(c => {
            const next = !c;
            try { localStorage.setItem('windikate.sidebar.collapsed', next ? '1' : '0'); } catch {}
            return next;
        });
    }

    if (denied) return (
        <main className="min-h-screen flex items-center justify-center px-6 text-center">
            <div>
                <i className="bi bi-shield-exclamation text-6xl text-rose-400 block mb-4"></i>
                <h1 className="text-3xl font-bold">Admin only</h1>
                <p className="text-ink2-muted mt-2 max-w-md mx-auto">
                    Your account isn't in the admin role. Ask an existing admin to promote you from the Users tab.
                </p>
                <Link href="/dashboard" className="mt-6 inline-block px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white">
                    ← Back to dashboard
                </Link>
            </div>
        </main>
    );

    if (!user) return null;

    const isAdmin = user.role === 'admin';
    const railWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

    return (
        <div className="min-h-screen flex">
            {/* Backdrop for mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
                     onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar rail */}
            <aside
                className={`fixed md:sticky top-0 left-0 h-screen z-40 ${railWidth}
                            ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                            transition-[width,transform] duration-200
                            bg-surface border-r border-edge flex flex-col`}
            >
                {/* Brand */}
                <div className="h-16 px-4 flex items-center gap-2.5 border-b border-edge shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                        <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7l3 11 3-7 2 7 3-11"/></svg>
                        </span>
                        {!collapsed && (
                            <div className="min-w-0">
                                <div className="text-base font-semibold tracking-tight leading-none">windikate</div>
                                <div className="text-[10px] font-mono uppercase tracking-wider text-ink2-faint mt-1">analysis</div>
                            </div>
                        )}
                    </Link>
                    <button onClick={toggleRail}
                        className="hidden md:inline-flex ml-auto w-7 h-7 items-center justify-center rounded-md text-ink2-muted hover:text-ink2 hover:bg-surface-raised"
                        aria-label="Collapse sidebar"
                        title={collapsed ? 'Expand' : 'Collapse'}>
                        <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'} text-xs`} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
                    {NAV.filter(s => !s.adminOnly || isAdmin).map(section => (
                        <div key={section.section}>
                            {!collapsed && (
                                <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-ink2-faint">
                                    {section.section}
                                </div>
                            )}
                            <ul className="space-y-0.5">
                                {section.items.map(item => {
                                    const active = pathname === item.href ||
                                        (item.href !== '/dashboard' && pathname.startsWith(item.href));
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={() => setMobileOpen(false)}
                                                title={collapsed ? item.label : undefined}
                                                className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                                                    ${active
                                                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300 font-medium'
                                                        : 'text-ink2-muted hover:text-ink2 hover:bg-surface-raised'}
                                                    ${collapsed ? 'justify-center' : ''}`}
                                            >
                                                <i className={`bi ${item.icon} text-base shrink-0`} />
                                                {!collapsed && <span className="truncate">{item.label}</span>}
                                                {!collapsed && active && (
                                                    <span className="ml-auto w-1 h-4 rounded-full bg-brand-500" />
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer: theme toggle + user */}
                <div className="border-t border-edge p-3 space-y-2 shrink-0">
                    {collapsed ? <ThemeToggle compact /> : <ThemeToggle />}
                    <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : 'px-1'}`}>
                        <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-sm font-semibold text-white">
                            {(user.display_name || user.email)[0]?.toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate text-ink2">{user.display_name || user.email}</div>
                                <div className="text-[11px] text-ink2-faint truncate">{prettyRole(user.profession || user.role)}</div>
                            </div>
                        )}
                        {!collapsed && (
                            <button onClick={logout}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink2-muted hover:text-rose-400 hover:bg-rose-500/10"
                                title="Log out" aria-label="Log out">
                                <i className="bi bi-box-arrow-right text-sm" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main column */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Top breadcrumb / mobile header */}
                <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-edge h-14 flex items-center px-4 lg:px-8">
                    <button onClick={() => setMobileOpen(true)}
                        className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-md text-ink2-muted hover:text-ink2 hover:bg-surface-raised"
                        aria-label="Open menu">
                        <i className="bi bi-list text-xl" />
                    </button>
                    <div className="ml-2 md:ml-0 flex items-center gap-2 text-sm">
                        {breadcrumb || <DefaultCrumb pathname={pathname} />}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {isAdmin && (
                            <Link href="/admin/samaj"
                                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500/10 border border-brand-500/30 text-brand-600 dark:text-brand-300 text-xs font-medium hover:bg-brand-500/15">
                                <i className="bi bi-lightning-charge-fill"></i>Invite to SAMAJ
                            </Link>
                        )}
                        <ThemeToggle compact />
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full">{children}</main>
            </div>
        </div>
    );
}

function DefaultCrumb({ pathname }) {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return <span className="text-ink2-muted">Home</span>;
    return (
        <>
            {parts.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                    {i > 0 && <i className="bi bi-chevron-right text-[10px] text-ink2-faint" />}
                    <span className={i === parts.length - 1 ? 'text-ink2 font-medium' : 'text-ink2-muted'}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                </span>
            ))}
        </>
    );
}

function prettyRole(r) {
    return ({
        vc_analyst: 'VC Analyst',
        investment_associate: 'Investment Associate',
        incubator_manager: 'Incubator Manager',
        angel_investor: 'Angel Investor',
        admin: 'Administrator',
        analyst: 'Analyst'
    })[r] || 'Analyst';
}
