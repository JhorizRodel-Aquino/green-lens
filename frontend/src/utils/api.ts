// utils/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

function authHeader(): Record<string, string> {
    try {
        const raw = localStorage.getItem('gl_auth_user');
        if (!raw) return {};
        const user = JSON.parse(raw) as { id?: string };
        return user.id ? { 'x-user-id': user.id } : {};
    } catch {
        return {};
    }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}

// Separate from apiFetch: a FormData body must NOT get a manual Content-Type — the browser
// sets 'multipart/form-data; boundary=...' itself, which JSON.stringify-oriented apiFetch would break.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { ...authHeader() },
        body: formData,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}
