import type { WorkflowSession } from './workflowSession';

export type WorkflowPhaseLabel = 'Entendimiento' | 'Ideación' | 'Prototipado' | 'Handoff';

export type WorkflowPhaseInfo = {
    currentStep: WorkflowPhaseLabel;
    progress: number;
    /** Ruta sugerida para “Continuar” */
    continuePath: string;
};

/**
 * Orden del flujo: entendimiento/analisis → ideación → prototipado → handoff → resumen.
 * `handoffVisited` y `workflowCompleted` viven en WorkflowSession.
 */
export function getWorkflowPhaseInfo(w: WorkflowSession | null): WorkflowPhaseInfo {
    if (!w) {
        return { currentStep: 'Entendimiento', progress: 25, continuePath: '/iniciativa/nueva' };
    }

    if (w.workflowCompleted) {
        return { currentStep: 'Handoff', progress: 100, continuePath: '/resumen' };
    }

    if (w.handoffVisited) {
        return { currentStep: 'Handoff', progress: 90, continuePath: '/handoff' };
    }

    if (w.prototypeMeta) {
        return { currentStep: 'Prototipado', progress: 75, continuePath: '/prototipado' };
    }

    if (w.ideationSolutions && w.ideationSolutions.length > 0) {
        return { currentStep: 'Ideación', progress: 50, continuePath: '/ideacion' };
    }

    if (w.analysis) {
        return { currentStep: 'Ideación', progress: 40, continuePath: '/analisis' };
    }

    return { currentStep: 'Entendimiento', progress: 25, continuePath: '/iniciativa/nueva' };
}

export function formatRelativeTime(iso: string): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '—';
    const diff = Date.now() - t;
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day >= 14) return `Hace ${Math.floor(day / 7)} semanas`;
    if (day >= 7) return 'Hace 1 semana';
    if (day >= 1) return `Hace ${day} día${day > 1 ? 's' : ''}`;
    if (hr >= 1) return `Hace ${hr} hora${hr > 1 ? 's' : ''}`;
    if (min >= 1) return `Hace ${min} min`;
    return 'Hace un momento';
}

export function formatShortDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
