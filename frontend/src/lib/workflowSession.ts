import {
    ensureInitiativeRecord,
    getCurrentInitiativeId,
    loadInitiativeRecords,
    saveInitiativeRecords,
    setCurrentInitiativeId,
} from './initiativesSession';
import type { IdeationSolutionDto, UnderstandingAnalysisResult } from '../services/api';

export type IdeationSolution = IdeationSolutionDto;

export type PrototypeMeta = {
    screenCount: number;
    estimatedTimeLabel: string;
    flowType: string;
    summaryLine: string;
};

/** Una pantalla del prototipo generada por el agente (6 en total). */
export type PrototypeScreenSpec = {
    title: string;
    subtitle?: string;
    bullets?: string[];
    note?: string;
    cta?: string;
};

/** Arma meta de prototipo a partir de la respuesta de generate-prototype-screens y la solución elegida. */
export function buildPrototypeMetaFromGenerateResponse(
    solution: IdeationSolution,
    result: {
        summaryLine: string;
        screens: PrototypeScreenSpec[];
        estimatedTimeLabel?: string;
        flowType?: string;
    }
): PrototypeMeta {
    const n = result.screens.length;
    const short = solution.title.replace(/^Solución\s*\d+\s*:\s*/i, '').trim() || solution.title;
    const estimated =
        (result.estimatedTimeLabel && result.estimatedTimeLabel.trim()) ||
        `~${Math.max(1, Math.round(n * 0.35))} min`;
    const flow = (result.flowType && result.flowType.trim()) || 'Lineal';
    return {
        screenCount: n,
        estimatedTimeLabel: estimated,
        flowType: flow,
        summaryLine:
            (result.summaryLine && result.summaryLine.trim()) ||
            `${short} • ${n} pantalla${n === 1 ? '' : 's'} • ${flow}`,
    };
}

export type WorkflowSession = {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    /** Ausente hasta que el UX Agent termina el análisis */
    analysis?: UnderstandingAnalysisResult;
    ideationSolutions?: IdeationSolution[];
    selectedSolutionIndex?: 1 | 2 | 3 | null;
    prototypeMeta?: PrototypeMeta;
    /** Si existe (6 ítems), el paso Prototipado usa estos textos en lugar del demo fijo. */
    prototypeScreens?: PrototypeScreenSpec[];
    /** Usuario abrió la página de handoff al menos una vez */
    handoffVisited?: boolean;
    /** Llegó al resumen final del proyecto */
    workflowCompleted?: boolean;
};

const LEGACY_WORKFLOW_KEY = 'ux-agent-workflow-v1';
const LEGACY_ANALISIS = 'ux-agent-analisis-v1';

function workflowStorageKey(initiativeId: string): string {
    return `ux-agent-workflow-${initiativeId}`;
}

function emptyWorkflow(): WorkflowSession {
    return { initiativeName: '', jiraTicket: '', squad: '' };
}

/** Migra el workflow monolítico v1 a la primera iniciativa del listado. */
export function migrateLegacyWorkflowIfNeeded(): void {
    if (loadInitiativeRecords().length > 0) return;

    let raw = sessionStorage.getItem(LEGACY_WORKFLOW_KEY);
    if (!raw) raw = sessionStorage.getItem(LEGACY_ANALISIS);
    if (!raw) return;

    try {
        const p = JSON.parse(raw) as Partial<WorkflowSession> & { analysis?: UnderstandingAnalysisResult };
        if (typeof p.initiativeName !== 'string') return;

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const w: WorkflowSession = {
            initiativeName: p.initiativeName,
            jiraTicket: typeof p.jiraTicket === 'string' ? p.jiraTicket : '',
            squad: typeof p.squad === 'string' ? p.squad : '',
            analysis: p.analysis,
            ideationSolutions: p.ideationSolutions,
            selectedSolutionIndex: p.selectedSolutionIndex,
            prototypeMeta: p.prototypeMeta,
            prototypeScreens: Array.isArray(p.prototypeScreens) ? p.prototypeScreens : undefined,
            handoffVisited: p.handoffVisited,
            workflowCompleted: p.workflowCompleted,
        };

        saveInitiativeRecords([
            {
                id,
                createdAt: now,
                updatedAt: now,
                completed: Boolean(w.workflowCompleted),
            },
        ]);
        sessionStorage.setItem(workflowStorageKey(id), JSON.stringify(w));
        setCurrentInitiativeId(id);
        sessionStorage.removeItem(LEGACY_WORKFLOW_KEY);
        sessionStorage.removeItem(LEGACY_ANALISIS);
    } catch {
        /* ignore */
    }
}

