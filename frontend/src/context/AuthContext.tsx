import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { apiFetch } from '@/utils/api';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'LGU_AGENT';

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: Role;
}

const STORAGE_KEY = 'gl_auth_user';

type AuthContextValue = {
    user: AuthUser | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(readStoredUser);

    const login = useCallback(async (email: string, password: string) => {
        const loggedIn = await apiFetch<AuthUser>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedIn));
        setUser(loggedIn);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
    }, []);

    return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
