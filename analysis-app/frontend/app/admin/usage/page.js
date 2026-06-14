'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function AdminUsage() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);

    useEffect(() => { api.adminUsage(days).then(setData); }, [days]);

    if (!data) return <div className="text-white/50">Loading…</div>;

    const totalCents = data.daily.reduce((s, d) => s + d.cents, 0);
    const totalCalls = data.daily.reduce((s, d) => s + d.calls, 0);
    const maxCents = Math.max(...data.daily.map(d => d.cents), 1);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-2xl font-bold">Usage</h2>
                    <p className="text-white/55 text-sm mt-1">${(totalCents/100).toFixed(2)} across {totalCalls} calls in the last {days} days</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    {[7, 30, 90].map(n => (
                        <button key={n} onClick={() => setDays(n)} className={`px-3 py-1.5 rounded-lg text-sm ${days === n ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/65 hover:bg-white/10'}`}>{n}d</button>
                    ))}
                </div>
            </div>

            {/* Daily bar chart */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="text-xs font-mono uppercase tracking-wider text-white/45 mb-4">Daily spend</div>
                {data.daily.length === 0 ? (
                    <div className="text-white/40 text-sm py-8 text-center">No AI calls in this window yet.</div>
                ) : (
                    <div className="flex items-end gap-1 h-40">
                        {data.daily.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                                <div className="text-[10px] font-mono text-white/45 opacity-0 group-hover:opacity-100">${(d.cents/100).toFixed(2)}</div>
                                <div className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all" style={{ height: `${(d.cents / maxCents) * 100}%` }}></div>
                                <div className="text-[9px] font-mono text-white/35 mt-1">{d.day.slice(-5)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Per-user table */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10 text-xs font-mono uppercase tracking-wider text-white/45">By user</div>
                <table className="w-full text-sm">
                    <thead className="text-white/55 text-xs uppercase font-mono">
                        <tr>
                            <th className="text-left px-5 py-3">User</th>
                            <th className="text-right px-5 py-3">Calls</th>
                            <th className="text-right px-5 py-3">Window spend</th>
                            <th className="text-right px-5 py-3">Month-to-date</th>
                            <th className="text-right px-5 py-3">Cap</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.by_user.map(u => (
                            <tr key={u.id} className="hover:bg-white/[0.02]">
                                <td className="px-5 py-3">
                                    <div className="font-medium">{u.display_name || '—'}</div>
                                    <div className="text-xs text-white/55">{u.email}</div>
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-xs">{u.calls}</td>
                                <td className="px-5 py-3 text-right">${(u.cents/100).toFixed(2)}</td>
                                <td className="px-5 py-3 text-right">${(u.monthly_spend_cents/100).toFixed(2)}</td>
                                <td className="px-5 py-3 text-right text-white/55">{u.monthly_cap_cents != null ? `$${(u.monthly_cap_cents/100).toFixed(0)}` : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
