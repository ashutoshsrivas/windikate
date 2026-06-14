'use client';

import { useRef, useState } from 'react';

export default function UploadZone({ label, hint, accept, onFile, file }) {
    const inputRef = useRef(null);
    const [drag, setDrag] = useState(false);

    function handleFiles(list) {
        if (!list || !list.length) return;
        onFile(list[0]);
    }

    return (
        <div
            className={`relative rounded-2xl border-2 border-dashed p-7 transition-colors ${drag ? 'border-brand-500 bg-brand-500/5' : 'border-edge bg-surface hover:border-brand-500/40'}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            role="button" tabIndex={0}
        >
            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => handleFiles(e.target.files)} />
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${file ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-surface-raised border-edge text-brand-300'}`}>
                    <i className={`bi ${file ? 'bi-check2-circle' : 'bi-cloud-upload'} text-xl`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{label}</div>
                    {file ? (
                        <div className="text-xs text-ink2-muted mt-1 truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    ) : (
                        <div className="text-xs text-ink2-faint mt-1">{hint}</div>
                    )}
                </div>
                {file && (
                    <button onClick={e => { e.stopPropagation(); onFile(null); }} className="text-ink2-faint hover:text-ink2 text-xs px-2 py-1" aria-label="Remove file">
                        <i className="bi bi-x-lg" />
                    </button>
                )}
            </div>
        </div>
    );
}
