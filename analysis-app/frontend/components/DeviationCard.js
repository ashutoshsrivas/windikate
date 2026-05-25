'use client';

import { useState } from 'react';
import { api } from '../lib/api';

const SEV_LABEL = { red: 'Critical', yellow: 'Moderate', green: 'Validated' };
const SEV_ICON  = { red: 'bi-exclamation-octagon-fill', yellow: 'bi-exclamation-triangle-fill', green: 'bi-check-circle-fill' };

export default function DeviationCard({ analysisId, deviation, onChange, questions = [] }) {
    const effective = deviation.edited_severity || deviation.severity;
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState({
        edited_severity: effective,
        analyst_citation: deviation.analyst_citation || '',
        benchmark_label: deviation.benchmark_label || '',
        benchmark_url:   deviation.benchmark_url || ''
    });

    async function save() {
        setBusy(true);
        try {
            const { deviation: updated } = await api.updateDeviation(analysisId, deviation.id, draft);
            onChange?.(updated);
            setEditing(false);
        } finally { setBusy(false); }
    }

    return (
        <article className={`rounded-2xl border bg-white/[0.02] p-5 sev-${effective}`} style={{ borderColor: 'var(--tw-shadow,initial)' }}>
            <header className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <span className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border sev-${effective}`}>
                        <i className={`bi ${SEV_ICON[effective]}`} />
                    </span>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-white leading-tight">{deviation.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono">
                            <span className={`px-2 py-0.5 rounded border sev-${effective}`}>{SEV_LABEL[effective].toUpperCase()}</span>
                            {deviation.edited_severity && <span className="text-white/45">edited · OK standard</span>}
                            {deviation.source_slide && <span className="text-white/45">· {deviation.source_slide}</span>}
                        </div>
                    </div>
                </div>
                {!editing && (
                    <button onClick={() => setEditing(true)} className="text-xs text-white/60 hover:text-white px-2.5 py-1 rounded-md hover:bg-white/5 border border-white/10">
                        <i className="bi bi-pencil mr-1" />Edit
                    </button>
                )}
            </header>

            <p className="mt-3 text-sm text-white/80 leading-relaxed">{deviation.description}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-white/55">
                <span className="inline-flex items-center gap-1.5"><i className="bi bi-bookmark" />
                    {deviation.benchmark_url
                        ? <a className="text-brand-300 hover:text-brand-200 underline" href={deviation.benchmark_url} target="_blank" rel="noreferrer">{deviation.benchmark_label}</a>
                        : <span>{deviation.benchmark_label}</span>}
                </span>
                {deviation.benchmark_value && <span className="text-white/40">target {deviation.benchmark_value}</span>}
            </div>

            {deviation.analyst_citation && !editing && (
                <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white/75">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Analyst note</div>
                    {deviation.analyst_citation}
                </div>
            )}

            {/* Embedded actionable questions linked to this deviation */}
            {questions.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                    {questions.map(q => (
                        <li key={q.id} className="flex items-start gap-2 text-white/75">
                            <i className={`bi ${q.priority === 'critical' ? 'bi-exclamation-circle-fill text-rose-400' : 'bi-arrow-right-short text-brand-300'} mt-0.5 shrink-0`} />
                            <span>{q.text}</span>
                        </li>
                    ))}
                </ul>
            )}

            {editing && (
                <div className="mt-4 p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
                    <div>
                        <label className="block text-[11px] font-mono uppercase tracking-wider text-white/45 mb-1.5">Severity (OK standard)</label>
                        <div className="flex gap-1.5">
                            {['red', 'yellow', 'green'].map(s => (
                                <button key={s} onClick={() => setDraft(d => ({ ...d, edited_severity: s }))}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md border text-xs font-medium sev-${s} ${draft.edited_severity === s ? 'ring-2 ring-offset-2 ring-offset-ink-900' : 'opacity-60'}`}>
                                    <i className={`bi ${SEV_ICON[s]} mr-1`} />{SEV_LABEL[s]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input value={draft.benchmark_label} onChange={e => setDraft(d => ({ ...d, benchmark_label: e.target.value }))}
                            placeholder="Citation label (e.g. Gartner 2025)"
                            className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none text-sm" />
                        <input value={draft.benchmark_url} onChange={e => setDraft(d => ({ ...d, benchmark_url: e.target.value }))}
                            placeholder="Citation URL"
                            className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none text-sm" />
                    </div>
                    <textarea value={draft.analyst_citation} onChange={e => setDraft(d => ({ ...d, analyst_citation: e.target.value }))}
                        rows={2} placeholder="Add your own justification (becomes the OK standard for this report)…"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none text-sm resize-none" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setEditing(false)} className="text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5">Cancel</button>
                        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-md">
                            {busy ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            )}
        </article>
    );
}
