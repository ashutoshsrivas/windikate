'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

/* The Mini-IPIP-20 (Donnellan et al. 2006) — public domain.
 * Per the paper: 4 items per Big Five domain, items marked R are
 * reverse-keyed. Respondents rate 1 (very inaccurate) → 5 (very accurate).
 * We keep the key on the question so server-side scoring (or our Bedrock
 * compiler) can read it. */
const MINI_IPIP = [
    { id: 'e1', dom: 'E', rev: false, text: 'Am the life of the party.' },
    { id: 'e2', dom: 'E', rev: false, text: 'Talk to a lot of different people at parties.' },
    { id: 'e3', dom: 'E', rev: true,  text: "Don't talk a lot." },
    { id: 'e4', dom: 'E', rev: true,  text: 'Keep in the background.' },
    { id: 'a1', dom: 'A', rev: false, text: "Sympathize with others' feelings." },
    { id: 'a2', dom: 'A', rev: false, text: "Feel others' emotions." },
    { id: 'a3', dom: 'A', rev: true,  text: 'Am not really interested in others.' },
    { id: 'a4', dom: 'A', rev: true,  text: "Am not interested in other people's problems." },
    { id: 'c1', dom: 'C', rev: false, text: 'Get chores done right away.' },
    { id: 'c2', dom: 'C', rev: false, text: 'Like order.' },
    { id: 'c3', dom: 'C', rev: true,  text: 'Often forget to put things back in their proper place.' },
    { id: 'c4', dom: 'C', rev: true,  text: 'Make a mess of things.' },
    { id: 'n1', dom: 'N', rev: false, text: 'Have frequent mood swings.' },
    { id: 'n2', dom: 'N', rev: false, text: 'Get upset easily.' },
    { id: 'n3', dom: 'N', rev: true,  text: 'Am relaxed most of the time.' },
    { id: 'n4', dom: 'N', rev: true,  text: 'Seldom feel blue.' },
    { id: 'o1', dom: 'O', rev: false, text: 'Have a vivid imagination.' },
    { id: 'o2', dom: 'O', rev: false, text: 'Am full of ideas.' },
    { id: 'o3', dom: 'O', rev: true,  text: 'Am not interested in abstract ideas.' },
    { id: 'o4', dom: 'O', rev: true,  text: 'Do not have a good imagination.' }
];

const SITUATIONAL = [
    { id: 'extra_change',  text: 'You receive too much change at a shop and notice only after leaving. What do you do?' },
    { id: 'honest_feedback', text: 'A close friend asks for honest feedback on work you think is poor. How do you respond?' },
    { id: 'dictator_split', text: 'You\'re given money to split however you like with a stranger you\'ll never meet. How much do you keep?' },
    { id: 'group_disagree', text: 'You strongly disagree with a group\'s direction. How do you handle it?' },
    { id: 'free_weekend',  text: 'You have a free weekend with no obligations. How do you spend it?' },
    { id: 'risky_offer',   text: 'You\'re offered a risky opportunity with high payoff and a real chance of loss. How do you decide?' },
    { id: 'recent_decision', text: 'Walk through a recent difficult decision, step by step.' }
];

const ATTITUDES = [
    { id: 'ideology',     label: 'Political ideology', kind: 'scale', left: 'Very liberal', right: 'Very conservative' },
    { id: 'religiosity',  label: 'Religious / spiritual identity', kind: 'scale', left: 'Not at all', right: 'Deeply' },
    { id: 'trust',        label: 'Generalized trust ("most people can be trusted")', kind: 'scale', left: 'Strongly disagree', right: 'Strongly agree' },
    { id: 'party',        label: 'Party / political identification (free text)', kind: 'text' },
    { id: 'issues',       label: 'Three issues you care about most', kind: 'text', placeholder: 'e.g. climate, education access, AI safety' }
];

const STAGES = [
    { key: 'background', label: 'Background', icon: 'bi-person-vcard' },
    { key: 'battery',    label: 'Personality',  icon: 'bi-list-check' },
    { key: 'attitudes',  label: 'Attitudes',  icon: 'bi-compass' },
    { key: 'life_story', label: 'Life story', icon: 'bi-journal-richtext' },
    { key: 'situational',label: 'Situations', icon: 'bi-people' },
    { key: 'submit',     label: 'Submit',     icon: 'bi-check2-square' }
];

const STORE_KEY = (token) => `windikate.intake.${token}`;

