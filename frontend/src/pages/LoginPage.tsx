import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await login(email.trim(), password);
            const from = (location.state as { from?: string } | null)?.from ?? '/admin';
            navigate(from, { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in');
        } finally {
            setSubmitting(false);
        }
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
