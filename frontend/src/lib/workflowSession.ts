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
    /** SVG del user flow (post-prototipo). */
    userFlowSvg?: string;
    userFlowApproved?: boolean;
    /** Respuesta bruta con ---SCREEN_N--- (opcional, para depuración). */
    hifiWireframesRaw?: string;
    /** HTML HiFi por pantalla (mismo orden que el prototipo). */
    hifiWireframesHtml?: string[];
    hifiWireframesApproved?: boolean;
    /** Datos de materialización en Figma a partir de wireframes HiFi. */
    figmaDesignSystemUrl?: string;
    figmaDestinationUrl?: string;
    figmaFileUrl?: string;
    /** fileKey de la API Figma (cuando se resolvió). */
    figmaFileKey?: string;
    figmaScreensMeta?: { screenIndex: number; nodeId: string; name: string }[];
    figmaGenerationLog?: string[];
    figmaOrchestrationErrors?: { screenIndex: number; message: string }[];
    figmaGenerated?: boolean;
    figmaApproved?: boolean;
    /** TSX generado desde Figma (fuente oficial para handoff cuando existe). */
    tsxFinalScreens?: string[];
    /** TSX desde wireframes HiFi (legado / fallback). */
    tsxMuiScreens?: string[];
    tsxMuiApproved?: boolean;
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
            userFlowSvg: typeof p.userFlowSvg === 'string' ? p.userFlowSvg : undefined,
            userFlowApproved: p.userFlowApproved === true,
            hifiWireframesRaw: typeof p.hifiWireframesRaw === 'string' ? p.hifiWireframesRaw : undefined,
            hifiWireframesHtml: Array.isArray(p.hifiWireframesHtml)
                ? (p.hifiWireframesHtml as unknown[]).filter((x): x is string => typeof x === 'string')
                : undefined,
            hifiWireframesApproved: p.hifiWireframesApproved === true,
            figmaDesignSystemUrl: typeof p.figmaDesignSystemUrl === 'string' ? p.figmaDesignSystemUrl : undefined,
            figmaDestinationUrl: typeof p.figmaDestinationUrl === 'string' ? p.figmaDestinationUrl : undefined,
            figmaFileUrl: typeof p.figmaFileUrl === 'string' ? p.figmaFileUrl : undefined,
            figmaFileKey: typeof p.figmaFileKey === 'string' ? p.figmaFileKey : undefined,
            figmaScreensMeta: Array.isArray(p.figmaScreensMeta)
                ? (p.figmaScreensMeta as unknown[])
                      .filter((x) => x && typeof x === 'object')
                      .map((x) => x as { screenIndex?: unknown; nodeId?: unknown; name?: unknown })
                      .filter((x) => typeof x.screenIndex === 'number' && typeof x.nodeId === 'string' && typeof x.name === 'string')
                      .map((x) => ({ screenIndex: x.screenIndex as number, nodeId: x.nodeId as string, name: x.name as string }))
                : undefined,
            figmaGenerationLog: Array.isArray(p.figmaGenerationLog)
                ? (p.figmaGenerationLog as unknown[]).filter((x): x is string => typeof x === 'string')
                : undefined,
            figmaOrchestrationErrors: Array.isArray(p.figmaOrchestrationErrors)
                ? (p.figmaOrchestrationErrors as unknown[])
                      .filter((x) => x && typeof x === 'object')
                      .map((x) => x as { screenIndex?: unknown; message?: unknown })
                      .filter((x) => typeof x.screenIndex === 'number' && typeof x.message === 'string')
                      .map((x) => ({ screenIndex: x.screenIndex as number, message: x.message as string }))
                : undefined,
            figmaGenerated: p.figmaGenerated === true,
            figmaApproved: p.figmaApproved === true,
            tsxFinalScreens: Array.isArray(p.tsxFinalScreens)
                ? (p.tsxFinalScreens as unknown[]).filter((x): x is string => typeof x === 'string')
                : undefined,
            tsxMuiScreens: Array.isArray(p.tsxMuiScreens)
                ? (p.tsxMuiScreens as unknown[]).filter((x): x is string => typeof x === 'string')
                : undefined,
            tsxMuiApproved: p.tsxMuiApproved === true,
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

/** Al regenerar el prototipo, se invalida todo lo posterior (user flow, HiFi, TSX, handoff). */
export function resetPostPrototypePipelineAndPatch(partial: Partial<WorkflowSession>): WorkflowSession | null {
    const cur = loadWorkflow();
    if (!cur) return null;
    const next: WorkflowSession = { ...cur, ...partial };
    delete next.prototypeMeta;
    delete next.prototypeScreens;
    delete next.userFlowSvg;
    delete next.hifiWireframesRaw;
    delete next.hifiWireframesHtml;
    delete next.figmaFileUrl;
    delete next.figmaFileKey;
    delete next.figmaScreensMeta;
    delete next.figmaGenerationLog;
    delete next.figmaOrchestrationErrors;
    delete next.tsxFinalScreens;
    delete next.tsxMuiScreens;
    next.userFlowApproved = false;
    next.hifiWireframesApproved = false;
    next.figmaGenerated = false;
    next.figmaApproved = false;
    next.tsxMuiApproved = false;
    next.handoffVisited = false;
    next.workflowCompleted = false;
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
