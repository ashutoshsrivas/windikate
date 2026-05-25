'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../lib/api';

const PRIORITY_LABEL = { critical: '🔴 CRITICAL', important: '🟡 IMPORTANT', nice_to_know: '🟢 NICE-TO-KNOW' };

export default function QuestionTab() {
    const { id } = useParams();
    const [data, setData] = useState(typeof window !== 'undefined' ? window.__analysis : null);

    useEffect(() => {
        const handler = e => setData(e.detail);
        window.addEventListener('analysis:loaded', handler);
        if (window.__analysis) setData(window.__analysis);
        return () => window.removeEventListener('analysis:loaded', handler);
    }, []);

    const [copyStatus, setCopyStatus] = useState(null);

    if (!data) return null;
    const { analysis, questions } = data;

    const groups = {
        critical:     questions.filter(q => q.priority === 'critical'),
        important:    questions.filter(q => q.priority === 'important'),
        nice_to_know: questions.filter(q => q.priority === 'nice_to_know')
    };

    function patchQuestion(updated) {
        setData(prev => ({ ...prev, questions: prev.questions.map(q => q.id === updated.id ? updated : q) }));
    }

    async function copyAll() {
        const txt = `MEETING PREP — ${analysis.company_name}\n\n` +
            Object.entries(groups).map(([p, list]) =>
                list.length ? `## ${PRIORITY_LABEL[p]}\n` + list.map((q, i) => `${i + 1}. ${q.text}`).join('\n') : ''
            ).filter(Boolean).join('\n\n');
        try {
            await navigator.clipboard.writeText(txt);
            setCopyStatus('copied');
        } catch {
            setCopyStatus('failed');
        }
        setTimeout(() => setCopyStatus(null), 2500);
    }

    function mailtoLink() {
        const body = encodeURIComponent(
            Object.entries(groups).map(([p, list]) =>
                list.length ? `${PRIORITY_LABEL[p]}\n` + list.map((q, i) => `${i + 1}. ${q.text}`).join('\n') : ''
            ).filter(Boolean).join('\n\n')
        );
        return `mailto:?subject=${encodeURIComponent(`Meeting prep — ${analysis.company_name}`)}&body=${body}`;
    }
    function slackText() {
        const body = `*Meeting prep — ${analysis.company_name}*\n\n` +
            Object.entries(groups).map(([p, list]) =>
                list.length ? `*${PRIORITY_LABEL[p]}*\n` + list.map(q => '• ' + q.text).join('\n') : ''
            ).filter(Boolean).join('\n\n');
        navigator.clipboard?.writeText(body);
        setCopyStatus('slack');
        setTimeout(() => setCopyStatus(null), 2500);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold">Meeting Prep Questionnaire</h2>
                    <p className="text-white/55 text-sm mt-1">Prioritised by severity. Edit anything before you walk into the call.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={copyAll} className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-sm px-3 py-2 rounded-lg">
                        <i className="bi bi-clipboard" />{copyStatus === 'copied' ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                    <a href={mailtoLink()} className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-sm px-3 py-2 rounded-lg">
                        <i className="bi bi-envelope" />Email to self
                    </a>
                    <button onClick={slackText} className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-sm px-3 py-2 rounded-lg">
                        <i className="bi bi-slack" />{copyStatus === 'slack' ? 'Slack text copied' : 'Share to Slack'}
                    </button>
                    <button onClick={copyAll} className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm px-3 py-2 rounded-lg">
                        <i className="bi bi-journal-plus" />Add to meeting notes
                    </button>
                </div>
            </div>

            {Object.entries(groups).map(([p, list]) => list.length === 0 ? null : (
                <section key={p}>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-white/55 mb-3">{PRIORITY_LABEL[p]} <span className="text-white/30">· {list.length}</span></h3>
                    <ol className="space-y-2.5">
                        {list.map((q, i) => (
                            <QuestionRow key={q.id} analysisId={id} index={i + 1} question={q} onChange={patchQuestion} />
                        ))}
                    </ol>
                </section>
            ))}
        </div>
    );
}

function QuestionRow({ analysisId, index, question, onChange }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(question.text);
    const [priority, setPriority] = useState(question.priority);
    const [busy, setBusy] = useState(false);

    async function save() {
        setBusy(true);
        try {
            const { question: updated } = await api.updateQuestion(analysisId, question.id, { text, priority });
            onChange?.(updated); setEditing(false);
        } finally { setBusy(false); }
    }

    return (
        <li className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            {!editing ? (
                <div className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 text-xs font-mono flex items-center justify-center">{index}</span>
                    <p className="flex-1 text-white/85 leading-relaxed">{question.text}</p>
                    <div className="flex items-center gap-1 shrink-0">
                        {question.custom_edit && <span className="text-[10px] font-mono text-brand-300 px-1.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/30">edited</span>}
                        <button onClick={() => setEditing(true)} className="text-white/45 hover:text-white text-xs px-2 py-1" aria-label="Edit"><i className="bi bi-pencil" /></button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 focus:border-brand-500 focus:outline-none text-sm resize-none" />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex gap-1.5">
                            {Object.keys(PRIORITY_LABEL).map(p => (
                                <button key={p} onClick={() => setPriority(p)}
                                    className={`text-[11px] font-mono px-2 py-1 rounded-md border ${priority === p ? 'bg-brand-600/20 border-brand-500 text-white' : 'bg-white/5 border-white/15 text-white/55'}`}>{PRIORITY_LABEL[p]}</button>
                            ))}
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <button onClick={() => { setText(question.text); setPriority(question.priority); setEditing(false); }} className="text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5">Cancel</button>
                            <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-md">{busy ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>
            )}
        </li>
    );
}
