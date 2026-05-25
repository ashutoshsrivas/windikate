'use client';

import { useEffect, useState } from 'react';

const STEPS = [
    { key: 'extract',     label: 'Extracting slides',         icon: 'bi-bounding-box' },
    { key: 'parse',       label: 'Parsing financial data',    icon: 'bi-table' },
    { key: 'competitors', label: 'Identifying competitors',   icon: 'bi-people' },
    { key: 'deviations',  label: 'Building deviation report', icon: 'bi-graph-down-arrow' }
];

/* Animates step-by-step processing while the backend pipeline runs.
 * onDone is called when the parent finishes the request. */
export default function ProcessingBar({ active, finished }) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (!active) { setCurrent(0); return; }
        if (finished) { setCurrent(STEPS.length); return; }
        const t = setInterval(() => setCurrent(c => Math.min(c + 1, STEPS.length - 1)), 900);
        return () => clearInterval(t);
    }, [active, finished]);

    return (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-ink-800/80 to-ink-900/80 p-6">
            <div className="flex items-center justify-between mb-5">
                <div className="text-sm font-semibold flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
                    </span>
                    Processing your deck
                </div>
                <div className="text-[11px] font-mono text-white/45">{finished ? 'complete' : `step ${Math.min(current + 1, STEPS.length)} / ${STEPS.length}`}</div>
            </div>

            <ul className="space-y-2.5">
                {STEPS.map((s, i) => {
                    const done = finished || i < current;
                    const active = !finished && i === current;
                    return (
                        <li key={s.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${done ? 'border-emerald-500/30 bg-emerald-500/5' : active ? 'border-brand-500/30 bg-brand-500/5 shimmer' : 'border-white/10 bg-white/[0.02]'}`}>
                            <i className={`bi ${s.icon} text-lg ${done ? 'text-emerald-400' : active ? 'text-brand-300' : 'text-white/40'}`} />
                            <span className={`flex-1 text-sm ${done ? 'text-white' : active ? 'text-white/85' : 'text-white/50'}`}>{s.label}</span>
                            <span className="text-base">
                                {done ? <i className="bi bi-check2 text-emerald-400" /> :
                                 active ? <i className="bi bi-arrow-repeat text-brand-300 animate-spin inline-block" /> :
                                 <span className="text-white/30 text-xs font-mono">queued</span>}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
