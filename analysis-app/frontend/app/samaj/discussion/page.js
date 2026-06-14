'use client';

import Link from 'next/link';

export default function DiscussionPlaceholder() {
    return (
        <div className="max-w-2xl mx-auto text-center py-16">
            <i className="bi bi-chat-square-dots text-6xl text-brand-500 block mb-4" />
            <h1 className="text-3xl font-bold tracking-tight">Group discussion</h1>
            <p className="text-ink2-muted mt-3">
                Pick a question, choose a subset of the SAMAJ map, and watch the twins discuss.
                Each twin will share its personal view first, then debate, then converge on a group consensus.
            </p>
            <div className="mt-6 rounded-2xl border border-dashed border-edge bg-surface p-6 text-sm text-ink2-muted">
                The simulation engine is wiring up. Once approved twins are on the map, this page becomes a
                multi-select prompt console. For now, explore who's been invited from the admin SAMAJ console.
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
                <Link href="/samaj" className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium">← Back to map</Link>
                <Link href="/admin/samaj" className="px-4 py-2 rounded-xl border border-edge text-ink2 text-sm">SAMAJ console</Link>
            </div>
        </div>
    );
}
