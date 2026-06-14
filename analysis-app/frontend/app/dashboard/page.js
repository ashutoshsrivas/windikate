'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import UploadZone from '../../components/UploadZone';
import ProcessingBar from '../../components/ProcessingBar';

export default function DashboardPage() {
    const router = useRouter();
    const [deck, setDeck] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [company, setCompany] = useState('');
    const [stage, setStage] = useState('Series A');
    const [aperceptOn, setAperceptOn] = useState(false);

    const [processing, setProcessing] = useState(false);
    const [finished, setFinished] = useState(false);
    const [error, setError] = useState(null);

    const [recent, setRecent] = useState(null);
    useEffect(() => { api.listAnalyses().then(d => setRecent(d.analyses || [])); }, []);

    async function startAnalysis() {
        setError(null);
        if (!deck) { setError('A pitch deck PDF is required.'); return; }

        const form = new FormData();
        form.append('deck', deck);
        if (financials) form.append('financials', financials);
        form.append('company_name', company);
        form.append('stage', stage);
        form.append('apercept_enabled', String(aperceptOn));

        setProcessing(true); setFinished(false);
        try {
            const data = await api.createAnalysis(form);
            setFinished(true);
            setTimeout(() => router.push(`/dashboard/analyses/${data.analysis.id}`), 600);
        } catch (err) {
            setError(err.body?.error || err.message);
            setProcessing(false);
        }
    }

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Start a new analysis</h1>
                <p className="mt-2 text-ink2-muted">Drop the deck, optionally a financial model — Windikate handles the rest.</p>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-5">
                    <UploadZone
                        label="Pitch deck (PDF)"
                        hint="Drag a PDF here, or click to browse. Up to 25 MB."
                        accept="application/pdf"
                        file={deck}
                        onFile={setDeck}
                    />
                    <UploadZone
                        label="Financial projections (PDF or Excel)"
                        hint="Optional. PDF, XLSX or XLS — speeds up extraction."
                        accept="application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,.xlsx"
                        file={financials}
                        onFile={setFinancials}
                    />

                    <div className="rounded-2xl border border-edge bg-surface p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-ink2-muted mb-1.5">Company name</label>
                                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Robotics"
                                    className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-edge focus:border-brand-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-ink2-muted mb-1.5">Stage</label>
                                <select value={stage} onChange={e => setStage(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-edge focus:border-brand-500 focus:outline-none">
                                    <option>Pre-seed</option><option>Seed</option><option>Series A</option><option>Series B</option><option>Series C+</option>
                                </select>
                            </div>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={aperceptOn} onChange={e => setAperceptOn(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                            <span className="text-sm">
                                Enable <span className="text-brand-300 font-medium">Apercept AI</span> simulation
                                <span className="text-ink2-faint"> · runs persona-level adoption simulation alongside the report</span>
                            </span>
                        </label>
                    </div>

                    {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3">{error}</div>}

                    {!processing ? (
                        <button onClick={startAnalysis}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-brand-600 hover:bg-brand-500 text-ink2 font-medium px-6 py-3.5 rounded-xl shadow-glow transition-all">
                            <i className="bi bi-play-fill" />Let's get it done
                        </button>
                    ) : (
                        <ProcessingBar active={processing} finished={finished} />
                    )}
                </div>

                {/* Recent analyses */}
                <aside className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink2-muted">Recent analyses</h2>
                        {recent && recent.length > 0 && <span className="text-[11px] font-mono text-ink2-faint">{recent.length}</span>}
                    </div>

                    {recent === null && (
                        <div className="rounded-xl border border-edge bg-surface p-4 text-sm text-ink2-faint">Loading…</div>
                    )}
                    {recent && recent.length === 0 && (
                        <div className="rounded-xl border border-dashed border-edge bg-surface p-6 text-center">
                            <i className="bi bi-file-earmark-text text-3xl text-ink2-faint block mb-2" />
                            <div className="text-sm text-ink2-muted">No recent analysis</div>
                            <p className="text-xs text-ink2-faint mt-1">Your reports will appear here.</p>
                        </div>
                    )}
                    {recent && recent.map(a => (
                        <Link key={a.id} href={`/dashboard/analyses/${a.id}`}
                            className="block rounded-xl border border-edge bg-surface hover:border-brand-500/30 p-4 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="font-medium text-sm truncate">{a.company_name || 'Untitled analysis'}</div>
                                <StatusBadge status={a.status} />
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-ink2-faint font-mono">
                                <span>{a.stage || '—'}</span>
                                <span>·</span>
                                <span>{new Date(a.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                {a.critical_count > 0 && <span className="text-[11px] sev-red border px-2 py-0.5 rounded-md">{a.critical_count} critical</span>}
                                {a.moderate_count > 0 && <span className="text-[11px] sev-yellow border px-2 py-0.5 rounded-md">{a.moderate_count} moderate</span>}
                            </div>
                        </Link>
                    ))}
                </aside>
            </section>
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        complete:   { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Complete' },
        processing: { cls: 'bg-brand-500/10 text-brand-300 border-brand-500/30',       label: 'Processing' },
        queued:     { cls: 'bg-surface-raised text-ink2-muted border-edge',                  label: 'Queued' },
        failed:     { cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30',          label: 'Failed' }
    };
    const m = map[status] || map.queued;
    return <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${m.cls}`}>{m.label}</span>;
}
