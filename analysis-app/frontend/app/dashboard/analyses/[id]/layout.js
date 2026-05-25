'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReportTabs from '../../../../components/ReportTabs';
import { api } from '../../../../lib/api';

/* Shared layout for every tab in an analysis.
 * Loads the analysis once, exposes it to child pages via window event +
 * also provides the same data via cache keyed on the id. */
export default function AnalysisLayout({ children }) {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        api.getAnalysis(id)
            .then(d => { if (alive) { setData(d); window.__analysis = d; window.dispatchEvent(new CustomEvent('analysis:loaded', { detail: d })); } })
            .catch(err => {
                if (err.status === 404) router.replace('/dashboard');
                else setError(err.body?.error || err.message);
            });
        return () => { alive = false; };
    }, [id, router]);

    if (error) return <div className="p-6 text-rose-300">{error}</div>;
    if (!data) return <div className="p-6 text-white/45">Loading analysis…</div>;

    const a = data.analysis;
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <Link href="/dashboard" className="text-xs text-white/45 hover:text-white inline-flex items-center gap-1.5"><i className="bi bi-arrow-left" />All analyses</Link>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1">{a.company_name || 'Untitled analysis'}</h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-white/55">
                        {a.stage && <span>{a.stage}</span>}
                        <span>·</span>
                        <span>Analyzed {new Date(a.created_at).toLocaleString()}</span>
                        {a.apercept_enabled ? <><span>·</span><span className="text-brand-300">Apercept on</span></> : null}
                    </div>
                </div>
                <Summary deviations={data.deviations} />
            </div>

            <ReportTabs analysisId={id} />

            <div className="pt-2">{children}</div>
        </div>
    );
}

function Summary({ deviations }) {
    const counts = deviations.reduce((acc, d) => {
        const eff = d.edited_severity || d.severity;
        acc[eff] = (acc[eff] || 0) + 1;
        return acc;
    }, {});
    return (
        <div className="grid grid-cols-3 gap-2 text-center min-w-[280px]">
            <Stat sev="red"    label="Critical"  value={counts.red    || 0} />
            <Stat sev="yellow" label="Moderate"  value={counts.yellow || 0} />
            <Stat sev="green"  label="Validated" value={counts.green  || 0} />
        </div>
    );
}
function Stat({ sev, label, value }) {
    return (
        <div className={`rounded-xl border px-3 py-2 sev-${sev}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[11px] uppercase tracking-wider font-mono opacity-70">{label}</div>
        </div>
    );
}
