import {
    createContext,
    useCallback,
    useContext,
    useState,
    type ReactNode,
} from 'react';

type Variant = 'info' | 'success' | 'error';

type ToastItem = { id: number; message: string; variant: Variant };

const ToastContext = createContext<{
    toast: (message: string, variant?: Variant) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);

    const toast = useCallback((message: string, variant: Variant = 'info') => {
        const id = Date.now() + Math.random();
        setItems((prev) => [...prev, { id, message, variant }]);
        window.setTimeout(() => {
            setItems((prev) => prev.filter((t) => t.id !== id));
        }, 4500);
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div
                role="region"
                aria-label="Notificaciones"
                aria-live="polite"
                aria-relevant="additions text"
                className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-md pointer-events-none"
            >
                {items.map((t) => (
                    <div
                        key={t.id}
                        role="status"
                        className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium border ${
                            t.variant === 'error'
                                ? 'bg-red-50 border-red-300 text-red-800'
                                : t.variant === 'success'
                                  ? 'bg-green-50 border-green-300 text-green-800'
                                  : 'bg-purple-900 border-purple-800 text-white'
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast debe usarse dentro de ToastProvider');
    }
    return ctx.toast;
}
