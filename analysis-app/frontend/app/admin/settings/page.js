'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function AdminSettings() {
    const [models, setModels] = useState([]);
    const [s, setS] = useState(null);
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState(null);

    useEffect(() => {
        Promise.all([api.adminSettings(), api.adminModels()]).then(([settingsRes, modelsRes]) => {
            setS(settingsRes.settings);
            setModels(modelsRes.models);
        });
    }, []);

    async function save(patch) {
        setErr(null);
        try {
            const res = await api.adminPutSettings(patch);
            setS(res.settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (e) {
            setErr(e.body?.error || e.message);
        }
    }

    if (!s) return <div className="text-white/50">Loading…</div>;

    const currentModel = String(s.default_model || '');
    const cap = s.monthly_cap_cents != null ? (Number(s.monthly_cap_cents) / 100).toFixed(2) : '';

    return (
        <div className="space-y-8 max-w-3xl">
            {err && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{err}</div>}
            {saved && <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-2"><i className="bi bi-check2-circle"></i>Saved</div>}

            <section>
                <h2 className="text-lg font-semibold mb-1">Bedrock</h2>
                <p className="text-white/55 text-sm mb-4">Globally enable or disable AI generation. When off, all services fall back to deterministic templates.</p>
                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/10">
                    <input type="checkbox" checked={!!s.bedrock_enabled} onChange={e => save({ bedrock_enabled: e.target.checked })} className="w-5 h-5 accent-brand-500" />
                    <div>
                        <div className="font-medium">Bedrock enabled</div>
                        <div className="text-xs text-white/55">Currently: <span className={s.bedrock_enabled ? 'text-emerald-400' : 'text-rose-400'}>{s.bedrock_enabled ? 'ON' : 'OFF'}</span></div>
                    </div>
                </label>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-1">Default model</h2>
                <p className="text-white/55 text-sm mb-4">Used for any user who doesn’t have an allowlist set.</p>
                <div className="space-y-2">
                    {models.map(m => (
                        <label key={m.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentModel === m.id ? 'bg-brand-600/15 border-brand-500' : 'bg-white/[0.02] border-white/10 hover:border-white/20'}`}>
                            <input type="radio" name="defmodel" checked={currentModel === m.id} onChange={() => save({ default_model: m.id })} className="mt-1.5 accent-brand-500" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium">{m.label}</div>
                                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${m.tier === 'cheap' ? 'bg-emerald-500/15 text-emerald-300' : m.tier === 'balanced' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>{m.tier}</span>
                                </div>
                                <div className="text-xs text-white/45 font-mono mt-1">{m.id}</div>
                                <div className="text-sm text-white/65 mt-2">{m.good_for}</div>
                                <div className="grid grid-cols-4 gap-2 mt-3 text-[11px] font-mono text-white/55">
                                    <div>in ${m.inputPer1M.toFixed(2)}/M</div>
                                    <div>out ${m.outputPer1M.toFixed(2)}/M</div>
                                    <div>{m.speed}</div>
                                    <div>{(m.context/1000).toFixed(0)}k ctx</div>
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-1">Monthly cap</h2>
                <p className="text-white/55 text-sm mb-4">Soft cap — currently informational only; per-user enforcement coming next.</p>
                <div className="flex items-center gap-2">
                    <span className="text-white/55">$</span>
                    <input type="number" step="1" defaultValue={cap}
                        onBlur={e => save({ monthly_cap_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                        className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/15" />
                    <span className="text-white/55">per month</span>
                </div>
            </section>
        </div>
    );
}
