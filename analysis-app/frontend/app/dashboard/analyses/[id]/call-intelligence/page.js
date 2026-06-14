'use client';

const FEATURES = [
    { icon: 'bi-mic',           title: 'Full call transcription',       body: 'Auto-record and transcribe every founder call directly in the workspace.' },
    { icon: 'bi-question-square',title: 'Q & A auto-extraction',         body: 'Each question asked and the founder’s answer is captured and linked to its slide.' },
    { icon: 'bi-shield-lock',   title: 'Tamper-proof transcript',       body: 'The full transcript is anchored to a blockchain hash — meeting notes cannot be silently edited.' },
    { icon: 'bi-arrow-repeat',  title: 'Live deviation updates',        body: 'When the founder clarifies, Windikate updates the deviation flags automatically.' },
    { icon: 'bi-bar-chart-line',title: 'Information Coverage Score',    body: 'See, at a glance, how many critical questions the call actually resolved.' }
];

export default function CallIntelligenceTab() {
    return (
        <div className="space-y-8">
            <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-900/40 via-ink-800 to-ink-900 overflow-hidden p-10 sm:p-14 text-center relative">
                <div className="absolute inset-0 bg-grid opacity-[0.05]" />
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-brand-500/30 blur-3xl" />
                <div className="relative">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-300 text-xs font-mono uppercase tracking-wider mb-5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-400" />
                        </span>
                        Roadmap · Q3 2026
                    </div>
                    <h2 className="text-[36px] sm:text-[48px] font-bold tracking-tight leading-[1.1]">Coming soon.</h2>
                    <p className="mt-3 text-ink2-muted max-w-xl mx-auto">Live call intelligence — transcripts, blockchain-anchored notes, and on-the-fly deviation updates.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {FEATURES.map(f => (
                    <div key={f.title} className="rounded-2xl border border-edge bg-surface p-6 hover:border-brand-500/30 transition-colors">
                        <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-300 flex items-center justify-center mb-4"><i className={`bi ${f.icon} text-lg`} /></div>
                        <h3 className="font-semibold mb-1.5">{f.title}</h3>
                        <p className="text-sm text-ink2-muted leading-relaxed">{f.body}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
