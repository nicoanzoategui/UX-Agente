const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function throwConnectionHelp(): never {
    throw new ApiError(
        `No se pudo conectar con el servidor (${API_URL}). ` +
            `Levantá el backend (por ejemplo: cd backend && npm run dev). ` +
            `Revisá VITE_API_URL en el .env de la raíz del repo (o frontend/.env). ` +
            `Si abrís la app con 127.0.0.1 y antes fallaba, probá http://localhost:5173 o reiniciá el backend (CORS ya acepta ambos en desarrollo).`,
        0
    );
}

async function fetchWithNetworkHelp(url: string, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch {
        throwConnectionHelp();
    }
}

export type HealthResponse = {
    status: string;
    database: string;
    service?: string;
    version?: string;
    timestamp?: string;
};

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function parseError(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) return `Error ${response.status}`;
    try {
        const j = JSON.parse(text) as { error?: string };
        return j.error || text;
    } catch {
        return text;
    }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registra callback ante 401 en rutas protegidas (p. ej. redirigir a login). Llamar desde un componente bajo `BrowserRouter`. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
}

/**
 * Sesión inválida o expirada. No dispara en POST /api/auth/google (401 = credencial o allowlist).
 */
function notifyUnauthorizedIfNeeded(response: Response, requestPath?: string): void {
    if (response.status !== 401) return;
    let path = requestPath?.trim() ?? '';
    if (!path && response.url) {
        try {
            path = new URL(response.url).pathname;
        } catch {
            path = '';
        }
    }
    if (path.includes('/api/auth/google')) return;
    unauthorizedHandler?.();
}

async function rejectResponse(response: Response, requestPath?: string): Promise<never> {
    notifyUnauthorizedIfNeeded(response, requestPath);
    let msg = await parseError(response);
    if (response.status === 429) {
        const ra = response.headers.get('Retry-After')?.trim();
        if (ra && /^\d+$/.test(ra)) {
            msg = `${msg} Volvé a intentar en ~${ra}s.`;
        }
    }
    throw new ApiError(msg, response.status);
}

export type AuthUser = {
    id: string;
    email: string;
    name: string;
};

