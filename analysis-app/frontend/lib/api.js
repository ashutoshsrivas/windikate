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
    generateMemo: (id, body) => request(`/api/analyses/${id}/memo`, { method: 'POST', body })
};

export const STORAGE = { TOKEN_KEY };
