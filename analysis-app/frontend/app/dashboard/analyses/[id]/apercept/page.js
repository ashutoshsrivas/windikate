'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DeckCite from '../../../../../components/DeckCite';
import { api } from '../../../../../lib/api';

/* Apercept tab — run the deck past the SAMAJ panel and show adoption stats. */

const SENTIMENT_COLOR = {
    strong_pos: 'bg-emerald-500',
    pos:        'bg-emerald-400',
    neutral:    'bg-amber-400',
    neg:        'bg-rose-400',
    strong_neg: 'bg-rose-500'
};
const SENTIMENT_LABEL = {
    strong_pos: 'Strongly positive', pos: 'Positive',
    neutral: 'Neutral', neg: 'Negative', strong_neg: 'Strongly negative'
};

export default function AperceptTab() {
    const { id }   = useParams();
    const [data, setData]       = useState(typeof window !== 'undefined' ? window.__analysis : null);
    const [running, setRunning] = useState(false);
    const [result,  setResult]  = useState(null);
    const [error,   setError]   = useState(null);
    const [brief,   setBrief]   = useState('');
    const [panelSize, setPanelSize] = useState(8);
    const [available, setAvailable] = useState(null);

    useEffect(() => {
        const h = e => setData(e.detail);
        window.addEventListener('analysis:loaded', h);
        if (window.__analysis) setData(window.__analysis);
        api.samajApprovedPersonas().then(d => setAvailable(d.personas.length)).catch(() => setAvailable(0));
        return () => window.removeEventListener('analysis:loaded', h);
    }, []);

    useEffect(() => {
        if (data?.analysis && !brief) {
            const a = data.analysis;
            const seed = `${a.company_name || 'this startup'} — pitch deck attached. ${a.stage || ''}.
Evaluate adoption likelihood, what you'd pay, and your main concerns. Be honest in your own voice.`;
            setBrief(seed.trim());
        }
    }, [data, brief]);

    const analysis = data?.analysis;
    const deckPath = analysis?.deck_path;

    async function run() {
        if (!brief.trim()) return setError('Add a brief for the panel to react to');
        setRunning(true); setError(null); setResult(null);
        try {
            const out = await api.samajRunApercept({
                product_brief: brief.trim(),
                analysis_id:   Number(id),
                panel_size:    Math.max(1, Math.min(50, Number(panelSize) || 8))
            });
            setResult(out);
        } catch (e) {
            setError(e.body?.error || e.message);
        } finally { setRunning(false); }
    }

    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-surface to-surface p-8 sm:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-[0.05]" />
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-brand-500/20 blur-3xl" />
                <div className="relative grid grid-cols-1 lg:grid-cols-[2fr_auto] gap-6 items-end">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-500 text-xs font-mono uppercase tracking-wider mb-3">
                            <i className="bi bi-cpu" />Apercept × SAMAJ
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Run the deck past the digital twins.</h2>
                        <p className="mt-2 text-ink2-muted max-w-2xl text-sm">
                            Each twin reads your brief, decides whether they'd adopt, what they'd pay, and what worries them. You get an adoption rate, an average willingness-to-pay, and a sentiment cluster — every dot citing back to its individual review.
                        </p>
                        {deckPath && <div className="mt-4"><DeckCite deckPath={deckPath} /></div>}
                    </div>
                    <div className="text-center bg-surface/70 backdrop-blur rounded-2xl border border-edge p-5 min-w-[180px]">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-ink2-faint">Twins available</div>
                        <div className="mt-2 text-4xl font-bold leading-none">{available ?? '—'}</div>
                        <Link href="/admin/samaj" className="mt-2 inline-block text-[11px] text-brand-500 hover:underline">invite more →</Link>
                    </div>
                </div>
            </div>

            {/* Brief + run */}
            <section className="rounded-2xl border border-edge bg-surface p-5 space-y-3">
                <label className="block text-xs font-mono uppercase tracking-wider text-ink2-faint">Product brief for the panel</label>
                <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4}
                    className="field text-sm"
                    placeholder="e.g. We're launching X for Y users at ₹Z/month — would you use it?" />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-ink2-muted">Panel size</span>
                        <input type="number" min="1" max="50" value={panelSize}
                            onChange={e => setPanelSize(e.target.value)}
                            className="w-20 field text-center text-sm" />
                        <span className="text-xs text-ink2-faint">random sample of approved twins</span>
                    </div>
                    <button onClick={run} disabled={running || !brief.trim() || available === 0}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50">
                        <i className="bi bi-play-fill" />{running ? 'Polling the panel…' : 'Run Apercept'}
                    </button>
                </div>
                {error && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}
            </section>

            {/* Result */}
            {result && <ResultPanel result={result} />}
        </div>
    );
}

