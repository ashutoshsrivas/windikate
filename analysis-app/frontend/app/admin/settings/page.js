'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function AdminSettings() {
    const [models, setModels] = useState([]);
    const [s, setS] = useState(null);
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState(null);

    // ─── Serper key — explicit save flow (paste-into-password-field is
    // blocked by some browsers/extensions, so we use a text input + button).
    const [serperKey, setSerperKey]     = useState('');
    const [showKey, setShowKey]         = useState(false);
    const [savingKey, setSavingKey]     = useState(false);
    const [testing, setTesting]         = useState(false);
    const [testResult, setTestResult]   = useState(null);

    async function saveSerperKey() {
        if (!serperKey.trim()) return;
        setSavingKey(true);
        try {
            await save({ serper_api_key: serperKey.trim() });
            setSerperKey('');                 // clear from DOM
        } finally { setSavingKey(false); }
    }
    async function runTest() {
        setTesting(true); setTestResult(null);
        try {
            const res = await api.adminTestSearch({});
            setTestResult({ ok: true, hit: res.hit, query: res.query });
        } catch (e) {
            setTestResult({ ok: false, error: e.body?.error || e.message });
        } finally { setTesting(false); }
    }

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

    if (!s) return <div className="text-ink2-faint">Loading…</div>;

    const currentModel = String(s.default_model || '');
    const cap = s.monthly_cap_cents != null ? (Number(s.monthly_cap_cents) / 100).toFixed(2) : '';

    return (
        <div className="space-y-8 max-w-3xl">
            {err && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{err}</div>}
            {saved && <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-2"><i className="bi bi-check2-circle"></i>Saved</div>}

            <section>
                <h2 className="text-lg font-semibold mb-1">Bedrock</h2>
                <p className="text-ink2-muted text-sm mb-4">Globally enable or disable AI generation. When off, all services fall back to deterministic templates.</p>
                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-surface border border-edge">
                    <input type="checkbox" checked={!!s.bedrock_enabled} onChange={e => save({ bedrock_enabled: e.target.checked })} className="w-5 h-5 accent-brand-500" />
                    <div>
                        <div className="font-medium">Bedrock enabled</div>
                        <div className="text-xs text-ink2-muted">Currently: <span className={s.bedrock_enabled ? 'text-emerald-400' : 'text-rose-400'}>{s.bedrock_enabled ? 'ON' : 'OFF'}</span></div>
                    </div>
                </label>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-1">Default model</h2>
                <p className="text-ink2-muted text-sm mb-4">Used for any user who doesn’t have an allowlist set.</p>
                <div className="space-y-2">
                    {models.map(m => (
                        <label key={m.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${currentModel === m.id ? 'bg-brand-600/15 border-brand-500' : 'bg-surface border-edge hover:border-edge'}`}>
                            <input type="radio" name="defmodel" checked={currentModel === m.id} onChange={() => save({ default_model: m.id })} className="mt-1.5 accent-brand-500" />
                            <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium">{m.label}</div>
                                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${m.tier === 'cheap' ? 'bg-emerald-500/15 text-emerald-300' : m.tier === 'balanced' ? 'bg-amber-500/15 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>{m.tier}</span>
                                </div>
                                <div className="text-xs text-ink2-faint font-mono mt-1">{m.id}</div>
                                <div className="text-sm text-ink2-muted mt-2">{m.good_for}</div>
                                <div className="grid grid-cols-4 gap-2 mt-3 text-[11px] font-mono text-ink2-muted">
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
                <h2 className="text-lg font-semibold mb-1">Live web search</h2>
                <p className="text-ink2-muted text-sm mb-4">
                    When on, every deck upload pulls fresh authoritative citations for each benchmark via Google SERP (Serper.dev).
                    Results cache for {s.web_search_ttl_days || 30} days, so repeat decks don't burn the quota.
                    When off, the report falls back to the curated static URLs in the deviation engine.
                </p>
                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-surface border border-edge">
                    <input type="checkbox" checked={!!s.web_search_enabled}
                        onChange={e => save({ web_search_enabled: e.target.checked })}
                        className="w-5 h-5 accent-brand-500" />
                    <div>
                        <div className="font-medium">Web search enabled</div>
                        <div className="text-xs text-ink2-muted">
                            Currently: <span className={s.web_search_enabled ? 'text-emerald-500' : 'text-rose-500'}>
                                {s.web_search_enabled ? 'ON' : 'OFF'}
                            </span>
                            {s.web_search_enabled && !s.serper_api_key && <span className="text-amber-500"> · key missing</span>}
                        </div>
                    </div>
                </label>
                <div className="mt-3 space-y-3">
                    {/* API key — text input, paste-friendly, explicit Save */}
                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-ink2-faint mb-1.5">
                            Serper.dev API key
                            {s.serper_api_key && (
                                <span className="ml-2 normal-case font-sans text-ink2-muted">
                                    · saved as <span className="font-mono">{s.serper_api_key}</span>
                                </span>
                            )}
                        </label>
                        <div className="flex items-stretch gap-2">
                            <div className="relative flex-1">
                                <input
                                    type={showKey ? 'text' : 'text'}
                                    value={serperKey}
                                    onChange={e => setSerperKey(e.target.value)}
                                    onPaste={e => {
                                        const txt = (e.clipboardData || window.clipboardData)?.getData('text');
                                        if (txt) {
                                            e.preventDefault();
                                            setSerperKey(txt.trim());
                                        }
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveSerperKey(); } }}
                                    placeholder={s.serper_api_key ? 'paste a new key to replace the saved one' : 'paste your Serper key here'}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="field font-mono text-xs pr-10"
                                    style={!showKey && serperKey ? { WebkitTextSecurity: 'disc' } : undefined}
                                />
                                {serperKey && (
                                    <button type="button" onClick={() => setShowKey(v => !v)}
                                        title={showKey ? 'Hide' : 'Show'}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink2-muted hover:text-ink2 p-1">
                                        <i className={`bi ${showKey ? 'bi-eye-slash' : 'bi-eye'} text-sm`} />
                                    </button>
                                )}
                            </div>
                            <button onClick={saveSerperKey} disabled={!serperKey.trim() || savingKey}
                                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50 shrink-0">
                                {savingKey ? 'Saving…' : (s.serper_api_key ? 'Replace key' : 'Save key')}
                            </button>
                            <button onClick={runTest} disabled={testing || (!s.serper_api_key && !serperKey.trim())}
                                title="Run one live Google query against the saved key"
                                className="px-4 py-2 rounded-xl border border-edge bg-surface hover:bg-surface-raised text-sm font-medium disabled:opacity-50 shrink-0">
                                {testing ? 'Testing…' : 'Test'}
                            </button>
                        </div>
                        <p className="text-[11px] text-ink2-faint mt-1.5">
                            Get a free key (2,500/mo) at <a className="text-brand-500 hover:underline" href="https://serper.dev" target="_blank" rel="noreferrer">serper.dev</a>.
                            Press Enter to save · paste works as expected · the key is never echoed back in clear, only the first/last 4 chars.
                        </p>
                        {testResult && (
                            <div className={`mt-3 rounded-lg border px-3 py-2.5 text-xs
                                ${testResult.ok
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
                                {testResult.ok ? (
                                    <>
                                        <div className="font-medium flex items-center gap-2"><i className="bi bi-check-circle-fill" />Key works · top result for the test query</div>
                                        <div className="mt-1 text-ink2-muted dark:text-ink2-muted text-[11px]">{testResult.query}</div>
                                        <a href={testResult.hit.url} target="_blank" rel="noreferrer" className="block mt-1 truncate font-mono hover:underline">{testResult.hit.url}</a>
                                        {testResult.hit.title && <div className="mt-0.5 truncate">{testResult.hit.title}</div>}
                                    </>
                                ) : (
                                    <><i className="bi bi-x-circle-fill mr-1.5" /><strong>Failed:</strong> {testResult.error}</>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-end">
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-ink2-faint mb-1.5">Cache TTL (days)</label>
                            <input type="number" min="0" max="365" defaultValue={Number(s.web_search_ttl_days) || 30}
                                onBlur={e => save({ web_search_ttl_days: Number(e.target.value) || 30 })}
                                className="field font-mono text-xs" />
                        </div>
                        <p className="text-[11px] text-ink2-faint pb-2">
                            Repeat decks within this window reuse the cached SERP result instead of re-querying. 30 days is a good default — Google's authoritative pages on these benchmarks rarely change mid-month.
                        </p>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-1">Monthly cap</h2>
                <p className="text-ink2-muted text-sm mb-4">Soft cap — currently informational only; per-user enforcement coming next.</p>
                <div className="flex items-center gap-2">
                    <span className="text-ink2-muted">$</span>
                    <input type="number" step="1" defaultValue={cap}
                        onBlur={e => save({ monthly_cap_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                        className="w-32 px-3 py-2 rounded-lg bg-surface-raised border border-edge" />
                    <span className="text-ink2-muted">per month</span>
                </div>
            </section>
        </div>
    );
}
