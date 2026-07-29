import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, ShieldCheck, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@greenlens.local', password: 'admin123', icon: ShieldCheck },
    { label: 'LGU Agent (Naic)', email: 'lgu.naic@greenlens.local', password: 'naic123', icon: MapPin },
];

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function doLogin(loginEmail: string, loginPassword: string) {
        setSubmitting(true);
        setError('');
        try {
            await login(loginEmail.trim(), loginPassword);
            const from = (location.state as { from?: string } | null)?.from ?? '/admin';
            navigate(from, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in');
        } finally {
            setSubmitting(false);
        }
    }

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        doLogin(email, password);
    }

    function handleDemoLogin(demoEmail: string, demoPassword: string) {
        setEmail(demoEmail);
        setPassword(demoPassword);
        doLogin(demoEmail, demoPassword);
    }

    return (
        <div className="min-h-dvh flex items-center justify-center bg-light px-4">
            <div className="w-full max-w-sm bg-light-lighter border border-light-dark rounded-xl shadow-sm p-8">
                <div className="text-center mb-8">
                    <span className="text-2xl font-bold text-dark">
                        Green<span className="text-primary">Lens</span>
                    </span>
                    <p className="text-sm text-dark-light mt-2">Sign in to the LGU administration console.</p>
                </div>

                <div className="mb-6 space-y-2">
                    <p className="text-xs font-semibold text-dark-light uppercase tracking-wide">Quick demo login</p>
                    <div className="grid grid-cols-2 gap-2">
                        {DEMO_ACCOUNTS.map(({ label, email: demoEmail, password: demoPassword, icon: Icon }) => (
                            <button
                                key={demoEmail}
                                type="button"
                                disabled={submitting}
                                onClick={() => handleDemoLogin(demoEmail, demoPassword)}
                                className="flex flex-col items-center gap-1.5 py-3 px-2 border border-light-dark rounded-lg text-xs font-medium text-dark hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                            >
                                <Icon size={18} className="text-primary" />
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                        <div className="h-px flex-1 bg-light-dark" />
                        <span className="text-xs text-dark-light">or sign in manually</span>
                        <div className="h-px flex-1 bg-light-dark" />
                    </div>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-dark" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="w-full bg-light border border-light-dark rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="you@gov.ph"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-dark" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="w-full bg-light border border-light-dark rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        <LogIn size={18} /> {submitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
