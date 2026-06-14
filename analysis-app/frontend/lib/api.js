/* Light-weight fetch wrapper for the analysis app.
 * Reads the JWT from localStorage on the client and attaches it. */

const TOKEN_KEY = 'windikate.jwt';

function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}
function setToken(t) {
    if (typeof window === 'undefined') return;
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else   localStorage.removeItem(TOKEN_KEY);
}
function clearToken() { setToken(null); }

async function request(path, { method = 'GET', body, headers = {}, isForm = false } = {}) {
    const token = getToken();
    const init = { method, headers: { ...headers } };

    if (token) init.headers.Authorization = `Bearer ${token}`;

    if (body && !isForm) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    } else if (isForm) {
        init.body = body;  // FormData — let the browser set the boundary
    }

    const res = await fetch(path, init);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
        const err = new Error(data?.error || res.statusText || 'Request failed');
        err.status = res.status; err.body = data;
        throw err;
    }
    return data;
}

export const api = {
    // auth
    register: (body) => request('/api/auth/register', { method: 'POST', body }),
    login:    (body) => request('/api/auth/login',    { method: 'POST', body }),
    setToken, clearToken, getToken,

    // user
    me:       ()     => request('/api/users/me'),
    onboarding: (body) => request('/api/users/me/onboarding', { method: 'PUT', body }),

    // analyses
    listAnalyses: () => request('/api/analyses'),
    getAnalysis:  (id) => request(`/api/analyses/${id}`),
    createAnalysis: (formData) => request('/api/analyses', { method: 'POST', body: formData, isForm: true }),
    updateDeviation: (id, devId, body) => request(`/api/analyses/${id}/deviations/${devId}`, { method: 'PUT', body }),
    updateQuestion: (id, qId, body) => request(`/api/analyses/${id}/questions/${qId}`, { method: 'PUT', body }),
    generateMemo: (id, body) => request(`/api/analyses/${id}/memo`, { method: 'POST', body }),

    // admin
    adminOverview: () => request('/api/admin/overview'),
    adminModels:   () => request('/api/admin/models'),
    adminUsers:    () => request('/api/admin/users'),
    adminCreateUser: (body) => request('/api/admin/users', { method: 'POST', body }),
    adminPatchUser:  (id, body) => request(`/api/admin/users/${id}`, { method: 'PATCH', body }),
    adminDeleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
    adminSettings:  () => request('/api/admin/settings'),
    adminPutSettings: (body) => request('/api/admin/settings', { method: 'PUT', body }),
    adminUsage: (days = 30) => request(`/api/admin/usage?days=${days}`),
    adminUsageEvents: (filters = {}) => {
        const qs = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') qs.set(k, v);
        });
        const s = qs.toString();
        return request(`/api/admin/usage/events${s ? `?${s}` : ''}`);
    },
    adminUsageFacets: () => request('/api/admin/usage/facets'),

    // SAMAJ — admin
    samajListInvites:  () => request('/api/admin/personas/invites'),
    samajCreateInvite: (body) => request('/api/admin/personas/invites', { method: 'POST', body }),
    samajRevokeInvite: (id) => request(`/api/admin/personas/invites/${id}`, { method: 'DELETE' }),
    samajListPersonas: (status) => request(`/api/admin/personas${status ? `?status=${status}` : ''}`),
    samajGetPersona:   (id) => request(`/api/admin/personas/${id}`),
    samajApprove:      (id) => request(`/api/admin/personas/${id}/approve`, { method: 'POST' }),
    samajReject:       (id) => request(`/api/admin/personas/${id}/reject`,  { method: 'POST' }),
    samajDelete:       (id) => request(`/api/admin/personas/${id}`, { method: 'DELETE' }),

    // SAMAJ — public intake (token-gated, no JWT)
    samajGetInvite:    (token) => request(`/api/invites/${token}`),
    samajSubmitIntake: (token, body) => request(`/api/invites/${token}/submit`, { method: 'POST', body }),
    samajTranscribeStage: (token, body) =>
        request(`/api/invites/${token}/transcribe-stage`, { method: 'POST', body })
};

export const STORAGE = { TOKEN_KEY };
