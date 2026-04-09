import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AppFooter() {
    const [apiVersion, setApiVersion] = useState<string | null>(null);
    const [dbOk, setDbOk] = useState<boolean | null>(null);
    const [reachable, setReachable] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        void api
            .getHealth()
            .then((h) => {
                if (cancelled) return;
                setReachable(true);
                setApiVersion(h.version ?? null);
                setDbOk(h.database === 'ok');
            })
            .catch(() => {
                if (cancelled) return;
                setReachable(false);
                setApiVersion(null);
                setDbOk(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <footer
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 mt-auto border-t border-gray-200 bg-white"
            role="contentinfo"
        >
            <p className="text-[10px] text-gray-500 leading-relaxed">
                <span className="font-mono">Cliente v{__APP_VERSION__}</span>
                {reachable === true && (
                    <>
                        <span className="mx-1.5 text-gray-300">·</span>
                        {apiVersion != null ? (
                            <span className="font-mono">API v{apiVersion}</span>
                        ) : (
                            <span>API en línea</span>
                        )}
                        {dbOk === false && (
                            <span
                                className="ml-1.5 text-red-700 font-medium"
                                title="El servidor respondió pero la base no pasó el ping SQL"
                            >
                                (BD degradada)
                            </span>
                        )}
                    </>
                )}
                {reachable === false && (
                    <>
                        <span className="mx-1.5 text-gray-300">·</span>
                        <span>
                            No se pudo contactar la API (
                            {import.meta.env.VITE_API_URL || 'http://localhost:3001'})
                        </span>
                    </>
                )}
            </p>
        </footer>
    );
}
