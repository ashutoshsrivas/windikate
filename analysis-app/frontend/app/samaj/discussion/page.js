'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';

/* SAMAJ group discussion — pick N twins, type a prompt, watch them talk.
 *
 * Three phases shown:
 *   1. Personal views   — each twin answers in private
 *   2. Cross-talk       — each reacts to the others
 *   3. Synthesis        — moderator consensus note
 *
 * The backend runs all three in one request and returns the full transcript. */

export default function Discussion() {
    const [personas, setPersonas] = useState(null);
    const [picked, setPicked]     = useState(new Set());
    const [prompt, setPrompt]     = useState('');
    const [running, setRunning]   = useState(false);
    const [result, setResult]     = useState(null);
    const [error, setError]       = useState(null);

    useEffect(() => {
        api.samajApprovedPersonas()
            .then(d => setPersonas(d.personas))
            .catch(e => setError(e.body?.error || e.message));
    }, []);

    function toggle(id) {
        setPicked(p => {
            const n = new Set(p);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }

    async function run() {
        if (picked.size < 2)        return setError('Pick at least 2 personas to start a discussion');
        if (!prompt.trim())         return setError('Type a prompt for the panel');
        setRunning(true); setError(null); setResult(null);
        try {
            const session = await api.samajCreateSession({
                mode: 'discussion',
                persona_ids: [...picked],
                title: prompt.slice(0, 80)
            });
            const out = await api.samajRunDiscussion(session.session.id, prompt.trim());
            setResult({ session_id: session.session.id, ...out });
        } catch (e) {
            setError(e.body?.error || e.message);
        } finally { setRunning(false); }
    }

    if (personas === null) return <div className="text-ink2-faint">Loading the panel…</div>;

    return (
        <div className="space-y-6 max-w-5xl">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Group discussion</h1>
                <p className="text-ink2-muted mt-1">Pick at least 2 twins, type the question, and watch them answer in private → react to each other → reach a consensus.</p>
            </header>

            {/* Panel picker */}
            <section className="rounded-2xl border border-edge bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-mono uppercase tracking-wider text-ink2-faint">
                        Pick the panel · {picked.size} selected / {personas.length} available
                    </div>
                    {picked.size > 0 && <button onClick={() => setPicked(new Set())} className="text-xs text-ink2-muted hover:text-ink2">Clear</button>}
                </div>
                {personas.length === 0 ? (
                    <div className="text-center py-8 text-sm text-ink2-faint">
                        No approved personas yet. <Link href="/admin/samaj" className="text-brand-500 hover:underline">Invite some →</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {personas.map(p => {
                            const on = picked.has(p.id);
                            return (
                                <button key={p.id} onClick={() => toggle(p.id)}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors
                                        ${on ? 'border-brand-500 bg-brand-500/10' : 'border-edge bg-surface-soft hover:border-brand-500/40'}`}>
                                    <Avatar persona={p} size={32} />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">{p.display_name}</div>
                                        <div className="text-[10px] font-mono text-ink2-faint truncate">{p.archetype || 'persona'}</div>
                                    </div>
                                    {on && <i className="bi bi-check-circle-fill text-brand-500 text-sm shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Prompt */}
            <section className="rounded-2xl border border-edge bg-surface p-5">
                <label className="block text-xs font-mono uppercase tracking-wider text-ink2-faint mb-2">Prompt for the panel</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. We are launching a $30/mo personal finance app for first-time investors in India. Would you use it? What would you actually pay?"
                    rows={3} className="field text-sm" />
                {error && <div className="mt-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}
                <div className="mt-3 flex items-center justify-end gap-3">
                    <button onClick={run} disabled={running || picked.size < 2 || !prompt.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50">
                        <i className="bi bi-mortarboard" />{running ? 'Running…' : 'Run the discussion'}
                    </button>
                </div>
            </section>

            {/* Transcript */}
            {result && (
                <section className="space-y-6">
                    <header className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Transcript</h2>
                        <Link href={`/samaj/sessions/${result.session_id || ''}`} className="text-xs text-brand-500 hover:underline">View raw session →</Link>
                    </header>

                    <Phase title="1 · Personal views" subtitle="Each twin answered in private">
                        <div className="space-y-3">
                            {result.personal_views.map((v, i) => (
                                <PersonaCard key={i} persona={v.persona} text={v.view} />
                            ))}
                        </div>
                    </Phase>

                    <Phase title="2 · Cross-talk" subtitle="Each reacted to the others">
                        <div className="space-y-3">
                            {result.reactions.map((v, i) => (
                                <PersonaCard key={i} persona={v.persona} text={v.view} accent />
                            ))}
                        </div>
                    </Phase>

                    <Phase title="3 · Moderator synthesis" subtitle="Where the panel agreed, disagreed, and what would shift them">
                        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
                            <Markdown>{result.synthesis_md}</Markdown>
                        </div>
                    </Phase>
                </section>
            )}
        </div>
    );
}

function Phase({ title, subtitle, children }) {
    return (
        <div>
            <div className="mb-3">
                <h3 className="text-sm font-mono uppercase tracking-wider text-ink2-faint">{title}</h3>
                <p className="text-xs text-ink2-muted">{subtitle}</p>
            </div>
            {children}
        </div>
    );
}
function PersonaCard({ persona, text, accent }) {
    return (
        <div className={`rounded-2xl border p-4 flex gap-3 ${accent ? 'border-brand-500/30 bg-brand-500/[0.04]' : 'border-edge bg-surface'}`}>
            <Avatar persona={persona} size={40} />
            <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-ink2-faint mb-1">{persona.display_name}</div>
                <div className="text-sm text-ink2 whitespace-pre-wrap leading-relaxed">{text}</div>
            </div>
        </div>
    );
}
function Markdown({ children }) {
    /* Tiny client-side markdown — only handles **bold** and bullet lines.
     * The synthesis prompt produces a predictable structure so this is enough. */
    if (!children) return null;
    const html = String(children)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gms, '<ul class="list-disc pl-5 space-y-1 my-2">$1</ul>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>');
    return <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}
function Avatar({ persona, size = 40 }) {
    const letters = (persona.display_name || '?').slice(0, 2).toUpperCase();
    const hue = persona.avatar_seed ? hashHue(persona.avatar_seed) : 200;
    return (
        <div className="shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white"
             style={{ width: size, height: size,
                      background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue+50)%360} 70% 45%))` }}>
            {letters}
        </div>
    );
}
function hashHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h % 360; }
