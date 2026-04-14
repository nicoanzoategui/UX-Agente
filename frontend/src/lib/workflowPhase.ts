import type { WorkflowSession } from './workflowSession';

export type WorkflowPhaseLabel =
    | 'Entendimiento'
    | 'Ideación'
    | 'User flow'
    | 'Wireframes hi-fi'
    | 'Figma'
    | 'Código TSX'
    | 'Handoff';

export type WorkflowPhaseInfo = {
    currentStep: WorkflowPhaseLabel;
    progress: number;
    continuePath: string;
};

const FLOW_READY = (w: WorkflowSession) =>
    w.selectedSolutionIndex != null && Boolean(w.ideationSolutions && w.ideationSolutions.length > 0);

/**
 * Orden: entendimiento → ideación → user flow → wireframes HiFi → Figma → código TSX → handoff → resumen.
 */
export function getWorkflowPhaseInfo(w: WorkflowSession | null): WorkflowPhaseInfo {
    if (!w) {
        return { currentStep: 'Entendimiento', progress: 14, continuePath: '/iniciativa/nueva' };
    }

    if (w.workflowCompleted) {
        return { currentStep: 'Handoff', progress: 100, continuePath: '/resumen' };
    }

    if (FLOW_READY(w)) {
        if (!w.userFlowApproved) {
            return { currentStep: 'User flow', progress: 40, continuePath: '/user-flow' };
        }
        if (!w.hifiWireframesApproved) {
            return { currentStep: 'Wireframes hi-fi', progress: 50, continuePath: '/wireframes-hifi' };
        }
        if (!w.figmaApproved) {
            return { currentStep: 'Figma', progress: 64, continuePath: '/figma' };
        }
        if (!w.tsxMuiApproved) {
            return { currentStep: 'Código TSX', progress: 78, continuePath: '/codigo-mui' };
        }
        if (w.handoffVisited) {
            return { currentStep: 'Handoff', progress: 90, continuePath: '/handoff' };
        }
        return { currentStep: 'Handoff', progress: 86, continuePath: '/handoff' };
    }

    if (w.handoffVisited) {
        return { currentStep: 'User flow', progress: 40, continuePath: '/user-flow' };
    }

    if (w.ideationSolutions && w.ideationSolutions.length > 0) {
        return { currentStep: 'Ideación', progress: 28, continuePath: '/ideacion' };
    }

    if (w.analysis) {
        return { currentStep: 'Ideación', progress: 22, continuePath: '/analisis' };
    }

    return { currentStep: 'Entendimiento', progress: 14, continuePath: '/iniciativa/nueva' };
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
