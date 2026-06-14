'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';

const TABS = [
    { key: 'invites',  label: 'Invites',  icon: 'bi-envelope-paper' },
    { key: 'pending',  label: 'Pending review', icon: 'bi-hourglass-split' },
    { key: 'approved', label: 'Approved', icon: 'bi-check2-circle' }
];

export default function AdminSamaj() {
    const [tab, setTab] = useState('invites');
    const [invites, setInvites] = useState(null);
    const [pending, setPending] = useState(null);
    const [approved, setApproved] = useState(null);
    const [openInvite, setOpenInvite] = useState(null);     // {invite, url}
    const [reviewing, setReviewing] = useState(null);       // persona
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    async function reloadAll() {
        const [a, b, c] = await Promise.all([
            api.samajListInvites(),
            api.samajListPersonas('pending'),
            api.samajListPersonas('approved')
        ]);
        setInvites(a.invites);
        setPending(b.personas);
        setApproved(c.personas);
    }
    useEffect(() => { reloadAll().catch(e => setError(e.message)); }, []);

    async function createInvite(form) {
        setSubmitting(true); setError(null);
        try {
            const { invite, url } = await api.samajCreateInvite(form);
            setOpenInvite({ invite, url });
            await reloadAll();
        } catch (e) { setError(e.body?.error || e.message); }
        finally { setSubmitting(false); }
    }

    async function approve(persona) {
        setSubmitting(true);
        try {
            await api.samajApprove(persona.id);
            setReviewing(null);
            await reloadAll();
        } catch (e) { setError(e.body?.error || e.message); }
        finally { setSubmitting(false); }
    }
    async function reject(persona) {
        if (!confirm(`Reject ${persona.display_name}?`)) return;
        await api.samajReject(persona.id);
        setReviewing(null);
        await reloadAll();
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">SAMAJ console</h1>
                    <p className="text-ink2-muted mt-1">Invite people → review their intake → approve to spawn a digital twin on the map.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Counter label="Invites" value={invites?.length} />
                    <Counter label="Pending" value={pending?.length} highlight />
                    <Counter label="Approved" value={approved?.length} />
                </div>
            </header>

            {error && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3">{error}</div>}

            <InviteForm onSubmit={createInvite} submitting={submitting} />

            <div className="border-b border-edge flex gap-1">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors
                            ${tab === t.key ? 'border-brand-500 text-ink2 font-medium' : 'border-transparent text-ink2-muted hover:text-ink2'}`}>
                        <i className={`bi ${t.icon}`} />{t.label}
                    </button>
                ))}
            </div>

            {tab === 'invites'  && <InvitesTab invites={invites} onRevoke={async i => { await api.samajRevokeInvite(i.id); reloadAll(); }} onOpen={setOpenInvite} />}
            {tab === 'pending'  && <PersonasTab list={pending}  empty="No personas waiting on review." onOpen={setReviewing} kind="pending" />}
            {tab === 'approved' && <PersonasTab list={approved} empty="No personas approved yet." onOpen={setReviewing} kind="approved" />}

            {openInvite && <InviteLinkModal data={openInvite} onClose={() => setOpenInvite(null)} />}
            {reviewing && <ReviewModal persona={reviewing}
                onClose={() => setReviewing(null)}
                onApprove={approve} onReject={reject} submitting={submitting} />}
        </div>
    );
}

function Counter({ label, value, highlight }) {
    return (
        <div className={`rounded-xl border px-3 py-2 ${highlight ? 'border-brand-500/40 bg-brand-500/5' : 'border-edge bg-surface'}`}>
            <div className="text-[10px] font-mono uppercase text-ink2-faint">{label}</div>
            <div className="text-lg font-bold leading-none mt-0.5">{value ?? '·'}</div>
        </div>
    );
}

/* ─── Invite form ──────────────────────────────────────────── */
function InviteForm({ onSubmit, submitting }) {
    const [email, setEmail] = useState('');
    const [name, setName]   = useState('');
    const [note, setNote]   = useState('');

    return (
        <form onSubmit={e => { e.preventDefault(); onSubmit({ invitee_email: email || null, invitee_name: name || null, note: note || null }); setEmail(''); setName(''); setNote(''); }}
              className="rounded-2xl border border-edge bg-surface p-5">
            <div className="text-xs font-mono uppercase tracking-wider text-ink2-faint mb-3">Generate invite link</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="field" placeholder="Invitee name (optional)" value={name} onChange={e => setName(e.target.value)} />
                <input className="field" placeholder="Invitee email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="field" placeholder="Internal note (optional)" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-ink2-faint">Anyone with the link can fill the intake — they don't need an account.</p>
                <button type="submit" disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium disabled:opacity-60">
                    <i className="bi bi-link-45deg" />{submitting ? 'Working…' : 'Generate link'}
                </button>
            </div>
        </form>
    );
}

/* ─── Invites tab ──────────────────────────────────────────── */
function InvitesTab({ invites, onRevoke, onOpen }) {
    if (invites === null) return <Loading />;
    if (!invites.length) return <Empty>No invites yet — generate one above.</Empty>;
    return (
        <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-surface-raised text-ink2-muted text-xs uppercase font-mono">
                    <tr>
                        <th className="text-left px-4 py-3">Invitee</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Created</th>
                        <th className="text-left px-4 py-3">Expires</th>
                        <th className="text-right px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {invites.map(i => (
                        <tr key={i.id} className="border-t border-edge hover:bg-surface-raised">
                            <td className="px-4 py-3">
                                <div className="font-medium">{i.invitee_name || <span className="text-ink2-faint">—</span>}</div>
                                <div className="text-xs text-ink2-faint">{i.invitee_email || 'no email'}</div>
                                {i.note && <div className="text-[11px] text-ink2-faint italic mt-0.5">"{i.note}"</div>}
                            </td>
                            <td className="px-4 py-3"><StatusPill status={i.status} /></td>
                            <td className="px-4 py-3 text-ink2-muted">{relative(i.created_at)}</td>
                            <td className="px-4 py-3 text-ink2-muted">{i.expires_at ? relative(i.expires_at) : '—'}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                                <button onClick={() => onOpen({ invite: i, url: i.url })}
                                    className="text-xs text-brand-500 hover:text-brand-400">Copy link</button>
                                {['pending','submitted'].includes(i.status) && (
                                    <button onClick={() => onRevoke(i)} className="text-xs text-rose-500 hover:text-rose-400">Revoke</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ─── Personas table ──────────────────────────────────────── */
function PersonasTab({ list, empty, onOpen, kind }) {
    if (list === null) return <Loading />;
    if (!list.length) return <Empty>{empty}</Empty>;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map(p => (
                <button key={p.id} onClick={() => onOpen(p)}
                    className="text-left rounded-2xl border border-edge bg-surface hover:border-brand-500/40 hover:shadow-soft p-5 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar seed={p.avatar_seed} name={p.display_name} />
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate">{p.display_name}</div>
                            <div className="text-xs text-ink2-muted truncate">{p.headline || '—'}</div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-mono uppercase text-ink2-faint">{p.archetype || 'unscored'}</span>
                        <StatusPill status={p.status} />
                    </div>
                    {kind === 'approved' && p.traits && <TraitBar traits={p.traits} />}
                </button>
            ))}
        </div>
    );
}

/* ─── Review modal — see intake, approve/reject ─────────── */
function ReviewModal({ persona, onClose, onApprove, onReject, submitting }) {
    const [detail, setDetail] = useState(null);
    useEffect(() => { api.samajGetPersona(persona.id).then(({ persona }) => setDetail(persona)); }, [persona.id]);

    return (
        <Modal onClose={onClose}>
            <div className="max-h-[80vh] overflow-y-auto">
                <header className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <Avatar seed={persona.avatar_seed} name={persona.display_name} />
                        <div>
                            <h2 className="text-xl font-semibold">{persona.display_name}</h2>
                            <p className="text-sm text-ink2-muted">{persona.headline || '—'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-ink2-muted hover:text-ink2 text-xl">×</button>
                </header>

                {!detail ? <Loading /> : (
                    <div className="space-y-4 text-sm">
                        <Section title="Background">{val(detail.payload?.background) || <Muted>—</Muted>}</Section>
                        <Section title="Standardized battery (Stage 1)">
                            <pre className="text-xs bg-surface-soft border border-edge rounded-lg p-3 overflow-x-auto">{JSON.stringify(detail.payload?.battery || {}, null, 2)}</pre>
                        </Section>
                        <Section title="Life story (Stage 2)">{val(detail.payload?.life_story) || <Muted>not provided</Muted>}</Section>
                        <Section title="Situational responses (Stage 3)">
                            <pre className="text-xs bg-surface-soft border border-edge rounded-lg p-3 overflow-x-auto">{JSON.stringify(detail.payload?.situational || {}, null, 2)}</pre>
                        </Section>
                        <Section title="Attitudes & worldview">
                            <pre className="text-xs bg-surface-soft border border-edge rounded-lg p-3 overflow-x-auto">{JSON.stringify(detail.payload?.attitudes || {}, null, 2)}</pre>
                        </Section>
                        {detail.payload?.writing_sample && <Section title="Writing sample">{val(detail.payload.writing_sample)}</Section>}
                        {detail.system_prompt_md && (
                            <Section title="Compiled persona prompt">
                                <pre className="text-xs whitespace-pre-wrap bg-surface-soft border border-edge rounded-lg p-3">{detail.system_prompt_md}</pre>
                            </Section>
                        )}
                    </div>
                )}

                <footer className="mt-6 pt-4 border-t border-edge flex items-center justify-end gap-3">
                    {persona.status === 'pending' && (
                        <>
                            <button onClick={() => onReject(persona)} className="px-4 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-sm">Reject</button>
                            <button onClick={() => onApprove(persona)} disabled={submitting}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
                                <i className="bi bi-magic" />{submitting ? 'Compiling…' : 'Approve & compile twin'}
                            </button>
                        </>
                    )}
                    {persona.status === 'approved' && (
                        <Link href="/samaj" className="px-4 py-2 rounded-lg bg-brand-500/10 text-brand-500 text-sm">View on map →</Link>
                    )}
                </footer>
            </div>
        </Modal>
    );
}

function InviteLinkModal({ data, onClose }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        try { await navigator.clipboard.writeText(data.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
    }
    return (
        <Modal onClose={onClose}>
            <h3 className="text-lg font-semibold mb-2">Invite link ready</h3>
            <p className="text-sm text-ink2-muted mb-4">Share this URL with {data.invite.invitee_name || data.invite.invitee_email || 'the invitee'}. They'll be asked to complete the SAMAJ intake.</p>
            <div className="flex items-center gap-2">
                <input readOnly value={data.url} className="field flex-1 font-mono text-xs" onFocus={e => e.target.select()} />
                <button onClick={copy} className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium">
                    {copied ? '✓ Copied' : 'Copy'}
                </button>
            </div>
            <div className="mt-4 text-xs text-ink2-faint">
                Expires {data.invite.expires_at ? new Date(data.invite.expires_at).toLocaleDateString() : 'never'}.
            </div>
        </Modal>
    );
}

/* ─── Tiny shared bits ─────────────────────────────────── */
function Modal({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface border border-edge rounded-2xl shadow-card max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}
function Section({ title, children }) {
    return (
        <div>
            <div className="text-xs font-mono uppercase tracking-wider text-ink2-faint mb-1.5">{title}</div>
            <div className="text-ink2 whitespace-pre-wrap">{children}</div>
        </div>
    );
}
function val(s) { if (!s) return null; return s; }
function Muted({ children }) { return <span className="text-ink2-faint italic">{children}</span>; }
function Empty({ children }) {
    return <div className="rounded-2xl border border-dashed border-edge bg-surface px-6 py-10 text-center text-ink2-muted">{children}</div>;
}
function Loading() { return <div className="text-ink2-muted text-sm">Loading…</div>; }

function StatusPill({ status }) {
    const map = {
        pending:   ['bg-amber-500/10 text-amber-600 border-amber-500/30', 'Pending'],
        submitted: ['bg-brand-500/10 text-brand-500 border-brand-500/30', 'Submitted'],
        approved:  ['bg-emerald-500/10 text-emerald-500 border-emerald-500/30', 'Approved'],
        rejected:  ['bg-rose-500/10 text-rose-500 border-rose-500/30',     'Rejected'],
        revoked:   ['bg-edge text-ink2-muted',                              'Revoked'],
        archived:  ['bg-edge text-ink2-muted',                              'Archived']
    };
    const [cls, label] = map[status] || ['', status];
    return <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${cls}`}>{label}</span>;
}

function Avatar({ seed, name }) {
    const letters = (name || '?').slice(0, 2).toUpperCase();
    const hue = seed ? hashHue(seed) : 200;
    return (
        <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white"
             style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 50) % 360} 70% 45%))` }}>
            {letters}
        </div>
    );
}
function hashHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h % 360; }

function TraitBar({ traits }) {
    const tr = typeof traits === 'string' ? safeParse(traits) : traits;
    if (!tr) return null;
    const dims = [['O', tr.openness], ['C', tr.conscientiousness], ['E', tr.extraversion], ['A', tr.agreeableness], ['N', tr.neuroticism]];
    return (
        <div className="mt-3 flex items-end gap-1 h-8">
            {dims.map(([k, v]) => (
                <div key={k} className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-brand-500/70 rounded-sm" style={{ height: `${v}%`, minHeight: 2 }} />
                    <div className="text-[9px] font-mono text-ink2-faint mt-0.5">{k}</div>
                </div>
            ))}
        </div>
    );
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

function relative(d) {
    if (!d) return '—';
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (Math.abs(diff) < 60) return 'just now';
    if (Math.abs(diff) < 3600) return `${Math.round(diff / 60)}m ${diff > 0 ? 'ago' : 'ahead'}`;
    if (Math.abs(diff) < 86400) return `${Math.round(diff / 3600)}h ${diff > 0 ? 'ago' : 'ahead'}`;
    return new Date(d).toLocaleDateString();
}