export default function IntakePage() {
    const { token } = useParams();
    const [invite, setInvite] = useState(null);
    const [error, setError]   = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [stage, setStage] = useState(0);
    const [data, setData] = useState({
        display_name: '',
        headline: '',
        background: '',
        battery: {},
        attitudes: {},
        life_story: '',
        chapters: [],
        situational: {},
        writing_sample: '',
        consent: false
    });
    const firstLoad = useRef(true);

    // Load invite
    useEffect(() => {
        api.samajGetInvite(token)
            .then(({ invite }) => {
                setInvite(invite);
                setData(d => ({ ...d, display_name: invite.invitee_name || d.display_name }));
            })
            .catch(e => setError(e.body?.error || e.message));
    }, [token]);

    // Restore in-progress answers
    useEffect(() => {
        if (!firstLoad.current) return;
        firstLoad.current = false;
        try {
            const saved = localStorage.getItem(STORE_KEY(token));
            if (saved) setData(d => ({ ...d, ...JSON.parse(saved) }));
        } catch {}
    }, [token]);

    // Auto-save
    useEffect(() => {
        try { localStorage.setItem(STORE_KEY(token), JSON.stringify(data)); } catch {}
    }, [data, token]);

    function patch(p) { setData(d => ({ ...d, ...p })); }
    function patchKey(k, v) { setData(d => ({ ...d, [k]: { ...d[k], ...v } })); }

    async function submit() {
        setSubmitting(true); setError(null);
        try {
            await api.samajSubmitIntake(token, data);
            try { localStorage.removeItem(STORE_KEY(token)); } catch {}
            setSubmitted(true);
        } catch (e) { setError(e.body?.error || e.message); }
        finally { setSubmitting(false); }
    }

    if (error && !invite) return (
        <div className="text-center mt-20">
            <i className="bi bi-x-octagon text-5xl text-rose-500 block mb-4" />
            <h1 className="text-2xl font-bold">Can't open this invite</h1>
            <p className="text-ink2-muted mt-2">{error}</p>
        </div>
    );
    if (!invite) return <div className="text-ink2-muted">Loading…</div>;

    if (submitted || invite.status === 'submitted' || invite.status === 'approved') {
        return (
            <div className="text-center mt-16 max-w-xl mx-auto">
                <i className="bi bi-check-circle-fill text-6xl text-emerald-500 block mb-4" />
                <h1 className="text-3xl font-bold tracking-tight">Thank you</h1>
                <p className="text-ink2-muted mt-3">
                    Your responses have been received. Once an administrator approves them, a digital twin will be
                    activated on the SAMAJ map. You can close this page.
                </p>
            </div>
        );
    }

    const cur = STAGES[stage];
    const pct = Math.round(((stage + 1) / STAGES.length) * 100);
    const canPrev = stage > 0;
    const canNext = stage < STAGES.length - 1;

    return (
        <div className="space-y-8">
            {/* Welcome / progress */}
            <section>
                <div className="flex items-center justify-between text-xs font-mono uppercase text-ink2-faint">
                    <span>Stage {stage + 1} of {STAGES.length}</span>
                    <span>{pct}% complete</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-pink-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2">
                    {STAGES.map((s, i) => (
                        <button key={s.key} onClick={() => setStage(i)}
                            className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors
                                ${i === stage
                                    ? 'border-brand-500 bg-brand-500/10 text-brand-500 font-medium'
                                    : i < stage
                                        ? 'border-edge bg-surface text-ink2-muted'
                                        : 'border-dashed border-edge text-ink2-faint'}`}>
                            <i className={`bi ${s.icon}`} />{s.label}
                        </button>
                    ))}
                </div>
            </section>

            <header>
                <h1 className="text-3xl font-bold tracking-tight">{stageTitle(cur.key)}</h1>
                <p className="text-ink2-muted mt-2 max-w-2xl">{stageDescription(cur.key)}</p>
            </header>

            <section className="rounded-2xl border border-edge bg-surface p-6 lg:p-8 space-y-6">
                {cur.key === 'background' && (
                    <>
                        <Field label="Your name" required>
                            <input className="field" value={data.display_name} onChange={e => patch({ display_name: e.target.value })} placeholder="As you'd like to be addressed" />
                        </Field>
                        <Field label="One-line self-summary" hint="Optional. e.g. 'climate-tech founder, recovering banker, Hindi/English'">
                            <input className="field" value={data.headline} onChange={e => patch({ headline: e.target.value })} placeholder="A vivid sentence" />
                        </Field>
                        <Field label="Background"
                            hint="Age, where you grew up & now live, education, occupational history, household, languages used. The more specific, the better the twin.">
                            <textarea className="field min-h-[180px]" value={data.background} onChange={e => patch({ background: e.target.value })} placeholder="Tell us about yourself…" />
                        </Field>
                    </>
                )}

                {cur.key === 'battery' && (
                    <BatterySection data={data.battery} onChange={v => patchKey('battery', v)} />
                )}

                {cur.key === 'attitudes' && (
                    <AttitudesSection data={data.attitudes} onChange={v => patchKey('attitudes', v)} />
                )}

                {cur.key === 'life_story' && (
                    <>
                        <Field label="Your life story — in your own words" hint="Childhood → education → family → relationships → major events that shaped you. Write as much or as little as you want. (Recommended: 800+ words for a good twin.)">
                            <textarea className="field min-h-[280px]" value={data.life_story} onChange={e => patch({ life_story: e.target.value })} placeholder="Take your time. There are no wrong answers." />
                        </Field>
                        <Field label="If you divided your life into chapters, what would they be?" hint="Comma-separated. e.g. 'Childhood in Pune; College years; First startup; Pandemic pivot'">
                            <input className="field" value={(data.chapters || []).join('; ')}
                                onChange={e => patch({ chapters: e.target.value.split(/[;\n]/).map(s => s.trim()).filter(Boolean) })}
                                placeholder="Chapter 1; Chapter 2; …" />
                        </Field>
                    </>
                )}

                {cur.key === 'situational' && (
                    <SituationalSection data={data.situational} onChange={v => patchKey('situational', v)}
                        writing={data.writing_sample} onWriting={s => patch({ writing_sample: s })} />
                )}

                {cur.key === 'submit' && (
                    <SubmitSection data={data} consent={data.consent} onConsent={c => patch({ consent: c })} />
                )}

                {error && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3">{error}</div>}

                <div className="flex items-center justify-between pt-3">
                    <button disabled={!canPrev} onClick={() => setStage(s => s - 1)}
                        className="px-4 py-2 rounded-lg text-sm text-ink2-muted hover:text-ink2 disabled:opacity-30">← Back</button>
                    {canNext ? (
                        <button onClick={() => setStage(s => s + 1)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium">
                            Continue<i className="bi bi-arrow-right" />
                        </button>
                    ) : (
                        <button onClick={submit} disabled={submitting || !data.display_name || !data.consent}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50">
                            <i className="bi bi-send-fill" />{submitting ? 'Submitting…' : 'Submit my intake'}
                        </button>
                    )}
                </div>
            </section>

            <p className="text-xs text-ink2-faint text-center">
                Your answers auto-save to this browser. You can close the tab and come back to finish.
            </p>
        </div>
    );
}

function stageTitle(k) {
    return ({
        background:  'A little about you',
        battery:     'Personality snapshot',
        attitudes:   'Your worldview',
        life_story:  'Your life story',
        situational: 'How you\'d actually act',
        submit:      'Review & submit'
    })[k];
}
function stageDescription(k) {
    return ({
        background:  'Free-form. Treat this like meeting someone smart for coffee — give them enough that they could describe you to a friend.',
        battery:     '20 quick statements adapted from the Mini-IPIP (Donnellan et al. 2006, public domain). Rate each one from 1 (very inaccurate) to 5 (very accurate).',
        attitudes:   'Where you sit on a few worldview questions. Slide the markers; rough is fine.',
        life_story:  'The single most useful input for a faithful twin. Be candid; chapters, high points, low points, turning points, hopes — whatever feels real.',
        situational: 'What you would actually do — not what sounds best. Brief is fine.',
        submit:      'Quick look at what you\'re about to send, then a consent checkbox.'
    })[k];
}

/* ─── Battery (Mini-IPIP-20) ─────────────────────────────── */
function BatterySection({ data, onChange }) {
    return (
        <div className="space-y-3">
            {MINI_IPIP.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-edge bg-surface-soft p-4">
                    <div className="flex items-start gap-3 mb-2.5">
                        <span className="text-[10px] font-mono text-ink2-faint mt-0.5">{String(i+1).padStart(2,'0')}</span>
                        <div className="text-sm text-ink2 flex-1">{q.text}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {[1,2,3,4,5].map(v => {
                            const sel = data[q.id] === v;
                            return (
                                <button key={v} onClick={() => onChange({ [q.id]: v })}
                                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors
                                        ${sel ? 'bg-brand-500/15 border-brand-500 text-brand-500 font-medium' : 'bg-surface border-edge text-ink2-muted hover:bg-surface-raised'}`}>
                                    {v}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] font-mono text-ink2-faint">
                        <span>Very inaccurate</span><span>Very accurate</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function AttitudesSection({ data, onChange }) {
    return (
        <div className="space-y-5">
            {ATTITUDES.map(a => (
                <div key={a.id}>
                    <div className="text-sm font-medium mb-2">{a.label}</div>
                    {a.kind === 'scale' ? (
                        <div>
                            <input type="range" min={1} max={7} value={data[a.id] || 4}
                                onChange={e => onChange({ [a.id]: Number(e.target.value) })}
                                className="w-full accent-brand-500" />
                            <div className="flex justify-between text-[11px] text-ink2-faint mt-1">
                                <span>{a.left}</span><span>Center</span><span>{a.right}</span>
                            </div>
                        </div>
                    ) : (
                        <input className="field" value={data[a.id] || ''} placeholder={a.placeholder} onChange={e => onChange({ [a.id]: e.target.value })} />
                    )}
                </div>
            ))}
        </div>
    );
}

function SituationalSection({ data, onChange, writing, onWriting }) {
    return (
        <div className="space-y-5">
            {SITUATIONAL.map((s, i) => (
                <Field key={s.id} label={`${i+1}. ${s.text}`}>
                    <textarea className="field min-h-[80px]" value={data[s.id] || ''} onChange={e => onChange({ [s.id]: e.target.value })} />
                </Field>
            ))}
            <Field label="Writing sample (optional)" hint="Paste anything you've written naturally — an email, a Twitter thread, a journal entry. Helps the twin learn your voice.">
                <textarea className="field min-h-[140px]" value={writing} onChange={e => onWriting(e.target.value)} />
            </Field>
        </div>
    );
}

function SubmitSection({ data, consent, onConsent }) {
    const counts = {
        battery:     Object.keys(data.battery || {}).length,
        attitudes:   Object.keys(data.attitudes || {}).length,
        situational: Object.keys(data.situational || {}).length,
        life_story_words: (data.life_story || '').split(/\s+/).filter(Boolean).length,
        writing_words:    (data.writing_sample || '').split(/\s+/).filter(Boolean).length
    };
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Stat n={counts.battery}     d={20} label="Personality" />
                <Stat n={counts.attitudes}   d={5}  label="Attitudes" />
                <Stat n={counts.life_story_words} label="Life-story words" target={300} />
                <Stat n={counts.situational} d={7}  label="Situational" />
                <Stat n={counts.writing_words}    label="Writing words" />
            </div>
            <div className="rounded-xl border border-edge bg-surface-soft p-4 text-sm text-ink2-muted leading-relaxed">
                <strong className="text-ink2 block mb-1">A note on what happens next.</strong>
                Your responses are stored on Windikate servers. After an administrator reviews them, a digital
                twin of you is compiled and placed on the SAMAJ map, where Windikate may use it for product-
                feedback simulations. You can ask for your twin to be removed at any time. We do not share
                your raw answers with third parties.
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => onConsent(e.target.checked)} className="mt-1 w-4 h-4 accent-brand-500" />
                <span className="text-sm">
                    I understand the above and consent to a digital twin being created from my responses.
                    <span className="text-ink2-faint"> Required.</span>
                </span>
            </label>
        </div>
    );
}

function Field({ label, hint, required, children }) {
    return (
        <div>
            <label className="block text-sm font-medium mb-1.5">
                {label}{required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            {hint && <p className="text-xs text-ink2-faint mb-2">{hint}</p>}
            {children}
        </div>
    );
}
function Stat({ n, d, label, target }) {
    const ratio = d ? Math.min(1, n / d) : (target ? Math.min(1, n / target) : 0);
    return (
        <div className="rounded-xl border border-edge bg-surface p-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink2-faint">{label}</div>
            <div className="text-lg font-bold mt-1">{n}{d ? `/${d}` : ''}</div>
            <div className="h-1 rounded-full bg-surface-raised overflow-hidden mt-2">
                <div className="h-full bg-brand-500" style={{ width: `${ratio*100}%` }} />
            </div>
        </div>
    );
}
