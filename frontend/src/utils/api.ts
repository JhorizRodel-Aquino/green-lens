// utils/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}
