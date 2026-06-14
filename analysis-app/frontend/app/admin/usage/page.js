'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

const TABS = [
    { key: 'rollup', label: 'Rollup',       icon: 'bi-bar-chart' },
    { key: 'calls',  label: 'Every call',   icon: 'bi-list-ul' }
];

export default function AdminUsage() {
    const [tab, setTab] = useState('rollup');
    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold">Usage</h2>
                <p className="text-ink2-muted text-sm mt-1">
                    Aggregate spend on the left, every individual AI call on the right — tokens in, tokens out, cost in cents, milliseconds, success or error.
                </p>
            </header>
            <div className="border-b border-edge flex gap-1">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors
                            ${tab === t.key ? 'border-brand-500 text-ink2 font-medium' : 'border-transparent text-ink2-muted hover:text-ink2'}`}>
                        <i className={`bi ${t.icon}`} />{t.label}
                    </button>
                ))}
            </div>
            {tab === 'rollup' ? <RollupTab /> : <CallsTab />}
        </div>
    );
}

/* ─── Rollup (the old view, lightly cleaned) ──────────────────────── */
function RollupTab() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);

    useEffect(() => { api.adminUsage(days).then(setData); }, [days]);

    if (!data) return <div className="text-ink2-faint">Loading…</div>;

    const totalCents = data.daily.reduce((s, d) => s + d.cents, 0);
    const totalCalls = data.daily.reduce((s, d) => s + d.calls, 0);
    const maxCents = Math.max(...data.daily.map(d => d.cents), 1);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-ink2-muted text-sm">${(totalCents/100).toFixed(2)} across {totalCalls} calls in the last {days} days</p>
                <div className="flex items-center gap-2 text-sm">
                    {[7, 30, 90].map(n => (
                        <button key={n} onClick={() => setDays(n)} className={`px-3 py-1.5 rounded-lg text-sm ${days === n ? 'bg-brand-600 text-white' : 'bg-surface-raised text-ink2-muted hover:bg-surface-raised'}`}>{n}d</button>
                    ))}
                </div>
            </div>

            <section className="rounded-2xl border border-edge bg-surface p-6">
                <div className="text-xs font-mono uppercase tracking-wider text-ink2-faint mb-4">Daily spend</div>
                {data.daily.length === 0 ? (
                    <div className="text-ink2-faint text-sm py-8 text-center">No AI calls in this window yet.</div>
                ) : (
                    <div className="flex items-end gap-1 h-40">
                        {data.daily.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                                <div className="text-[10px] font-mono text-ink2-faint opacity-0 group-hover:opacity-100">${(d.cents/100).toFixed(2)}</div>
                                <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all" style={{ height: `${(d.cents / maxCents) * 100}%` }}></div>
                                <div className="text-[9px] font-mono text-ink2-faint mt-1">{d.day.slice(-5)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-edge bg-surface overflow-hidden">
                <div className="px-5 py-3 border-b border-edge text-xs font-mono uppercase tracking-wider text-ink2-faint">By user</div>
                <table className="w-full text-sm">
                    <thead className="text-ink2-muted text-xs uppercase font-mono">
                        <tr>
                            <th className="text-left px-5 py-3">User</th>
                            <th className="text-right px-5 py-3">Calls</th>
                            <th className="text-right px-5 py-3">Window spend</th>
                            <th className="text-right px-5 py-3">Month-to-date</th>
                            <th className="text-right px-5 py-3">Cap</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.by_user.map(u => (
                            <tr key={u.id} className="border-t border-edge hover:bg-surface-raised">
                                <td className="px-5 py-3">
                                    <div className="font-medium">{u.display_name || '—'}</div>
                                    <div className="text-xs text-ink2-muted">{u.email}</div>
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-xs">{u.calls}</td>
                                <td className="px-5 py-3 text-right">${(u.cents/100).toFixed(2)}</td>
                                <td className="px-5 py-3 text-right">${(u.monthly_spend_cents/100).toFixed(2)}</td>
                                <td className="px-5 py-3 text-right text-ink2-muted">{u.monthly_cap_cents != null ? `$${(u.monthly_cap_cents/100).toFixed(0)}` : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

/* ─── Every call — the new audit feed ────────────────────────────── */
const PAGE = 50;

function CallsTab() {
    const [filters, setFilters] = useState({
        q: '', service: '', model_id: '', status: '', from: '', to: ''
    });
    const [offset, setOffset]   = useState(0);
    const [data, setData]       = useState(null);
    const [facets, setFacets]   = useState({ services: [], models: [] });
    const [autoRefresh, setAuto] = useState(false);

    useEffect(() => { api.adminUsageFacets().then(setFacets).catch(() => {}); }, []);

    const queryArgs = useMemo(
        () => ({ ...cleanFilters(filters), limit: PAGE, offset }),
        [filters, offset]
    );
    useEffect(() => { api.adminUsageEvents(queryArgs).then(setData); }, [queryArgs]);

    useEffect(() => {
        if (!autoRefresh) return;
        const t = setInterval(() => api.adminUsageEvents(queryArgs).then(setData), 5000);
        return () => clearInterval(t);
    }, [autoRefresh, queryArgs]);

    function setF(patch) { setOffset(0); setFilters(f => ({ ...f, ...patch })); }
    function clear() { setOffset(0); setFilters({ q: '', service: '', model_id: '', status: '', from: '', to: '' }); }

    if (!data) return <div className="text-ink2-faint">Loading…</div>;

    return (
        <div className="space-y-5">
            {/* Filter bar */}
            <div className="rounded-2xl border border-edge bg-surface p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                    <input className="field" placeholder="Search service / model / user / error"
                        value={filters.q} onChange={e => setF({ q: e.target.value })} />
                    <select className="field" value={filters.service} onChange={e => setF({ service: e.target.value })}>
                        <option value="">All services</option>
                        {facets.services.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="field" value={filters.model_id} onChange={e => setF({ model_id: e.target.value })}>
                        <option value="">All models</option>
                        {facets.models.map(m => <option key={m} value={m}>{shortModel(m)}</option>)}
                    </select>
                    <select className="field" value={filters.status} onChange={e => setF({ status: e.target.value })}>
                        <option value="">All statuses</option>
                        <option value="success">Success only</option>
                        <option value="error">Errors only</option>
                    </select>
                    <input className="field" type="date" value={filters.from} onChange={e => setF({ from: e.target.value })} title="From" />
                    <input className="field" type="date" value={filters.to}   onChange={e => setF({ to: e.target.value })}   title="To" />
                </div>
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="text-ink2-faint">
                        Showing {data.rows.length} of <span className="text-ink2 font-mono">{data.total.toLocaleString()}</span> calls
                        {data.total > 0 && (
                            <> · totals in this filter: <span className="text-ink2 font-mono">${(data.sum_cents/100).toFixed(4)}</span> · <span className="font-mono">{data.sum_in.toLocaleString()}</span> in · <span className="font-mono">{data.sum_out.toLocaleString()}</span> out</>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-brand-500" checked={autoRefresh} onChange={e => setAuto(e.target.checked)} />
                            <span>Live refresh (5s)</span>
                        </label>
                        <button onClick={clear} className="px-2.5 py-1 rounded-md border border-edge text-ink2-muted hover:text-ink2">Reset</button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1100px]">
                        <thead className="text-ink2-faint text-[10px] uppercase font-mono">
                            <tr className="border-b border-edge">
                                <Th>When</Th>
                                <Th>User</Th>
                                <Th>Service</Th>
                                <Th>Model</Th>
                                <Th right>In tok</Th>
                                <Th right>Out tok</Th>
                                <Th right>Cost ¢</Th>
                                <Th right>ms</Th>
                                <Th>Status</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.length === 0 ? (
                                <tr><td colSpan={9} className="px-5 py-8 text-center text-ink2-faint text-sm">No events match this filter.</td></tr>
                            ) : data.rows.map(ev => (
                                <tr key={ev.id} className="border-b border-edge last:border-0 hover:bg-surface-raised">
                                    <Td title={new Date(ev.created_at).toString()}>
                                        <div className="text-xs font-mono">{formatTime(ev.created_at)}</div>
                                        <div className="text-[10px] text-ink2-faint font-mono">{relTime(ev.created_at)}</div>
                                    </Td>
                                    <Td>
                                        {ev.user_email ? (
                                            <>
                                                <div className="font-medium text-xs">{ev.user_name || ev.user_email.split('@')[0]}</div>
                                                <div className="text-[10px] text-ink2-faint">{ev.user_email}</div>
                                            </>
                                        ) : <span className="text-ink2-faint text-xs">—</span>}
                                    </Td>
                                    <Td>
                                        <span className="inline-block px-2 py-0.5 rounded-md bg-surface-raised border border-edge text-[11px] font-mono">{ev.service}</span>
                                    </Td>
                                    <Td title={ev.model_id}>
                                        <span className="text-xs">{shortModel(ev.model_id)}</span>
                                    </Td>
                                    <Td right><span className="font-mono text-xs">{ev.input_tokens.toLocaleString()}</span></Td>
                                    <Td right><span className="font-mono text-xs">{ev.output_tokens.toLocaleString()}</span></Td>
                                    <Td right>
                                        <span className="font-mono text-xs" title={`$${(ev.total_cost_cents/100).toFixed(6)}`}>
                                            {ev.total_cost_cents > 0 ? formatCents(ev.total_cost_cents) : '—'}
                                        </span>
                                    </Td>
                                    <Td right><span className="font-mono text-xs">{ev.duration_ms}</span></Td>
                                    <Td>
                                        {ev.success
                                            ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><i className="bi bi-check-circle-fill" />OK</span>
                                            : <span className="inline-flex items-center gap-1 text-[11px] text-rose-500" title={ev.error_code || ''}><i className="bi bi-x-circle-fill" />{ev.error_code || 'error'}</span>}
                                    </Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-edge text-xs">
                    <div className="text-ink2-faint">
                        {data.total === 0 ? '0 of 0'
                            : `${offset + 1}–${Math.min(offset + data.rows.length, data.total)} of ${data.total.toLocaleString()}`}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - PAGE))}
                            className="px-3 py-1.5 rounded-lg border border-edge bg-surface text-ink2-muted hover:text-ink2 disabled:opacity-30">← Prev</button>
                        <button disabled={offset + PAGE >= data.total} onClick={() => setOffset(o => o + PAGE)}
                            className="px-3 py-1.5 rounded-lg border border-edge bg-surface text-ink2-muted hover:text-ink2 disabled:opacity-30">Next →</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Th({ children, right }) {
    return <th className={`px-4 py-2.5 ${right ? 'text-right' : 'text-left'} font-mono`}>{children}</th>;
}
function Td({ children, right, title }) {
    return <td className={`px-4 py-2.5 align-top ${right ? 'text-right' : ''}`} title={title}>{children}</td>;
}

function cleanFilters(f) {
    const out = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) out[k] = v; });
    return out;
}

function shortModel(id) {
    if (!id) return '';
    // turn "us.amazon.nova-micro-v1:0" into "Nova Micro"
    const map = {
        'us.amazon.nova-micro-v1:0': 'Nova Micro',
        'us.amazon.nova-lite-v1:0':  'Nova Lite',
        'us.amazon.nova-pro-v1:0':   'Nova Pro',
        'us.anthropic.claude-3-5-haiku-20241022-v1:0': 'Claude 3.5 Haiku',
        'us.anthropic.claude-haiku-4-5-20250929-v1:0': 'Claude Haiku 4.5',
        'us.anthropic.claude-3-5-sonnet-20241022-v2:0':'Claude 3.5 Sonnet v2',
        'us.anthropic.claude-sonnet-4-5-20250929-v1:0':'Claude Sonnet 4.5'
    };
    return map[id] || id.replace(/^us\.[a-z]+\./, '');
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false }) + ' · ' + d.toLocaleDateString();
}

function relTime(ts) {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 5) return 'just now';
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff/60)}m ago`;
    if (diff < 86400) return `${Math.round(diff/3600)}h ago`;
    return `${Math.round(diff/86400)}d ago`;
}

/* Cost can be < $0.0001 per call on Nova Micro — show enough precision
 * to see the tiniest token spend, but trim trailing zeros to keep it clean. */
function formatCents(c) {
    if (c >= 100) return (c / 100).toFixed(2) + '$';
    if (c >= 1)   return c.toFixed(2) + '¢';
    // Sub-cent territory — show in millicents (1¢ = 1000 m¢)
    if (c >= 0.001) return (c * 1000).toFixed(2) + 'm¢';
    return '<1m¢';
}
