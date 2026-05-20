// Shared fetch wrapper. Sends cookies on every request so the
// HttpOnly cntrd_session JWT flows through to the existing Express
// backend. Throws an error with a server-friendly message on
// non-2xx so callers can surface it.
export async function api(path, init = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Accept': 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

export const get  = (p)        => api(p);
export const post = (p, body)  => api(p, { method: 'POST', body: JSON.stringify(body || {}) });
export const put  = (p, body)  => api(p, { method: 'PUT',  body: JSON.stringify(body || {}) });
export const del  = (p)        => api(p, { method: 'DELETE' });
