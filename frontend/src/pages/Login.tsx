import { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const authBypass =
    import.meta.env.VITE_AUTH_DISABLED === '1' || import.meta.env.VITE_AUTH_DISABLED === 'true';

export default function Login() {
    const { user, loading, refresh } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const rawFrom = (location.state as { from?: string } | null)?.from || '/';
    const from = rawFrom.startsWith('/login') ? '/' : rawFrom;
    const [devLoading, setDevLoading] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            navigate(from, { replace: true });
        }
    }, [loading, user, navigate, from]);

    const afterLogin = async () => {
        await refresh();
        navigate(from, { replace: true });
    };

    const onDevLogin = async () => {
        setDevLoading(true);
        try {
            await api.loginDev();
            await afterLogin();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo iniciar sesión';
            toast(msg, 'error');
        } finally {
            setDevLoading(false);
        }
    };

    const canUseGoogle = Boolean(googleClientId);
    const showDev = authBypass;
    const misconfigured = !canUseGoogle && !showDev;

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-50">
                <nav className="gradient-bg text-white shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
                        <span className="font-bold text-xl">UX Agent Platform</span>
                    </div>
                </nav>
                <div className="flex-1 flex items-center justify-center text-sm text-gray-600">
                    Cargando sesión…
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <nav className="gradient-bg text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" className="flex items-center gap-3 text-white ux-focus rounded-lg px-1 -ml-1">
                            <svg
                                className="w-8 h-8 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                            <span className="font-bold text-xl">UX Agent Platform</span>
                        </Link>
                        <span className="text-sm opacity-90">Acceso</span>
                    </div>
                </div>
            </nav>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 fade-in">
                <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm card-hover">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesión</h1>
                    <p className="text-sm text-gray-600 mb-6">
                        Acceso restringido al workspace del equipo. Usá la cuenta autorizada por tu
                        organización.
                    </p>

                    {misconfigured && (
                        <div
                            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                            role="alert"
                        >
                            Falta configuración: definí{' '}
                            <code className="text-xs bg-amber-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code>{' '}
                            o activá modo desarrollo con{' '}
                            <code className="text-xs bg-amber-100 px-1 rounded">VITE_AUTH_DISABLED=1</code>{' '}
                            (solo si el backend tiene{' '}
                            <code className="text-xs bg-amber-100 px-1 rounded">AUTH_DISABLED</code>).
                        </div>
                    )}

                    <div className="flex flex-col gap-4 items-stretch">
                        {canUseGoogle && (
                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={async (cred) => {
                                        if (!cred.credential) {
                                            toast('Respuesta de Google incompleta', 'error');
                                            return;
                                        }
                                        try {
                                            await api.loginGoogle(cred.credential);
                                            await afterLogin();
                                        } catch (e: unknown) {
                                            const msg =
                                                e instanceof Error ? e.message : 'Error al iniciar sesión';
                                            toast(msg, 'error');
                                        }
                                    }}
                                    onError={() => toast('Google Sign-In falló', 'error')}
                                    useOneTap={false}
                                />
                            </div>
                        )}

                        {showDev && (
                            <button
                                type="button"
                                onClick={() => void onDevLogin()}
                                disabled={devLoading}
                                className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 ux-focus"
                            >
                                {devLoading ? 'Entrando…' : 'Entrar (solo desarrollo — sin Google)'}
                            </button>
                        )}
                    </div>

                    <p className="mt-6 text-center text-xs text-gray-600">
                        <Link to="/" className="text-purple-600 font-semibold hover:underline ux-focus">
                            Volver al inicio
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