async function fetchAPI(endpoint: string, options?: RequestInit) {
    const isForm = options?.body instanceof FormData;
    const response = await fetchWithNetworkHelp(`${API_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            ...(isForm ? {} : { 'Content-Type': 'application/json' }),
            ...options?.headers,
        },
    });

    if (!response.ok) {
        await rejectResponse(response, endpoint);
    }

    return response.json();
}

export type KickoffWorkItem = {
    id: string;
    card_id: string;
    workspace_id: string;
    kind: 'spec' | 'wireframe_low' | 'wireframe_high' | 'flowbite';
    kanban_column: 'todo' | 'wip' | 'review' | 'done';
    is_generating: number | boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

export type KickoffCard = {
    id: string;
    title: string;
    transcript: string;
    spec_markdown: string | null;
    kanban_column: string;
    current_step: string;
    gate_spec_status: string;
    gate_spec_comment: string | null;
    gate_wireframes_status: string;
    gate_wireframes_comment: string | null;
    selected_wireframe_option: number | null;
    gate_stakeholder_status: string;
    gate_stakeholder_comment: string | null;
    flowbite_html?: string | null;
    /** JSON: { title, description, components } del último diseño Flowbite generado */
    flowbite_metadata?: string | null;
    gate_flowbite_status?: string;
    gate_flowbite_comment?: string | null;
    /** Mensaje del último fallo de LLM tras rollback (persistido en servidor) */
    last_generation_error?: string | null;
    is_generating: number | boolean;
    created_at: string;
    updated_at: string;
    /** Tareas por kickoff: spec, wireframes baja/alta, Diseño Flowbite (tablero). */
    work_items?: KickoffWorkItem[];
};

export type WireframeRow = {
    id: string;
    card_id: string;
    option_index: number;
    title: string | null;
    description: string | null;
    html_content: string;
    status: string;
};

/** Respuesta del orquestador Paso E (`POST /api/generate-wireframes`). */
export type StepEWireframeOption = {
    title: string;
    uxRationale: string;
    htmlContent: string;
};

/** Endpoint documentado o extraído de OpenAPI/Swagger en Entendimiento. */
export type ApiEndpointDescriptor = {
    method: string;
    path: string;
    summary?: string;
};

/** Análisis del UX Agent — tras Entendimiento (`POST /api/analyze-understanding`). */
export type UnderstandingAnalysisResult = {
    executiveSummary: string;
    contextSynthesis: string;
    businessObjectives: string[];
    keyInsights: string[];
    userPainPoints: string[];
    opportunities: string[];
    risksAndConstraints: string[];
    openQuestions: string[];
    suggestedFocusForIdeation: string;
    /** Si se subió spec de API y el modelo extrajo operaciones. */
    availableEndpoints?: ApiEndpointDescriptor[];
};

export type IdeationSolutionDto = {
    title: string;
    recommendedByAi: boolean;
    flowSteps: string[];
    howItSolves: string[];
    expectedImpact: string[];
};

export type FigmaScreenMetaDto = {
    screenIndex: number;
    nodeId: string;
    name: string;
};

export type FigmaOrchestrationErrorDto = {
    screenIndex: number;
    message: string;
};

export const api = {
    getMe: async (): Promise<{ user: AuthUser | null }> => {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
            if (!response.ok) {
                return { user: null };
            }
            return response.json() as Promise<{ user: AuthUser | null }>;
        } catch {
            return { user: null };
        }
    },

    loginGoogle: (credential: string) =>
        fetchAPI('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential }),
        }) as Promise<{ ok: boolean; user: AuthUser }>,

    /** Solo con backend `AUTH_DISABLED=1`. */
    loginDev: () =>
        fetchAPI('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({}),
        }) as Promise<{ ok: boolean; user: AuthUser }>,

    logout: () => fetchAPI('/api/auth/logout', { method: 'POST' }) as Promise<{ ok: boolean }>,

    getHealth: async (): Promise<HealthResponse> => {
        const response = await fetchWithNetworkHelp(`${API_URL}/health`);
        const text = await response.text();
        if (!text) {
            return { status: 'unknown', database: 'unknown' };
        }
        try {
            return JSON.parse(text) as HealthResponse;
        } catch {
            throw new Error('Respuesta de salud inválida');
        }
    },

    analyzeUnderstanding: async (formData: FormData) => {
        const response = await fetchWithNetworkHelp(`${API_URL}/api/analyze-understanding`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (!response.ok) await rejectResponse(response, '/api/analyze-understanding');
        return response.json() as Promise<{ success: boolean; analysis: UnderstandingAnalysisResult }>;
    },

    generateIdeationSolutions: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
    }) =>
        fetchAPI('/api/generate-ideation-solutions', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; solutions: IdeationSolutionDto[] }>,

    iterateSolution: (body: {
        solution: IdeationSolutionDto;
        initiativeName: string;
        analysis: UnderstandingAnalysisResult;
        history: { role: 'user' | 'assistant'; text: string }[];
        userMessage: string;
    }) =>
        fetchAPI('/api/iterate-solution', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{
            success: boolean;
            reply: string;
            refinedSolution?: IdeationSolutionDto;
        }>,

    iteratePrototype: (body: {
        initiativeName: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        screens: {
            title: string;
            subtitle?: string;
            bullets?: string[];
            note?: string;
            cta?: string;
        }[];
        history: { role: 'user' | 'assistant'; text: string }[];
        userMessage: string;
    }) =>
        fetchAPI('/api/iterate-prototype', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; reply: string }>,

    generatePrototypeScreens: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        iterationMessages?: { role: 'user' | 'assistant'; text: string }[];
        existingScreens?: {
            title: string;
            subtitle?: string;
            bullets?: string[];
            note?: string;
            cta?: string;
        }[];
        prototypeIterationMessages?: { role: 'user' | 'assistant'; text: string }[];
    }) =>
        fetchAPI('/api/generate-prototype-screens', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{
            success: boolean;
            summaryLine: string;
            estimatedTimeLabel?: string;
            flowType?: string;
            screens: {
                title: string;
                subtitle?: string;
                bullets?: string[];
                note?: string;
                cta?: string;
            }[];
        }>,

    generateUserFlow: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        feedback?: string;
        currentSvg?: string;
    }) =>
        fetchAPI('/api/generate-user-flow', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; svg: string }>,

    iterateUserFlowChat: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        currentSvg: string;
        history: { role: 'user' | 'assistant'; text: string }[];
        userMessage: string;
    }) =>
        fetchAPI('/api/iterate-user-flow-chat', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; reply: string }>,

    generateFullFlowHifi: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        feedback?: string;
    }) =>
        fetchAPI('/api/generate-full-flow-hifi', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; raw: string }>,

    generateFigmaFromWireframes: (body: {
        initiativeName: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        hifiWireframesHtml: string[];
        designSystemUrl: string;
        destinationUrl: string;
    }) =>
        fetchAPI('/api/generate-figma-from-wireframes', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{
            success: boolean;
            figmaFileUrl: string;
            figmaFileKey: string | null;
            screens: FigmaScreenMetaDto[];
            logs: string[];
            errors: FigmaOrchestrationErrorDto[];
            figmaApiUsed: boolean;
        }>,

    /** Job de un solo uso para que el plugin de Figma cree frames en el archivo abierto. */
    createFigmaBuildJob: (body: {
        destinationUrl: string;
        designSystemUrl?: string;
        screens: { screenIndex: number; name: string; hifiHtml?: string }[];
        layout?: Partial<{
            frameWidth: number;
            frameHeight: number;
            gap: number;
            startX: number;
            startY: number;
        }>;
    }) =>
        fetchAPI('/api/figma-build-job', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; jobId: string; fetchSecret: string; expiresAt: string }>,

    generateTsxFromFigma: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        figmaFileUrl: string;
        figmaScreensMeta: FigmaScreenMetaDto[];
        hifiWireframesHtml: string[];
        feedback?: string;
    }) =>
        fetchAPI('/api/generate-tsx-from-figma', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; tsxFinalScreens: string[] }>,

    generateTsxMuiScreens: (body: {
        initiativeName: string;
        jiraTicket: string;
        squad: string;
        analysis: UnderstandingAnalysisResult;
        solution: IdeationSolutionDto;
        hifiHtmlScreens: string[];
        feedback?: string;
    }) =>
        fetchAPI('/api/generate-tsx-mui-screens', {
            method: 'POST',
            body: JSON.stringify(body),
        }) as Promise<{ success: boolean; tsxScreens: string[] }>,

    /** Descarga `handoff.zip` (README, theme, rutas, screens/, api/, user-flow.svg). */
    generateHandoffZip: async (body: {
        initiativeName: string;
        analysis: UnderstandingAnalysisResult;
        userFlowSvg: string;
        hifiWireframesHtml: string[];
        tsxMuiScreens?: string[];
        tsxFinalScreens?: string[];
        tsxSource?: 'figma' | 'wireframes';
        figmaFileUrl?: string;
        figmaScreensMeta?: FigmaScreenMetaDto[];
        flowStepLabels: string[];
    }): Promise<void> => {
        const response = await fetchWithNetworkHelp(`${API_URL}/api/generate-handoff-zip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        if (!response.ok) await rejectResponse(response, '/api/generate-handoff-zip');
        const blob = await response.blob();
        const cd = response.headers.get('Content-Disposition');
        let filename = `${body.initiativeName.replace(/[^\w\-.]+/g, '_').slice(0, 72) || 'handoff'}-handoff.zip`;
        const m = cd?.match(/filename="([^"]+)"/i) ?? cd?.match(/filename=([^;\s]+)/i);
        if (m?.[1]) filename = m[1].trim();
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
    },

    patchCardPlatformPipeline: (
        cardId: string,
        body: Partial<{ user_flow_svg: string | null; hifi_full_html: string | null; tsx_mui_json: string | null }>
    ) =>
        fetchAPI(`/api/cards/${cardId}/platform-pipeline`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }) as Promise<Record<string, unknown>>,

    getCards: () => fetchAPI('/api/cards') as Promise<KickoffCard[]>,

    getCard: (id: string) =>
        fetchAPI(`/api/cards/${id}`) as Promise<KickoffCard & { wireframes: WireframeRow[] }>,

    createCard: (title: string, transcript: string) =>
        fetchAPI('/api/cards', {
            method: 'POST',
            body: JSON.stringify({ title, transcript }),
        }) as Promise<KickoffCard>,

    patchCardTitle: (id: string, title: string) =>
        fetchAPI(`/api/cards/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ title }),
        }) as Promise<KickoffCard>,

    deleteCard: async (id: string) => {
        const response = await fetchWithNetworkHelp(`${API_URL}/api/cards/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) await rejectResponse(response, `/api/cards/${id}`);
    },

    duplicateCard: (id: string) =>
        fetchAPI(`/api/cards/${id}/duplicate`, { method: 'POST' }) as Promise<KickoffCard>,

    unlockGeneration: (id: string) =>
        fetchAPI(`/api/cards/${id}/unlock-generation`, { method: 'POST' }) as Promise<KickoffCard>,

    clearGenerationError: (id: string) =>
        fetchAPI(`/api/cards/${id}/clear-generation-error`, { method: 'POST' }) as Promise<KickoffCard>,

    createCardUpload: async (title: string, transcript: string, file: File) => {
        const fd = new FormData();
        fd.append('title', title);
        if (transcript.trim()) fd.append('transcript', transcript);
        fd.append('transcript_file', file);
        const response = await fetchWithNetworkHelp(`${API_URL}/api/cards/upload`, {
            method: 'POST',
            body: fd,
            credentials: 'include',
        });
        if (!response.ok) await rejectResponse(response, '/api/cards/upload');
        return response.json() as Promise<KickoffCard>;
    },

    patchColumn: (id: string, column: 'todo' | 'wip') =>
        fetchAPI(`/api/cards/${id}/column`, {
            method: 'PATCH',
            body: JSON.stringify({ column }),
        }) as Promise<KickoffCard>,

    patchTranscript: (id: string, transcript: string) =>
        fetchAPI(`/api/cards/${id}/transcript`, {
            method: 'PATCH',
            body: JSON.stringify({ transcript }),
        }) as Promise<KickoffCard>,

    patchTranscriptFile: async (id: string, file: File) => {
        const fd = new FormData();
        fd.append('transcript_file', file);
        const response = await fetchWithNetworkHelp(`${API_URL}/api/cards/${id}/transcript/file`, {
            method: 'PATCH',
            body: fd,
            credentials: 'include',
        });
        if (!response.ok)
            await rejectResponse(response, `/api/cards/${id}/transcript/file`);
        return response.json() as Promise<KickoffCard>;
    },

    patchSpec: (id: string, spec_markdown: string) =>
        fetchAPI(`/api/cards/${id}/spec`, {
            method: 'PATCH',
            body: JSON.stringify({ spec_markdown }),
        }) as Promise<KickoffCard>,

    runSpec: (id: string) =>
        fetchAPI(`/api/cards/${id}/run-spec`, { method: 'POST' }) as Promise<{ success: boolean }>,

    approveSpec: (id: string) =>
        fetchAPI(`/api/cards/${id}/gate-spec/approve`, { method: 'POST' }) as Promise<{ success: boolean }>,

    rejectSpec: (id: string, comment: string) =>
        fetchAPI(`/api/cards/${id}/gate-spec/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment }),
        }) as Promise<{ success: boolean }>,

    approveWireframes: (id: string, selected_option?: 1 | 2 | 3, comment?: string) =>
        fetchAPI(`/api/cards/${id}/gate-wireframes/approve`, {
            method: 'POST',
            body: JSON.stringify({ selected_option, comment }),
        }) as Promise<KickoffCard>,

    rejectWireframes: (id: string, comment: string) =>
        fetchAPI(`/api/cards/${id}/gate-wireframes/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment }),
        }) as Promise<{ success: boolean }>,

    approveStakeholder: (id: string) =>
        fetchAPI(`/api/cards/${id}/gate-stakeholder/approve`, { method: 'POST' }) as Promise<KickoffCard>,

    rejectStakeholder: (id: string, comment: string, restart_from: 'spec' | 'wireframes') =>
        fetchAPI(`/api/cards/${id}/gate-stakeholder/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment, restart_from }),
        }) as Promise<{ success: boolean }>,

    approveFlowbite: (id: string) =>
        fetchAPI(`/api/cards/${id}/gate-flowbite/approve`, { method: 'POST' }) as Promise<KickoffCard>,

    rejectFlowbite: (id: string, comment: string) =>
        fetchAPI(`/api/cards/${id}/gate-flowbite/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment }),
        }) as Promise<{ success: boolean }>,

    /** Paso E: 3 wireframes responsivos desde spec refinado (no persiste en tarjeta). */
    generateWireframes: (specText: string) =>
        fetchAPI('/api/generate-wireframes', {
            method: 'POST',
            body: JSON.stringify({ specText }),
        }) as Promise<{ success: boolean; options: StepEWireframeOption[] }>,

    downloadCardExport: async (id: string) => {
        const response = await fetchWithNetworkHelp(`${API_URL}/api/cards/${id}/export`, {
            credentials: 'include',
        });
        if (!response.ok) await rejectResponse(response, `/api/cards/${id}/export`);
        const blob = await response.blob();
        const cd = response.headers.get('Content-Disposition');
        const quoted = cd?.match(/filename="([^"]+)"/i);
        const filename = quoted?.[1] ?? `framework-ux-${id.slice(0, 8)}.json`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
};