function ResultPanel({ result }) {
    const { stats, responses, consensus_md } = result;
    const adopters = responses.filter(r => r.will_adopt === true);
    const skeptics = responses.filter(r => r.will_adopt === false);
    const offline  = responses.filter(r => r.will_adopt === null);

    return (
        <section className="space-y-6">
            {/* Headline numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Adoption" value={`${stats.adoption_pct}%`} hint={`${stats.adopters} of ${stats.n_known} say yes`} />
                <Stat label="Avg WTP" value={stats.avg_wtp_inr != null ? `₹${stats.avg_wtp_inr.toLocaleString()}/mo` : '—'}
                      hint={stats.wtp_distribution
                          ? `range ₹${stats.wtp_distribution.min}–${stats.wtp_distribution.max}, median ₹${stats.wtp_distribution.median}`
                          : 'no pricing signal'} />
                <Stat label="Net sentiment" value={signed(stats.net_sentiment)} hint={`scale −2 to +2`} />
                <Stat label="Panel" value={stats.n} hint={`${offline.length} offline`} />
            </div>

            {/* Sentiment bar */}
            <div className="rounded-2xl border border-edge bg-surface p-5">
                <div className="text-xs font-mono uppercase tracking-wider text-ink2-faint mb-3">Sentiment distribution</div>
                <div className="flex h-6 rounded-lg overflow-hidden border border-edge">
                    {['strong_neg','neg','neutral','pos','strong_pos'].map(k => {
                        const n = stats.sentiment_distribution[k] || 0;
                        if (!n) return null;
                        return (
                            <div key={k} title={`${SENTIMENT_LABEL[k]} · ${n}`}
                                 className={`${SENTIMENT_COLOR[k]} flex items-center justify-center text-[11px] font-mono text-white`}
                                 style={{ flexGrow: n }}>{n}</div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] font-mono text-ink2-faint">
                    <div className="text-left">Strong −</div>
                    <div className="text-center">−</div>
                    <div className="text-center">Neutral</div>
                    <div className="text-center">+</div>
                    <div className="text-right">Strong +</div>
                </div>
            </div>

            {/* Consensus */}
            <div>
                <h3 className="text-sm font-mono uppercase tracking-wider text-ink2-faint mb-2">Moderator synthesis</h3>
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
                    <Markdown>{consensus_md}</Markdown>
                </div>
            </div>

            {/* Per-persona reviews */}
            <div className="space-y-2.5">
                <h3 className="text-sm font-mono uppercase tracking-wider text-ink2-faint">Per-persona reviews</h3>
                {responses.map(r => (
                    <div key={r.persona_id} className="rounded-xl border border-edge bg-surface p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{r.persona_name}</span>
                                {r.will_adopt === true  && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">WOULD ADOPT</span>}
                                {r.will_adopt === false && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 border border-rose-500/30">WOULD NOT</span>}
                                {r.will_adopt == null   && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 border border-amber-500/30">AI offline</span>}
                                {r.sentiment && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md text-white ${SENTIMENT_COLOR[r.sentiment]}`}>{SENTIMENT_LABEL[r.sentiment]}</span>}
                            </div>
                            {r.wtp_inr != null && <span className="text-xs font-mono text-ink2-muted">WTP ₹{r.wtp_inr.toLocaleString()}/mo</span>}
                        </div>
                        <p className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed">{r.personal_view}</p>
                        {r.discussion_pts && <p className="text-xs text-ink2-muted mt-2 italic whitespace-pre-wrap">{r.discussion_pts}</p>}
                    </div>
                ))}
            </div>
        </section>
    );
}

function Stat({ label, value, hint }) {
    return (
        <div className="rounded-2xl border border-edge bg-surface p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink2-faint">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
            {hint && <div className="text-[11px] text-ink2-muted mt-1">{hint}</div>}
        </div>
    );
}
function signed(n) { const s = (n || 0).toFixed(2); return n > 0 ? `+${s}` : s; }

function Markdown({ children }) {
    if (!children) return null;
    const html = String(children)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        .replace(/(<li>.*<\/li>)/gms, '<ul class="list-disc pl-5 space-y-1 my-2">$1</ul>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>');
    return <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}