export function loadWorkflowByInitiativeId(initiativeId: string): WorkflowSession | null {
    try {
        const raw = sessionStorage.getItem(workflowStorageKey(initiativeId));
        if (!raw) return null;
        const p = JSON.parse(raw) as WorkflowSession;
        if (typeof p.initiativeName !== 'string') return null;
        return {
            initiativeName: p.initiativeName,
            jiraTicket: typeof p.jiraTicket === 'string' ? p.jiraTicket : '',
            squad: typeof p.squad === 'string' ? p.squad : '',
            analysis: p.analysis,
            ideationSolutions: p.ideationSolutions,
            selectedSolutionIndex: p.selectedSolutionIndex,
            prototypeMeta: p.prototypeMeta,
            prototypeScreens: Array.isArray(p.prototypeScreens) ? p.prototypeScreens : undefined,
            handoffVisited: p.handoffVisited,
            workflowCompleted: p.workflowCompleted,
        };
    } catch {
        return null;
    }
}

/**
 * Carga el workflow de la iniciativa actual. Sin iniciativa activa devuelve null.
 * Permite borrador sin `analysis` (solo nombre/jira/squad).
 */
export function loadWorkflow(): WorkflowSession | null {
    migrateLegacyWorkflowIfNeeded();
    const id = getCurrentInitiativeId();
    if (!id) return null;

    const w = loadWorkflowByInitiativeId(id);
    if (w) return w;

    const draft = emptyWorkflow();
    try {
        sessionStorage.setItem(workflowStorageKey(id), JSON.stringify(draft));
    } catch {
        /* ignore */
    }
    return draft;
}

export function saveWorkflow(w: WorkflowSession): void {
    const id = getCurrentInitiativeId();
    if (!id) return;

    ensureInitiativeRecord(id);
    try {
        sessionStorage.setItem(workflowStorageKey(id), JSON.stringify(w));
    } catch {
        /* ignore */
    }

    const list = loadInitiativeRecords();
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
        list[idx] = {
            ...list[idx],
            updatedAt: new Date().toISOString(),
            completed: Boolean(w.workflowCompleted),
        };
        saveInitiativeRecords(list);
    }
}

export function patchWorkflow(partial: Partial<WorkflowSession>): WorkflowSession | null {
    const cur = loadWorkflow();
    if (!cur) return null;
    const next = { ...cur, ...partial };
    saveWorkflow(next);
    return next;
}

/** Limpia solo el workflow de la iniciativa actual (no borra el registro de la lista). */
export function clearWorkflowDataForCurrentInitiative(): void {
    const id = getCurrentInitiativeId();
    if (!id) return;
    try {
        sessionStorage.removeItem(workflowStorageKey(id));
    } catch {
        /* ignore */
    }
}

/** Quita la iniciativa del listado, su workflow y borrador de entendimiento. */
export function removeInitiative(id: string): void {
    const list = loadInitiativeRecords().filter((r) => r.id !== id);
    saveInitiativeRecords(list);
    try {
        sessionStorage.removeItem(workflowStorageKey(id));
        sessionStorage.removeItem(`ux-agent-understanding-draft-${id}`);
    } catch {
        /* ignore */
    }
    if (getCurrentInitiativeId() === id) {
        setCurrentInitiativeId(null);
    }
}

/**
 * Deja de apuntar a una iniciativa activa (p. ej. volver al panel).
 * No borra datos de las iniciativas.
 */
export function clearCurrentInitiativeSelection(): void {
    setCurrentInitiativeId(null);
}

/** Compat: limpia workflow legacy y la selección actual (no borra todas las iniciativas). */
export function clearWorkflow(): void {
    clearWorkflowDataForCurrentInitiative();
    clearCurrentInitiativeSelection();
    try {
        sessionStorage.removeItem(LEGACY_WORKFLOW_KEY);
        sessionStorage.removeItem(LEGACY_ANALISIS);
        sessionStorage.removeItem('ux-agent-ideacion-v1');
    } catch {
        /* ignore */
    }
}
