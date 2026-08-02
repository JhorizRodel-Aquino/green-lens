import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';

type ToastKind = 'success' | 'error';
interface ToastItem { id: number; kind: ToastKind; message: string; }

interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'primary' | 'danger';
}
interface ConfirmState extends ConfirmOptions { resolve: (ok: boolean) => void; }

interface NotificationContextValue {
    toast: (kind: ToastKind, message: string) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TOAST_TTL_MS = 4000;

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
    const nextId = useRef(0);

    const dismissToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback((kind: ToastKind, message: string) => {
        const id = nextId.current++;
        setToasts((prev) => [...prev, { id, kind, message }]);
        setTimeout(() => dismissToast(id), TOAST_TTL_MS);
    }, [dismissToast]);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({ ...options, resolve });
        });
    }, []);

    function respond(ok: boolean) {
        confirmState?.resolve(ok);
        setConfirmState(null);
    }

    return (
        <NotificationContext.Provider value={{ toast, confirm }}>
            {children}

            {/* Toast stack */}
            <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2 w-full max-w-sm">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={cn(
                            'flex items-start gap-3 rounded-xl border bg-white shadow-lg p-4',
                            t.kind === 'success' ? 'border-primary/30' : 'border-red-300'
                        )}
                    >
                        {t.kind === 'success' ? (
                            <CheckCircle2 size={20} className="shrink-0 text-primary" />
                        ) : (
                            <XCircle size={20} className="shrink-0 text-red-600" />
                        )}
                        <p className="flex-1 text-sm text-dark">{t.message}</p>
                        <button
                            type="button"
                            onClick={() => dismissToast(t.id)}
                            className="shrink-0 text-dark-light hover:text-dark"
                            aria-label="Dismiss"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm modal */}
            {confirmState && (
                <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => respond(false)} />
                    <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                'shrink-0 flex h-10 w-10 items-center justify-center rounded-full',
                                confirmState.tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-primary-light/20 text-primary-dark'
                            )}>
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-dark">{confirmState.title}</h3>
                                {confirmState.message && <p className="text-sm text-dark-light mt-1">{confirmState.message}</p>}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => respond(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-dark-light hover:bg-light transition-colors"
                            >
                                {confirmState.cancelLabel ?? 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={() => respond(true)}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors',
                                    confirmState.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'
                                )}
                            >
                                {confirmState.confirmLabel ?? 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
    return ctx;
}
