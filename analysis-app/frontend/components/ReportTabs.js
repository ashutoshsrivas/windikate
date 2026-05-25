'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
    { key: '',                   label: 'Report',            icon: 'bi-clipboard-data' },
    { key: 'questions',          label: 'Question',          icon: 'bi-patch-question' },
    { key: 'call-intelligence',  label: 'Call Intelligence', icon: 'bi-telephone' },
    { key: 'apercept',           label: 'Apercept',          icon: 'bi-cpu' },
    { key: 'memo',               label: 'Memo',              icon: 'bi-file-earmark-text' }
];

export default function ReportTabs({ analysisId }) {
    const pathname = usePathname();
    return (
        <nav className="border-b border-white/10 -mx-6 lg:-mx-10 px-6 lg:px-10 sticky top-[64px] bg-ink-950/85 backdrop-blur-lg z-30">
            <ul className="flex items-center gap-1 overflow-x-auto">
                {TABS.map(t => {
                    const href = `/dashboard/analyses/${analysisId}${t.key ? '/' + t.key : ''}`;
                    const active = pathname === href || (t.key === '' && pathname === `/dashboard/analyses/${analysisId}`);
                    return (
                        <li key={t.key || 'root'}>
                            <Link href={href} className={`inline-flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${active ? 'border-brand-500 text-white' : 'border-transparent text-white/55 hover:text-white'}`}>
                                <i className={`bi ${t.icon}`} />{t.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
