'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DeckCite from '../../../../../components/DeckCite';

export default function AperceptTab() {
    const [data, setData] = useState(typeof window !== 'undefined' ? window.__analysis : null);
    useEffect(() => {
        const h = e => setData(e.detail);
        window.addEventListener('analysis:loaded', h);
        if (window.__analysis) setData(window.__analysis);
        return () => window.removeEventListener('analysis:loaded', h);
    }, []);

    const apc      = data?.apercept;
    const analysis = data?.analysis;
    const enabled  = analysis?.apercept_enabled;
    const deckPath = analysis?.deck_path;

    return (
        <div className="space-y-8">
            {/* Header card — SAMAJ-aware, no broken external link */}
            <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-surface to-surface p-10 sm:p-14 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-[0.05]" />
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[280px] rounded-full bg-brand-500/20 blur-3xl" />
                <div className="relative grid grid-cols-1 md:grid-cols-[2fr_auto] items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-500 text-xs font-mono uppercase tracking-wider mb-4">
                            <i className="bi bi-cpu" />Apercept × SAMAJ
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                            Run the deck past the digital twins.
                        </h2>
                        <p className="mt-3 text-ink2-muted max-w-2xl text-sm leading-relaxed">
                            Apercept now runs on SAMAJ — Windikate's living map of consented digital twins. Each
                            approved twin reviews the pitch in their own voice, shares whether they'd adopt the
                            product, what they'd pay, and where they'd push back. You get an adoption rate, an average
                            willingness-to-pay, and a sentiment cluster — every dot citing back to its individual review.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-2.5">
                            <Link href="/samaj" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm">
                                <i className="bi bi-globe2" />Open SAMAJ map
                            </Link>
                            <Link href="/samaj/discussion" className="inline-flex items-center gap-2 border border-edge bg-surface hover:bg-surface-raised text-ink2 font-medium px-5 py-2.5 rounded-xl text-sm">
                                <i className="bi bi-chat-square-dots" />Group discussion
                            </Link>
                            {deckPath && <DeckCite deckPath={deckPath} />}
                        </div>
                    </div>
                    <div className="text-center bg-surface/70 backdrop-blur rounded-2xl border border-edge p-5 min-w-[180px]">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint">Twins available</div>
                        <div className="mt-2 text-4xl font-bold leading-none">{(typeof window !== 'undefined' && window.__samajCount) ?? '—'}</div>
                        <Link href="/admin/samaj" className="mt-2 inline-block text-[11px] text-brand-500">invite more →</Link>
                    </div>
                </div>
            </div>

            {/* Live simulation results if stored */}
            {enabled && apc ? (
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-ink2-muted">Stored simulation · this analysis</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
                        <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
                            <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint">Adoption rate estimate</div>
                            <div className="mt-3 text-[56px] font-bold leading-none bg-gradient-to-br from-brand-500 to-pink-500 bg-clip-text text-transparent">{Number(apc.adoption_rate).toFixed(1)}%</div>
                            <div className="mt-2 text-xs text-ink2-faint">across simulated personas</div>
                        </div>
                        <div className="rounded-2xl border border-edge bg-surface p-6">
                            <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint mb-3">Persona criticism</div>
                            <ul className="space-y-2.5">
                                {safe(apc.criticism).map((c, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                        <span className="text-rose-500 mt-0.5"><i className="bi bi-chat-quote-fill" /></span>
                                        <div><span className="text-ink2-faint font-mono text-[11px] mr-2">{c.persona}</span><span className="text-ink2">{c.point}</span></div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            ) : enabled ? (
                <div className="rounded-2xl border border-edge bg-surface p-6 text-sm text-ink2-muted">
                    Simulation hasn't been run yet for this deck. Open <Link href="/samaj" className="text-brand-500 hover:text-brand-400">SAMAJ</Link> and start a discussion with the deck as the prompt — results will appear here.
                </div>
            ) : (
                <div className="rounded-2xl border border-edge bg-surface p-6 text-sm text-ink2-muted">
                    Apercept wasn't enabled when this analysis was started. Run a new analysis with the toggle on, or open <Link href="/samaj" className="text-brand-500 hover:text-brand-400">SAMAJ</Link> and feed this deck to a fresh discussion.
                </div>
            )}
        </div>
    );
}

function safe(v) { if (!v) return []; if (Array.isArray(v)) return v; try { return JSON.parse(v) || []; } catch { return []; } }
