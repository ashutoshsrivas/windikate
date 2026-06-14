'use client';

import { useEffect, useState } from 'react';

export default function AperceptTab() {
    const [data, setData] = useState(typeof window !== 'undefined' ? window.__analysis : null);
    useEffect(() => {
        const h = e => setData(e.detail);
        window.addEventListener('analysis:loaded', h);
        if (window.__analysis) setData(window.__analysis);
        return () => window.removeEventListener('analysis:loaded', h);
    }, []);

    const apc = data?.apercept;
    const enabled = data?.analysis?.apercept_enabled;

    return (
        <div className="space-y-8">
            <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-900/40 via-ink-800 to-ink-900 overflow-hidden p-10 sm:p-14 text-center relative">
                <div className="absolute inset-0 bg-grid opacity-[0.05]" />
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-brand-500/30 blur-3xl" />
                <div className="relative">
                    <h2 className="text-[36px] sm:text-[48px] font-bold tracking-tight leading-[1.1]">Apercept · Coming soon.</h2>
                    <p className="mt-3 text-ink2-muted max-w-xl mx-auto">Multi-agent behavioural simulation that predicts how the market may actually react before a single dollar goes in.</p>
                    <a href="/apercept" className="mt-7 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-ink2 font-medium px-6 py-3 rounded-xl shadow-glow transition-all" target="_blank" rel="noreferrer">
                        <i className="bi bi-arrow-up-right-square" />Open the Apercept AI page
                    </a>
                </div>
            </div>

            {enabled && apc && (
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-ink2-muted">Preview · simulation for this analysis</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
                        <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
                            <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint">Adoption rate estimate</div>
                            <div className="mt-3 text-[56px] font-bold leading-none bg-gradient-to-br from-brand-300 to-pink-400 bg-clip-text text-transparent">{Number(apc.adoption_rate).toFixed(1)}%</div>
                            <div className="mt-2 text-xs text-ink2-faint">across simulated personas</div>
                        </div>
                        <div className="rounded-2xl border border-edge bg-surface p-6">
                            <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint mb-3">Persona criticism</div>
                            <ul className="space-y-2.5">
                                {safe(apc.criticism).map((c, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm">
                                        <span className="text-rose-300 mt-0.5"><i className="bi bi-chat-quote-fill" /></span>
                                        <div><span className="text-ink2-faint font-mono text-[11px] mr-2">{c.persona}</span><span className="text-ink2">{c.point}</span></div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            )}
            {enabled && !apc && (
                <div className="rounded-2xl border border-edge bg-surface p-6 text-sm text-ink2-muted">Simulation results not yet stored. Re-run the analysis if you’ve just enabled Apercept.</div>
            )}
            {!enabled && (
                <div className="rounded-2xl border border-edge bg-surface p-6 text-sm text-ink2-muted">Apercept was not enabled for this analysis. Toggle it on when starting a new one to see persona-level adoption simulation alongside the report.</div>
            )}
        </div>
    );
}

function safe(v) { if (!v) return []; if (Array.isArray(v)) return v; try { return JSON.parse(v) || []; } catch { return []; } }
