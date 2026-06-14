'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';

/* SAMAJ 1:1 chat — talk to a single approved persona.
 *
 *   /samaj/chat/[id]   id = session id (NOT persona id).
 *
 * Sessions are created from /samaj when you click "Start chat" — the
 * map inspector POSTs to /api/samaj/sessions with mode=chat and a
 * single persona_id, then routes here with the returned session id.    */

export default function SamajChat() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData]       = useState(null);   // { session, personas, messages }
    const [draft, setDraft]     = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError]     = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        api.samajGetSession(id)
            .then(setData)
            .catch(e => setError(e.body?.error || e.message));
    }, [id]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [data]);

    async function send(e) {
        e?.preventDefault();
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true); setError(null);

        // Optimistic user-message bubble
        const tempUser = { id: 'temp-' + Date.now(), speaker: 'user', content: text };
        setData(d => ({ ...d, messages: [...d.messages, tempUser] }));
        setDraft('');

        try {
            const out = await api.samajSendMessage(id, text);
            setData(d => ({
                ...d,
                messages: [
                    ...d.messages.filter(m => m.id !== tempUser.id),
                    { ...out.user_message,    speaker: 'user' },
                    { ...out.persona_message, persona_id: d.personas[0]?.id, phase: out.persona_message.ai_used ? 'ai' : 'offline' }
                ]
            }));
        } catch (e) {
            setError(e.body?.error || e.message);
            setData(d => ({ ...d, messages: d.messages.filter(m => m.id !== tempUser.id) }));
        } finally { setSending(false); }
    }

    if (error) return <div className="text-rose-500 text-sm">{error}</div>;
    if (!data) return <div className="text-ink2-faint">Loading chat…</div>;

    const persona = data.personas[0];
    return (
        <div className="flex flex-col h-[calc(100vh-7rem)] gap-4">
            {/* Persona header */}
            <header className="rounded-2xl border border-edge bg-surface p-5 flex items-center gap-4">
                <Avatar persona={persona} size={56} />
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-ink2-faint">{persona.archetype || 'persona'}</div>
                    <h1 className="text-xl font-bold leading-tight">{persona.display_name}</h1>
                    <p className="text-sm text-ink2-muted mt-0.5 line-clamp-2">{persona.headline || ''}</p>
                </div>
                <Link href="/samaj" className="text-xs text-ink2-muted hover:text-ink2 px-3 py-1.5 rounded-md border border-edge hover:bg-surface-raised">
                    <i className="bi bi-grid-3x3-gap mr-1" />Map
                </Link>
            </header>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl border border-edge bg-surface p-5 space-y-3">
                {data.messages.length === 0 && (
                    <div className="text-center text-ink2-faint text-sm py-12">
                        <i className="bi bi-chat-dots text-3xl block mb-2 opacity-60" />
                        Say something to start. {persona.display_name} responds in their own voice.
                    </div>
                )}
                {data.messages.map(m => (
                    <Bubble key={m.id} message={m} persona={persona} />
                ))}
                {sending && (
                    <div className="flex items-center gap-2 text-xs text-ink2-faint pl-12">
                        <Dot /><Dot delay="120" /><Dot delay="240" />
                        <span>{persona.display_name} is composing…</span>
                    </div>
                )}
            </div>

            {/* Composer */}
            <form onSubmit={send} className="rounded-2xl border border-edge bg-surface p-3 flex items-end gap-2">
                <textarea value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Talk to ${persona.display_name}…`}
                    rows={1}
                    className="flex-1 field min-h-[44px] resize-none"
                    disabled={sending}
                />
                <button type="submit" disabled={sending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium disabled:opacity-50">
                    <i className="bi bi-send-fill" />Send
                </button>
            </form>

            <p className="text-[11px] text-ink2-faint text-center">
                Enter to send · Shift+Enter for a new line. Conversation is private to you and stored on Windikate.
            </p>
        </div>
    );
}

function Bubble({ message, persona }) {
    const isUser     = message.speaker === 'user';
    const isOffline  = message.phase === 'offline';
    if (isUser) {
        return (
            <div className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl bg-brand-600 text-white px-4 py-2.5 leading-snug whitespace-pre-wrap">
                    {message.content}
                </div>
            </div>
        );
    }
    return (
        <div className="flex gap-3">
            <Avatar persona={persona} size={36} />
            <div className="max-w-[78%]">
                <div className="text-[11px] font-mono text-ink2-faint mb-1">{message.speaker}{isOffline && ' · AI offline'}</div>
                <div className={`rounded-2xl px-4 py-2.5 leading-snug whitespace-pre-wrap border
                    ${isOffline ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                : 'bg-surface-soft border-edge text-ink2'}`}>
                    {message.content}
                </div>
            </div>
        </div>
    );
}

function Avatar({ persona, size = 40 }) {
    const letters = (persona.display_name || '?').slice(0, 2).toUpperCase();
    const hue = persona.avatar_seed ? hashHue(persona.avatar_seed) : 200;
    return (
        <div className="shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white"
             style={{ width: size, height: size,
                      background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue+50)%360} 70% 45%))` }}>
            {letters}
        </div>
    );
}
function hashHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h % 360; }
function Dot({ delay = 0 }) {
    return <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: `${delay}ms` }} />;
}
