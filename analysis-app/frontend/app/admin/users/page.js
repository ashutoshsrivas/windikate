'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function AdminUsers() {
    const [users, setUsers] = useState(null);
    const [models, setModels] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [err, setErr] = useState(null);

    function refresh() {
        Promise.all([api.adminUsers(), api.adminModels()]).then(([u, m]) => {
            setUsers(u.users);
            setModels(m.models);
        });
    }
    useEffect(refresh, []);

    async function createUser(body) {
        setErr(null);
        try { await api.adminCreateUser(body); setShowAdd(false); refresh(); }
        catch (e) { setErr(e.body?.error || e.message); }
    }
    async function patchUser(id, patch) {
        setErr(null);
        try { await api.adminPatchUser(id, patch); setEditing(null); refresh(); }
        catch (e) { setErr(e.body?.error || e.message); }
    }
    async function deleteUser(id, email) {
        if (!confirm(`Delete ${email}? Their analyses become orphaned but kept.`)) return;
        try { await api.adminDeleteUser(id); refresh(); }
        catch (e) { setErr(e.body?.error || e.message); }
    }

    if (!users) return <div className="text-ink2-faint">Loading…</div>;

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Users</h2>
                    <p className="text-ink2-muted text-sm mt-1">{users.length} total · {users.filter(u => u.role === 'admin').length} admins</p>
                </div>
                <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-ink2 font-medium px-5 py-2.5 rounded-xl">
                    <i className="bi bi-plus-lg"></i>Add user
                </button>
            </header>

            {err && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{err}</div>}

            <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-surface-raised text-ink2-muted text-xs uppercase font-mono">
                        <tr>
                            <th className="text-left px-5 py-3">User</th>
                            <th className="text-left px-5 py-3">Role</th>
                            <th className="text-left px-5 py-3">Allowed models</th>
                            <th className="text-right px-5 py-3">Spend (mo)</th>
                            <th className="text-right px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map(u => (
                            <UserRow key={u.id} u={u} models={models}
                                editing={editing === u.id}
                                onEdit={() => setEditing(u.id)}
                                onCancel={() => setEditing(null)}
                                onSave={patch => patchUser(u.id, patch)}
                                onDelete={() => deleteUser(u.id, u.email)} />
                        ))}
                    </tbody>
                </table>
            </div>

            {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreate={createUser} models={models} />}
        </div>
    );
}

