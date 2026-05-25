'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DeviationCard from '../../../../components/DeviationCard';

export default function ReportTab() {
    const { id } = useParams();
    const [data, setData] = useState(typeof window !== 'undefined' ? window.__analysis : null);

    useEffect(() => {
        const handler = e => setData(e.detail);
        window.addEventListener('analysis:loaded', handler);
        if (window.__analysis) setData(window.__analysis);
        return () => window.removeEventListener('analysis:loaded', handler);
    }, []);

    if (!data) return null;
    const { metrics, deviations, competitors, questions } = data;

    function patchDeviation(updated) {
        setData(prev => ({ ...prev, deviations: prev.deviations.map(d => d.id === updated.id ? updated : d) }));
    }

    // Group questions by deviation_id for embed
    const qByDev = questions.reduce((acc, q) => {
        if (!q.deviation_id) return acc;
        (acc[q.deviation_id] = acc[q.deviation_id] || []).push(q);
        return acc;
    }, {});

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-8">
                {/* Schema-mapped metrics */}
                <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Extracted financial schema</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {metrics.map(m => (
                            <div key={m.id} className={`rounded-xl border p-3 ${m.is_missing ? 'sev-red' : 'border-white/10 bg-white/[0.02]'}`}>
                                <div className="text-[10px] font-mono uppercase tracking-wider opacity-60">{humanize(m.metric_key)}</div>
                                <div className="mt-1 font-semibold">{m.is_missing ? '— missing —' : (m.value_text || '—')}</div>
                                <div className="mt-1.5 flex items-center justify-between text-[10px] opacity-60">
                                    <span>{m.source_slide || '—'}</span>
                                    {!m.is_missing && <span className={`px-1.5 py-0.5 rounded ${confColor(m.confidence)}`}>{m.confidence}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Deviations */}
                <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Deviations · benchmarked</h2>
                    <div className="space-y-3">
                        {deviations.map(d => (
                            <DeviationCard
                                key={d.id}
                                analysisId={id}
                                deviation={d}
                                onChange={patchDeviation}
                                questions={qByDev[d.id] || []}
                            />
                        ))}
                    </div>
                </section>
            </div>

            {/* Competitor landscape */}
            <aside className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">Competitive landscape</h2>
                <div className="space-y-2">
                    {competitors.map(c => (
                        <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{c.name}</div>
                                    <div className="text-[11px] font-mono uppercase tracking-wider text-white/40">{c.relation}</div>
                                </div>
                                <a href={c.website} target="_blank" rel="noreferrer" className="text-xs text-white/40 hover:text-white"><i className="bi bi-box-arrow-up-right" /></a>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                <div className="rounded-md bg-white/5 px-2 py-1.5"><div className="text-white/40">Funding</div><div className="font-medium">${(c.funding_usd / 1e6).toFixed(1)}M</div></div>
                                <div className="rounded-md bg-white/5 px-2 py-1.5"><div className="text-white/40">Traffic / mo</div><div className="font-medium">{(c.monthly_traffic / 1000).toFixed(0)}K</div></div>
                            </div>
                            {c.features && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {safeJson(c.features).slice(0, 3).map(f => (
                                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">{f}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}

function humanize(k) { return k.replace(/_/g, ' '); }
function confColor(c) {
    return c === 'high' ? 'bg-emerald-500/20 text-emerald-300' : c === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300';
}
function safeJson(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v) || []; } catch { return []; }
}
