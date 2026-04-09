import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAllUxAgentSessionStorage } from '../lib/initiativesSession';
import { api, setUnauthorizedHandler, type AuthUser } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
/** Detecta cambio de cuenta Google en el mismo navegador y evita mezclar iniciativas. */
const UX_AGENT_AUTH_USER_KEY = 'ux-agent-active-auth-user-id';

type AuthContextValue = {
    user: AuthUser | null;
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const onUnauthorized = () => {
            setUser(null);
            const path = `${window.location.pathname}${window.location.search}`;
            const from = path.startsWith('/login') ? '/' : path;
            void fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            }).catch(() => {
                /* cookie ya inválida o red caída */
            });
            navigate('/login', { replace: true, state: { from } });
        };
        setUnauthorizedHandler(onUnauthorized);
        return () => setUnauthorizedHandler(null);
    }, [navigate]);

    const refresh = useCallback(async () => {
        try {
            const { user: u } = await api.getMe();
            setUser(u);
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        void (async () => {
            await refresh();
            setLoading(false);
        })();
    }, [refresh]);

    useEffect(() => {
        if (loading || !user) return;
        try {
            const prev = sessionStorage.getItem(UX_AGENT_AUTH_USER_KEY);
            if (prev && prev !== user.id) {
                clearAllUxAgentSessionStorage();
            }
            sessionStorage.setItem(UX_AGENT_AUTH_USER_KEY, user.id);
        } catch {
            /* ignore */
        }
    }, [user, loading]);

    const logout = useCallback(async () => {
        await api.logout();
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, loading, refresh, logout }),
        [user, loading, refresh, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return ctx;
}
