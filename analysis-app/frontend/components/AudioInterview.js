'use client';

import { useEffect, useRef, useState } from 'react';

/* ============================================================
 *  AudioInterview — one-prompt recorder + live transcript.
 *
 *  Used from the SAMAJ intake page in "audio mode": the user
 *  hits Record, talks freely answering the stage's prompts, and
 *  the Web Speech API streams a transcript. When they're done,
 *  the transcript goes to the backend's /transcribe-stage
 *  endpoint, which uses Bedrock to coerce it into the form's
 *  expected shape.
 *
 *  Browser support: Chrome / Edge ship webkitSpeechRecognition.
 *  Firefox / Safari fall back to a "type or paste what you said"
 *  mode — the same backend call still works on the typed text.
 *
 *  Props:
 *    title         (string)  big H2 above the prompt
 *    prompts       (string[]) list of bullet questions for this stage
 *    onTranscript  (fn)      called with the raw transcript string when "Use this" is clicked
 *    onSkip        (fn?)     optional — go back to typing for this stage
 *    busy          (bool)    parent is calling the backend; lock the button
 * ========================================================= */

export default function AudioInterview({ title, prompts, onTranscript, onSkip, busy }) {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interim, setInterim] = useState('');
    const [supported, setSupported] = useState(true);
    const [elapsed, setElapsed] = useState(0);
    const recogRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        const SR = typeof window !== 'undefined'
            && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SR) { setSupported(false); return; }
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = 'en-IN';
        r.onresult = (e) => {
            let final = '';
            let inter  = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const txt = e.results[i][0].transcript;
                if (e.results[i].isFinal) final += txt + ' ';
                else                       inter += txt + ' ';
            }
            if (final) setTranscript(t => (t + final).replace(/\s+/g, ' ').trim() + ' ');
            setInterim(inter.trim());
        };
        r.onerror = (e) => {
            console.warn('SpeechRecognition error', e.error);
            if (e.error === 'no-speech' || e.error === 'audio-capture') {
                stop();
            }
        };
        r.onend = () => {
            // If recording is still flagged on, browser auto-stopped; restart.
            if (recogRef.current?._wanted) {
                try { r.start(); } catch {}
            }
        };
        recogRef.current = r;
        return () => { try { r.stop(); } catch {} };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function start() {
        if (!supported) return;
        recogRef.current._wanted = true;
        try { recogRef.current.start(); } catch {}
        setRecording(true);
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    function stop() {
        if (recogRef.current) {
            recogRef.current._wanted = false;
            try { recogRef.current.stop(); } catch {}
        }
        setRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    function reset() {
        stop();
        setTranscript(''); setInterim(''); setElapsed(0);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

    return (
        <div className="space-y-5">
            {/* Stage prompts */}
            <div>
                <h2 className="text-xl font-semibold text-ink2">{title}</h2>
                <ul className="mt-3 space-y-1.5 text-sm text-ink2-muted">
                    {prompts.map((p, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-brand-500/15 text-brand-500 text-[10px] font-mono inline-flex items-center justify-center mt-0.5">{i + 1}</span>
                            <span>{p}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Recorder */}
            <div className="rounded-2xl border border-edge bg-surface p-6 lg:p-8">
                {!supported ? (
                    <div className="text-sm text-amber-600 dark:text-amber-400">
                        <i className="bi bi-mic-mute mr-2" />
                        Your browser doesn't support live speech-to-text. Chrome or Edge will give you that —
                        meanwhile, just type or paste what you'd say below and we'll structure it the same way.
                        <textarea className="field min-h-[160px] mt-3" value={transcript}
                            onChange={e => setTranscript(e.target.value)}
                            placeholder="Type or paste your spoken response here…" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-center mb-5">
                            <button onClick={recording ? stop : start} disabled={busy}
                                className={`relative w-24 h-24 rounded-full inline-flex items-center justify-center text-3xl text-white transition-all shadow-glow
                                    ${recording ? 'bg-rose-500 animate-pulse' : 'bg-brand-600 hover:bg-brand-500'}
                                    ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <i className={`bi ${recording ? 'bi-stop-fill' : 'bi-mic-fill'}`} />
                                {recording && (
                                    <span className="absolute -inset-2 rounded-full border-2 border-rose-300/50 animate-ping" />
                                )}
                            </button>
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono text-ink2-faint">
                            <span>{recording ? `recording · ${formatMMSS(elapsed)}` : (transcript ? `${wordCount} words captured` : 'tap to record')}</span>
                            <span>{recording ? <span className="text-rose-500">● LIVE</span> : (transcript ? 'tap again to add more' : '')}</span>
                        </div>

                        {/* Transcript preview */}
                        {(transcript || interim) && (
                            <div className="mt-5 rounded-xl border border-edge bg-surface-soft p-4 max-h-56 overflow-y-auto text-sm">
                                <span className="text-ink2">{transcript}</span>
                                <span className="text-ink2-faint italic">{interim}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    {transcript && !recording && (
                        <button onClick={reset} className="px-3 py-2 rounded-lg text-sm text-ink2-muted hover:text-ink2 hover:bg-surface-raised">
                            <i className="bi bi-arrow-counterclockwise mr-1" />Reset
                        </button>
                    )}
                    {onSkip && (
                        <button onClick={onSkip} className="px-3 py-2 rounded-lg text-sm text-ink2-muted hover:text-ink2 hover:bg-surface-raised">
                            <i className="bi bi-keyboard mr-1" />Type instead
                        </button>
                    )}
                </div>
                <button onClick={() => onTranscript(transcript.trim())} disabled={busy || !transcript.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50">
                    <i className="bi bi-magic" />
                    {busy ? 'AI working…' : 'Use this answer'}
                </button>
            </div>
        </div>
    );
}

function formatMMSS(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
