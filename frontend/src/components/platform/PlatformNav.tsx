import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function userInitials(name: string | undefined, email: string | undefined): string {
    const n = (name || '').trim();
    if (n) {
        const parts = n.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 3);
        }
        return n.slice(0, 2).toUpperCase();
    }
    const e = (email || '').split('@')[0] || '?';
    return e.slice(0, 2).toUpperCase();
}

export default function PlatformNav() {
    const { user, logout } = useAuth();
    const initials = userInitials(user?.name, user?.email);

    return (
        <nav className="gradient-bg text-white shadow-lg sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link
                        to="/"
                        className="flex items-center gap-3 min-w-0 rounded-lg px-1 py-0.5 -ml-1 ux-focus text-white"
                    >
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
                        <div className="flex flex-col min-w-0 text-left">
                            <span className="font-bold text-xl leading-tight truncate">UX Agent Platform</span>
                            <span className="text-[10px] opacity-90 uppercase tracking-wider font-semibold truncate">
                                Panel · Flujo UX
                            </span>
                        </div>
                    </Link>
                    <div className="flex items-center gap-4 shrink-0">
                        <span
                            className="hidden sm:inline text-sm opacity-90 truncate max-w-[220px]"
                            title={user?.email}
                        >
                            {user?.name || user?.email}
                        </span>
                        <div
                            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0"
                            title={user?.email}
                        >
                            <span className="text-xs font-bold">{initials}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => void logout()}
                            className="text-sm font-semibold text-white/90 hover:text-white rounded-lg px-2 py-1 ux-focus"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
