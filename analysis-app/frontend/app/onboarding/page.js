'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

const ROLES = [
    { value: 'vc_analyst',           label: 'VC Analyst',          icon: 'bi-graph-up' },
    { value: 'investment_associate', label: 'Investment Associate',icon: 'bi-briefcase' },
    { value: 'incubator_manager',    label: 'Incubator Manager',   icon: 'bi-egg-fried' },
    { value: 'angel_investor',       label: 'Angel Investor',      icon: 'bi-stars' }
];

const FOCUS = [
    { value: 'b2b_saas',              label: 'B2B SaaS' },
    { value: 'fintech',               label: 'Fintech' },
    { value: 'healthtech',            label: 'HealthTech' },
    { value: 'deeptech',              label: 'DeepTech' },
    { value: 'consumer',              label: 'Consumer' },
    { value: 'climate',               label: 'Climate' },
    { value: 'startup_incubation',    label: 'Startup Incubation' },
    { value: 'startup_acceleration',  label: 'Startup Acceleration' }
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [role, setRole] = useState(null);
    const [focus, setFocus] = useState([]);
    const [arrMin, setArrMin] = useState('');
    const [arrMax, setArrMax] = useState('');
    const [ratio, setRatio] = useState(3);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.me().then(({ user }) => {
            if (user.display_name) setName(user.display_name);
            if (user.role) setRole(user.role);
            if (user.focus_areas) setFocus(typeof user.focus_areas === 'string' ? JSON.parse(user.focus_areas) : user.focus_areas);
        }).catch(() => router.replace('/'));
    }, [router]);

    function toggleFocus(v) {
        setFocus(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);
    }

    async function continueToStep2() {
        if (!name.trim() || !role || focus.length === 0) {
            setError('Please give us your name, your role, and at least one focus area.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await api.onboarding({ display_name: name.trim(), role, focus_areas: focus });
            setStep(2);
        } catch (err) {
            setError(err.body?.error || err.message);
        } finally { setSaving(false); }
    }

    async function finish(withBenchmarks) {
        setSaving(true); setError(null);
        try {
            const body = { display_name: name.trim(), role, focus_areas: focus };
            if (withBenchmarks) {
                body.benchmarks = {
                    preseed_arr_min_inr: arrMin ? Number(arrMin) * 1e7 : null,
                    preseed_arr_max_inr: arrMax ? Number(arrMax) * 1e7 : null,
                    cac_ltv_ratio: Number(ratio) || null
                };
            }
            await api.onboarding(body);
            router.replace('/dashboard');
        } catch (err) {
            setError(err.body?.error || err.message);
        } finally { setSaving(false); }
    }

    return (
        <main className="min-h-screen flex items-start justify-center px-6 py-12">
            <div className="w-full max-w-3xl">
                <Stepper step={step} />

                {step === 1 && (
                    <section className="mt-8 rounded-3xl border border-edge bg-gradient-to-br from-ink-800/80 to-ink-900/80 p-8 sm:p-10">
                        <div className="text-xs font-mono uppercase tracking-wider text-brand-300 mb-2">Step 1 · Role and focus</div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Let's set you up.</h1>
                        <p className="mt-2 text-ink2-muted">A few quick choices so every report is calibrated to how you actually invest.</p>

                        <div className="mt-8 space-y-7">
                            <Field label="What would Windikate call you?">
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Riya"
                                    className="w-full sm:w-80 px-4 py-3 rounded-xl bg-surface-raised border border-edge focus:border-brand-500 focus:outline-none" />
                            </Field>

                            <Field label="Your role" hint="Choose one">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {ROLES.map(r => (
                                        <button key={r.value} type="button" onClick={() => setRole(r.value)}
                                            className={`flex flex-col items-start gap-2 px-4 py-4 rounded-xl border transition-all ${role === r.value ? 'border-brand-500 bg-brand-600/15' : 'border-edge bg-surface-raised hover:bg-surface-raised'}`}>
                                            <i className={`bi ${r.icon} text-xl ${role === r.value ? 'text-brand-300' : 'text-ink2-muted'}`} />
                                            <span className="text-sm font-medium text-left leading-tight">{r.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </Field>

                            <Field label="Firm focus" hint="Pick all that apply">
                                <div className="flex flex-wrap gap-2">
                                    {FOCUS.map(f => {
                                        const active = focus.includes(f.value);
                                        return (
                                            <button key={f.value} type="button" onClick={() => toggleFocus(f.value)}
                                                className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${active ? 'bg-brand-600/20 border-brand-500 text-ink2' : 'bg-surface-raised border-edge text-ink2-muted hover:bg-surface-raised'}`}>
                                                <i className={`bi ${active ? 'bi-check-circle-fill' : 'bi-circle'} mr-1.5 text-xs`} />{f.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Field>

                            {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

                            <div className="pt-2 flex justify-end">
                                <button onClick={continueToStep2} disabled={saving}
                                    className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-ink2 font-medium px-6 py-3 rounded-xl shadow-glow transition-all">
                                    {saving ? 'Saving…' : 'Continue'}<i className="bi bi-arrow-right" />
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {step === 2 && (
                    <section className="mt-8 rounded-3xl border border-edge bg-gradient-to-br from-ink-800/80 to-ink-900/80 p-8 sm:p-10">
                        <div className="text-xs font-mono uppercase tracking-wider text-brand-300 mb-2">Step 2 · Benchmarks (optional)</div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Calibrate to your fund.</h1>
                        <p className="mt-2 text-ink2-muted">These thresholds let the deviation engine compare against <em>your</em> standards, not just industry medians.</p>

                        <div className="mt-8 space-y-8">
                            <Field label="Typical pre-seed ARR range (₹ Cr)">
                                <div className="flex items-center gap-3">
                                    <input value={arrMin} onChange={e => setArrMin(e.target.value)} type="number" min="0" step="0.1" placeholder="min" className="w-32 px-4 py-3 rounded-xl bg-surface-raised border border-edge focus:border-brand-500 focus:outline-none" />
                                    <span className="text-ink2-faint">to</span>
                                    <input value={arrMax} onChange={e => setArrMax(e.target.value)} type="number" min="0" step="0.1" placeholder="max" className="w-32 px-4 py-3 rounded-xl bg-surface-raised border border-edge focus:border-brand-500 focus:outline-none" />
                                </div>
                                <p className="text-xs text-ink2-faint mt-2">Stored in INR for benchmark comparison.</p>
                            </Field>

                            <Field label={`Acceptable CAC : LTV ratio · 1 : ${ratio}`} hint="Drag to set your floor">
                                <input type="range" min="1" max="5" step="0.5" value={ratio} onChange={e => setRatio(e.target.value)}
                                    className="w-full sm:w-96 accent-brand-500" />
                                <div className="flex justify-between text-[11px] font-mono text-ink2-faint w-full sm:w-96 mt-1">
                                    <span>1:1</span><span>1:2</span><span>1:3</span><span>1:4</span><span>1:5</span>
                                </div>
                            </Field>

                            {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div>}

                            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button onClick={() => finish(false)} disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 bg-surface-raised hover:bg-surface-raised border border-edge text-ink2 font-medium px-6 py-3 rounded-xl transition-all">Skip for now</button>
                                <button onClick={() => finish(true)} disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-ink2 font-medium px-6 py-3 rounded-xl shadow-glow transition-all">
                                    {saving ? 'Saving…' : 'Save preferences'}<i className="bi bi-check2" />
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

function Stepper({ step }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            <Pill active={step >= 1} done={step > 1} num="1" label="Role & focus" />
            <span className="flex-1 h-px bg-surface-raised" />
            <Pill active={step >= 2} num="2" label="Benchmarks" />
        </div>
    );
}
function Pill({ active, done, num, label }) {
    return (
        <div className={`flex items-center gap-2 ${active ? 'text-ink2' : 'text-ink2-faint'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${done ? 'bg-emerald-500 border-emerald-400 text-ink2' : active ? 'bg-brand-600 border-brand-500' : 'bg-surface-raised border-edge'}`}>
                {done ? <i className="bi bi-check2" /> : num}
            </span>
            <span className="font-medium">{label}</span>
        </div>
    );
}
function Field({ label, hint, children }) {
    return (
        <div>
            <div className="flex items-baseline justify-between mb-2.5">
                <label className="text-sm font-medium text-ink2">{label}</label>
                {hint && <span className="text-[11px] font-mono text-ink2-faint uppercase tracking-wider">{hint}</span>}
            </div>
            {children}
        </div>
    );
}