function UserRow({ u, models, editing, onEdit, onCancel, onSave, onDelete }) {
    const [role, setRole] = useState(u.role);
    const [allowed, setAllowed] = useState(parseAllowed(u.allowed_models));
    const [cap, setCap] = useState(u.monthly_cap_cents != null ? (u.monthly_cap_cents / 100).toFixed(2) : '');

    function toggleModel(id) {
        setAllowed(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    }

    if (editing) return (
        <tr className="bg-brand-500/5">
            <td className="px-5 py-3 align-top">
                <div className="font-medium">{u.display_name || '—'}</div>
                <div className="text-xs text-ink2-muted">{u.email}</div>
            </td>
            <td className="px-5 py-3 align-top">
                <select value={role} onChange={e => setRole(e.target.value)} className="bg-surface-raised border border-edge rounded px-2 py-1 text-sm">
                    <option value="analyst">analyst</option>
                    <option value="admin">admin</option>
                </select>
            </td>
            <td className="px-5 py-3 align-top">
                <div className="flex flex-wrap gap-1.5 max-w-md">
                    {models.map(m => (
                        <label key={m.id} className={`text-[11px] font-mono px-2 py-1 rounded border cursor-pointer ${allowed.includes(m.id) ? 'bg-brand-600/20 border-brand-500' : 'bg-surface-raised border-edge text-ink2-muted'}`}>
                            <input type="checkbox" className="sr-only" checked={allowed.includes(m.id)} onChange={() => toggleModel(m.id)} />
                            {m.label}
                        </label>
                    ))}
                </div>
                <div className="text-[10px] text-ink2-faint mt-1">Empty = uses global default</div>
            </td>
            <td className="px-5 py-3 align-top text-right">
                <div className="flex items-center justify-end gap-1">
                    <span className="text-ink2-faint text-xs">cap $</span>
                    <input value={cap} onChange={e => setCap(e.target.value)} type="number" step="0.01" placeholder="—" className="w-20 bg-surface-raised border border-edge rounded px-2 py-1 text-sm text-right" />
                </div>
            </td>
            <td className="px-5 py-3 align-top text-right">
                <button onClick={() => onSave({
                    role,
                    allowed_models: allowed.length ? allowed : null,
                    monthly_cap_cents: cap ? Math.round(Number(cap) * 100) : null
                })} className="text-emerald-400 hover:text-emerald-300 text-xs mr-2">Save</button>
                <button onClick={onCancel} className="text-ink2-muted hover:text-ink2 text-xs">Cancel</button>
            </td>
        </tr>
    );

    return (
        <tr className="hover:bg-surface">
            <td className="px-5 py-3">
                <div className="font-medium">{u.display_name || '—'}</div>
                <div className="text-xs text-ink2-muted">{u.email}</div>
            </td>
            <td className="px-5 py-3">
                <span className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded border ${u.role === 'admin' ? 'bg-brand-500/15 text-brand-300 border-brand-500/30' : 'bg-surface-raised text-ink2-muted border-edge'}`}>{u.role}</span>
            </td>
            <td className="px-5 py-3 text-ink2-muted text-xs">
                {(() => {
                    const a = parseAllowed(u.allowed_models);
                    if (!a.length) return <span className="text-ink2-faint">global default</span>;
                    return a.map(id => models.find(m => m.id === id)?.label || id).join(', ');
                })()}
            </td>
            <td className="px-5 py-3 text-right">
                <div className="font-medium">${(u.monthly_spend_cents / 100).toFixed(2)}</div>
                {u.monthly_cap_cents != null && (
                    <div className="text-[10px] text-ink2-faint">of ${(u.monthly_cap_cents / 100).toFixed(0)} cap</div>
                )}
            </td>
            <td className="px-5 py-3 text-right">
                <button onClick={onEdit} className="text-ink2-muted hover:text-ink2 text-xs mr-3"><i className="bi bi-pencil"></i></button>
                <button onClick={onDelete} className="text-rose-400 hover:text-rose-300 text-xs"><i className="bi bi-trash"></i></button>
            </td>
        </tr>
    );
}

function AddUserModal({ onClose, onCreate, models }) {
    const [form, setForm] = useState({ email: '', password: '', display_name: '', role: 'analyst' });
    function submit(e) {
        e.preventDefault();
        onCreate(form);
    }
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
            <form onSubmit={submit} className="bg-surface-raised border border-edge rounded-2xl p-6 w-full max-w-md space-y-4">
                <h3 className="text-lg font-semibold">Add user</h3>
                <div>
                    <label className="block text-xs text-ink2-muted mb-1.5">Email</label>
                    <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-edge" />
                </div>
                <div>
                    <label className="block text-xs text-ink2-muted mb-1.5">Password</label>
                    <input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-edge" />
                </div>
                <div>
                    <label className="block text-xs text-ink2-muted mb-1.5">Display name</label>
                    <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-edge" />
                </div>
                <div>
                    <label className="block text-xs text-ink2-muted mb-1.5">Role</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-edge">
                        <option value="analyst">analyst</option>
                        <option value="admin">admin</option>
                    </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-ink2-muted hover:bg-surface-raised">Cancel</button>
                    <button type="submit" className="bg-brand-600 hover:bg-brand-500 text-ink2 px-4 py-2 rounded-lg">Create</button>
                </div>
            </form>
        </div>
    );
}

function parseAllowed(am) {
    if (!am) return [];
    if (Array.isArray(am)) return am;
    try { const v = JSON.parse(am); return Array.isArray(v) ? v : []; } catch { return []; }
}
