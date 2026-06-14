'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../lib/api';

const FORMATS = [
    { value: 'mckinsey', label: 'McKinsey-style',              hint: 'Situation · Complication · Question · Answer' },
    { value: 'bcg',      label: 'BCG-style',                   hint: 'Insight · Implication · Action' },
    { value: 'yc',       label: 'Y Combinator Application',    hint: 'YC long-form Q&A structure' },
    { value: 'custom',   label: 'Custom Template',             hint: 'Upload your own .md template' }
];

const INCLUSIONS = [
    { key: 'deviation_analysis',          label: 'Deviation analysis' },
    { key: 'meeting_transcript_excerpts', label: 'Meeting transcript excerpts' },
    { key: 'competitive_landscape_map',   label: 'Competitive landscape map' },
    { key: 'apercept_simulation',         label: 'Apercept AI adoption simulation' }
];

const RECOMMENDATIONS = [
    { value: 'pass',            label: 'Pass',             tone: 'rose' },
    { value: 'deep_dive',       label: 'Deep Dive',        tone: 'amber' },
    { value: 'partner_meeting', label: 'Partner Meeting',  tone: 'emerald' }
];

export default function MemoTab() {
    const { id } = useParams();
    const [analysis, setAnalysis] = useState(typeof window !== 'undefined' ? window.__analysis : null);
    useEffect(() => {
        const h = e => setAnalysis(e.detail);
        window.addEventListener('analysis:loaded', h);
        return () => window.removeEventListener('analysis:loaded', h);
    }, []);

    const [format, setFormat] = useState('mckinsey');
    const [customTemplate, setCustomTemplate] = useState('');
    const [include, setInclude] = useState({
        deviation_analysis: true,
        meeting_transcript_excerpts: false,
        competitive_landscape_map: true,
        apercept_simulation: !!analysis?.analysis?.apercept_enabled
    });
    const [recommendation, setRecommendation] = useState('deep_dive');
    const [busy, setBusy] = useState(false);
    const [memo, setMemo] = useState(null);
    const [error, setError] = useState(null);

    function toggleInclude(k) { setInclude(s => ({ ...s, [k]: !s[k] })); }

    async function readTemplate(file) {
        if (!file) return;
        setCustomTemplate(await file.text());
    }

    async function generate() {
        setBusy(true); setError(null); setMemo(null);
        try {
            const { memo } = await api.generateMemo(id, {
                format,
                recommendation,
                include,
                custom_template: format === 'custom' ? customTemplate : null
            });
            setMemo(memo);
        } catch (err) {
            setError(err.body?.error || err.message);
        } finally { setBusy(false); }
    }

    function copyMemo() {
        if (!memo) return;
        navigator.clipboard?.writeText(memo.content);
    }
    function downloadMemo() {
        if (!memo) return;
        const blob = new Blob([memo.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${analysis?.analysis?.company_name || 'memo'}-${memo.format}.md`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
            <section className="space-y-5">
                <div className="rounded-2xl border border-edge bg-surface p-6">
                    <h2 className="text-lg font-semibold">Generate Investment Memo</h2>
                    <p className="text-sm text-ink2-muted mt-1">One-click institutional reporting. Pick a format and what to include.</p>

                    <div className="mt-5 space-y-2">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint">Format</div>
                        {FORMATS.map(f => (
                            <label key={f.value} className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${format === f.value ? 'border-brand-500 bg-brand-500/10' : 'border-edge bg-surface-raised hover:bg-surface-raised'}`}>
                                <input type="radio" name="format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} className="mt-1 accent-brand-500" />
                                <div className="flex-1">
                                    <div className="font-medium text-sm">{f.label}</div>
                                    <div className="text-xs text-ink2-muted">{f.hint}</div>
                                </div>
                            </label>
                        ))}
                        {format === 'custom' && (
                            <div className="ml-7 mt-2">
                                <label className="inline-flex items-center gap-2 text-xs text-ink2-muted cursor-pointer">
                                    <span className="px-3 py-1.5 rounded-md bg-surface-raised border border-edge hover:bg-surface-raised"><i className="bi bi-upload mr-1" />Upload .md template</span>
                                    <input type="file" accept=".md,.txt" className="hidden" onChange={e => readTemplate(e.target.files?.[0])} />
                                </label>
                                {customTemplate && <span className="text-[10px] font-mono text-emerald-400 ml-2">template loaded · {customTemplate.length} chars</span>}
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint mb-2">Include</div>
                        <div className="space-y-1.5">
                            {INCLUSIONS.map(item => (
                                <label key={item.key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-edge cursor-pointer hover:bg-surface-raised">
                                    <input type="checkbox" checked={!!include[item.key]} onChange={() => toggleInclude(item.key)} className="w-4 h-4 accent-brand-500" />
                                    <span className="text-sm">{item.label}</span>
                                    {item.key === 'apercept_simulation' && !analysis?.analysis?.apercept_enabled &&
                                        <span className="ml-auto text-[10px] font-mono text-ink2-faint">Apercept not enabled for this analysis</span>}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint mb-2">Recommendation</div>
                        <div className="grid grid-cols-3 gap-2">
                            {RECOMMENDATIONS.map(r => (
                                <button key={r.value} onClick={() => setRecommendation(r.value)}
                                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${recommendation === r.value ? `bg-${r.tone}-500/15 border-${r.tone}-500/40 text-${r.tone}-300` : 'bg-surface-raised border-edge text-ink2-muted hover:bg-surface-raised'}`}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <div className="mt-4 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

                    <button onClick={generate} disabled={busy} className="mt-6 w-full inline-flex items-center justify-center gap-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-ink2 font-medium px-5 py-3 rounded-xl shadow-glow transition-all">
                        {busy ? <><i className="bi bi-arrow-repeat animate-spin" />Generating…</> : <><i className="bi bi-stars" />Generate Memo</>}
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-ink2-muted">Preview</h2>
                    {memo && (
                        <div className="flex items-center gap-1.5">
                            <button onClick={copyMemo} className="text-xs px-2.5 py-1.5 rounded-md bg-surface-raised hover:bg-surface-raised border border-edge"><i className="bi bi-clipboard mr-1" />Copy</button>
                            <button onClick={downloadMemo} className="text-xs px-2.5 py-1.5 rounded-md bg-surface-raised hover:bg-surface-raised border border-edge"><i className="bi bi-download mr-1" />Download .md</button>
                        </div>
                    )}
                </div>
                <div className="rounded-2xl border border-edge bg-surface p-6 min-h-[420px]">
                    {memo ? (
                        <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink2">{memo.content}</pre>
                    ) : (
                        <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-ink2-faint text-center">
                            <i className="bi bi-file-earmark-text text-4xl mb-3" />
                            <div className="text-sm">Your memo will appear here.</div>
                            <div className="text-xs mt-1">Pick a format on the left and click Generate Memo.</div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
