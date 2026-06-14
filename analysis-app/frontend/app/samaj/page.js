'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

/* SAMAJ — the digital map of every approved twin.
 *
 * Layout: each persona is a dot on an Openness-vs-Conscientiousness × Extraversion
 * plane, with the dot colour driven by archetype. Click a dot to inspect.
 *
 * This page deliberately keeps the simulation engine out — chat lives at
 * /samaj/chat/[id] and group prompts at /samaj/discussion. The next pass
 * wires those up; for now the map is read-only with a "Start chat" link. */

const ARCHETYPE_COLOR = {
    visionary: '#8b5cf6',
    builder:   '#10b981',
    scholar:   '#06b6d4',
    caregiver: '#f97316',
    skeptic:   '#ef4444',
    explorer:  '#eab308',
    steward:   '#3b82f6',
    connector: '#ec4899'
};

export default function SamajMap() {
    const [personas, setPersonas] = useState(null);
    const [active, setActive] = useState(null);
    const [filter, setFilter] = useState(null);
    const router = useRouter();

    useEffect(() => {
        api.samajApprovedPersonas().then(({ personas }) => setPersonas(personas)).catch(() => setPersonas([]));
    }, []);

    async function startChatWith(persona) {
        try {
            const { session } = await api.samajCreateSession({ mode: 'chat', persona_ids: [persona.id] });
            router.push(`/samaj/chat/${session.id}`);
        } catch (e) {
            alert(e.body?.error || e.message);
        }
    }

    if (personas === null) return <div className="text-ink2-muted">Loading the digital map…</div>;

    const archetypes = [...new Set(personas.map(p => p.archetype).filter(Boolean))];
    const visible = filter ? personas.filter(p => p.archetype === filter) : personas;

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">SAMAJ — समाज</h1>
                    <p className="text-ink2-muted mt-1">A living map of approved digital twins. Click a dot to inspect.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono uppercase text-ink2-faint">{visible.length} of {personas.length}</span>
                    <Link href="/samaj/discussion" className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium inline-flex items-center gap-2">
                        <i className="bi bi-chat-square-dots-fill" />New group discussion
                    </Link>
                </div>
            </header>

            {personas.length === 0 && (
                <div className="rounded-2xl border border-dashed border-edge bg-surface px-6 py-12 text-center">
                    <i className="bi bi-people text-5xl text-ink2-faint block mb-3" />
                    <h2 className="text-lg font-semibold">No twins on the map yet</h2>
                    <p className="text-ink2-muted text-sm mt-1">Generate an invite from the admin console to start populating SAMAJ.</p>
                    <Link href="/admin/samaj" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 text-brand-500 text-sm">
                        <i className="bi bi-shield-lock" />Admin · SAMAJ console
                    </Link>
                </div>
            )}

            {archetypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setFilter(null)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors
                            ${!filter ? 'bg-ink2 text-surface border-ink2' : 'border-edge text-ink2-muted hover:bg-surface-raised'}`}>
                        All
                    </button>
                    {archetypes.map(a => (
                        <button key={a} onClick={() => setFilter(a === filter ? null : a)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors
                                ${filter === a ? 'border-transparent text-white' : 'border-edge text-ink2-muted hover:bg-surface-raised'}`}
                            style={filter === a ? { background: ARCHETYPE_COLOR[a] || '#888' } : undefined}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ARCHETYPE_COLOR[a] || '#888' }} />
                            {a}
                        </button>
                    ))}
                </div>
            )}

            {personas.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                    <Map personas={visible} active={active} onPick={setActive} />
                    <Inspector persona={active} onChat={startChatWith} />
                </div>
            )}
        </div>
    );
}

function Map({ personas, active, onPick }) {
    return (
        <div className="relative aspect-[4/3] rounded-2xl border border-edge bg-gradient-to-br from-surface to-surface-raised overflow-hidden">
            {/* Axis labels */}
            <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-ink2-faint">↑ Openness</div>
            <div className="absolute bottom-3 left-3 text-[10px] font-mono uppercase tracking-wider text-ink2-faint">↓ Conscientiousness</div>
            <div className="absolute bottom-3 right-3 text-[10px] font-mono uppercase tracking-wider text-ink2-faint">Extraversion →</div>
            <div className="absolute top-1/2 left-3 text-[10px] font-mono uppercase tracking-wider text-ink2-faint">← Introversion</div>

            {/* Faint grid */}
            <svg viewBox="0 0 100 75" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-40">
                <line x1="50" y1="0" x2="50" y2="75" stroke="currentColor" strokeWidth="0.1" className="text-ink2-faint" />
                <line x1="0" y1="37.5" x2="100" y2="37.5" stroke="currentColor" strokeWidth="0.1" className="text-ink2-faint" />
            </svg>

            {/* Personas */}
            {personas.map(p => {
                const x = (Number(p.map_x) || 0.5) * 100;
                const y = (1 - (Number(p.map_y) || 0.5)) * 100;
                const color = ARCHETYPE_COLOR[p.archetype] || '#a78bfa';
                const isActive = active?.id === p.id;
                return (
                    <button key={p.id}
                        onClick={() => onPick(p)}
                        title={p.display_name}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${x}%`, top: `${y}%` }}>
                        <span className={`block rounded-full ${isActive ? 'ring-4 ring-white/50' : ''}`}
                              style={{ background: color, width: 18, height: 18 }} />
                        <span className={`absolute -inset-1 rounded-full opacity-50 pulse-dot`} style={{ background: color }} />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded-md bg-ink2 text-surface text-[11px] whitespace-nowrap z-10">
                            {p.display_name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function Inspector({ persona, onChat }) {
    if (!persona) return (
        <div className="rounded-2xl border border-dashed border-edge bg-surface p-6 text-sm text-ink2-muted h-full flex items-center justify-center text-center">
            Click a dot to inspect that twin.
        </div>
    );
    const tr = typeof persona.traits === 'string' ? JSON.parse(persona.traits) : (persona.traits || {});
    return (
        <div className="rounded-2xl border border-edge bg-surface p-6 space-y-4 h-fit sticky top-20">
            <div>
                <div className="text-xs font-mono uppercase tracking-wider text-ink2-faint">{persona.archetype || 'unscored'}</div>
                <h3 className="text-xl font-semibold mt-1">{persona.display_name}</h3>
                <p className="text-sm text-ink2-muted mt-1">{persona.headline || '—'}</p>
            </div>
            <div>
                <div className="text-[10px] font-mono uppercase text-ink2-faint mb-2">Big Five</div>
                {Object.entries(tr).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] w-32 text-ink2-muted capitalize">{k.replace(/_/g, ' ')}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
                            <div className="h-full bg-brand-500" style={{ width: `${v}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-ink2-faint w-6 text-right">{v}</span>
                    </div>
                ))}
            </div>
            <div className="pt-2 border-t border-edge flex items-center gap-2">
                <button onClick={() => onChat(persona)} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium">
                    <i className="bi bi-chat-dots" />Start chat
                </button>
                <Link href={`/admin/samaj`} className="px-3 py-2 rounded-lg border border-edge text-ink2-muted hover:text-ink2 text-sm" title="Manage in admin">
                    <i className="bi bi-three-dots" />
                </Link>
            </div>
        </div>
    );
}
