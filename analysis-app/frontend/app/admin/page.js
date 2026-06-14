'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

export default function AdminOverview() {
    const [d, setD] = useState(null);
    const [models, setModels] = useState([]);

    useEffect(() => {
        api.adminOverview().then(setD);
        api.adminModels().then(({ models }) => setModels(models));
    }, []);

    if (!d) return <div className="text-white/50">Loading…</div>;

    const currentModel = models.find(m => m.id === d.default_model);

    return (
        <div className="space-y-8">
            {/* Headline numbers */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Spend today"     value={`$${(d.today.cents / 100).toFixed(2)}`} hint={`${d.today.calls} AI calls`} />
                <Stat label="Spend this month"value={`$${(d.month.cents / 100).toFixed(2)}`} hint={`${d.month.calls} AI calls`}
                      progress={d.month_cap_cents ? Math.min(100, d.month.cents / d.month_cap_cents * 100) : null}
                      progressLabel={d.month_cap_cents ? `cap $${(d.month_cap_cents/100).toFixed(0)}` : null} />
                <Stat label="Users"           value={d.users} />
                <Stat label="Analyses"        value={d.analyses} />
            </section>

            {/* Current default model card */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-mono uppercase tracking-wider text-white/45">Default model</div>
                    <Link href="/admin/settings" className="text-xs text-brand-300 hover:text-brand-200">Change →</Link>
                </div>
                {currentModel ? (
                    <div className="flex items-start justify-between gap-6 flex-wrap">
                        <div>
                            <div className="text-xl font-semibold">{currentModel.label}</div>
                            <div className="text-sm text-white/55 mt-1 font-mono">{currentModel.id}</div>
                            <div className="text-sm text-white/65 mt-3 max-w-md">{currentModel.good_for}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <Pill label="Input"   value={`$${currentModel.inputPer1M.toFixed(2)}/M`} />
                            <Pill label="Output"  value={`$${currentModel.outputPer1M.toFixed(2)}/M`} />
                            <Pill label="Speed"   value={currentModel.speed} />
                            <Pill label="Context" value={`${(currentModel.context/1000).toFixed(0)}k`} />
                        </div>
                    </div>
                ) : (
                    <div className="text-white/50 text-sm">No model configured.</div>
                )}
                <div className="mt-5 flex items-center gap-2 text-xs text-white/50">
                    <span className={`w-2 h-2 rounded-full ${d.bedrock_enabled ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    Bedrock {d.bedrock_enabled ? 'enabled' : 'disabled'}
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/users"    className="bg-paper-100 rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-brand-500/30 transition-colors group">
                    <i className="bi bi-people text-2xl text-brand-300 block mb-3"></i>
                    <div className="font-semibold group-hover:text-brand-200">Manage users →</div>
                    <p className="text-sm text-white/55 mt-1">Add/remove analysts, set per-user model allowlists and spend caps.</p>
                </Link>
                <Link href="/admin/settings" className="bg-paper-100 rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-brand-500/30 transition-colors group">
                    <i className="bi bi-gear text-2xl text-brand-300 block mb-3"></i>
                    <div className="font-semibold group-hover:text-brand-200">Settings →</div>
                    <p className="text-sm text-white/55 mt-1">Default model, Bedrock on/off, monthly cap.</p>
                </Link>
                <Link href="/admin/usage"    className="bg-paper-100 rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-brand-500/30 transition-colors group">
                    <i className="bi bi-graph-up text-2xl text-brand-300 block mb-3"></i>
                    <div className="font-semibold group-hover:text-brand-200">Usage →</div>
                    <p className="text-sm text-white/55 mt-1">Daily cost breakdown + per-user attribution.</p>
                </Link>
            </section>
        </div>
    );
}

function Stat({ label, value, hint, progress, progressLabel }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="text-xs font-mono uppercase tracking-wider text-white/45">{label}</div>
            <div className="mt-1 text-3xl font-bold">{value}</div>
            {hint && <div className="text-xs text-white/55 mt-1">{hint}</div>}
            {progress != null && (
                <>
                    <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-500 to-pink-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    {progressLabel && <div className="text-[11px] font-mono text-white/40 mt-1.5">{progressLabel}</div>}
                </>
            )}
        </div>
    );
}

function Pill({ label, value }) {
    return (
        <div className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2">
            <div className="text-[10px] font-mono text-white/45 uppercase">{label}</div>
            <div className="text-sm font-medium mt-0.5">{value}</div>
        </div>
    );
}
