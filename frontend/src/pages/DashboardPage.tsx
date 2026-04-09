import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    createNewInitiative,
    loadInitiativeRecords,
    setCurrentInitiativeId,
    setInitiativeCompleted,
    type InitiativeRecord,
} from '../lib/initiativesSession';
import {
    loadWorkflowByInitiativeId,
    migrateLegacyWorkflowIfNeeded,
    saveWorkflow,
    type WorkflowSession,
} from '../lib/workflowSession';
import {
    formatRelativeTime,
    formatShortDate,
    getWorkflowPhaseInfo,
} from '../lib/workflowPhase';

type FilterKey = 'all' | 'progress' | 'finished';

type RowVM = InitiativeRecord & {
    name: string;
    jiraTicket: string;
    squad: string;
    status: 'En progreso' | 'Finalizada';
    currentStep: string;
    progress: number;
    lastUpdated: string;
    dateCreated: string;
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [listVersion, setListVersion] = useState(0);
    const refresh = useCallback(() => setListVersion((n) => n + 1), []);

    const [filter, setFilter] = useState<FilterKey>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        document.title = 'Panel · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        migrateLegacyWorkflowIfNeeded();
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (location.pathname === '/') refresh();
    }, [location.pathname, location.key, refresh]);

    const rows: RowVM[] = useMemo(() => {
        const records = loadInitiativeRecords();
        return records.map((r) => {
            const w = loadWorkflowByInitiativeId(r.id);
            const name = w?.initiativeName?.trim() || 'Sin título';
            const jiraTicket = w?.jiraTicket?.trim() || '—';
            const squad = w?.squad?.trim() || '—';
            const completed = r.completed || Boolean(w?.workflowCompleted);
            const phase = getWorkflowPhaseInfo(w);
            const status: RowVM['status'] = completed ? 'Finalizada' : 'En progreso';
            const progress = completed ? 100 : phase.progress;
            const currentStep = completed ? 'Handoff' : phase.currentStep;
            return {
                ...r,
                name,
                jiraTicket,
                squad,
                status,
                currentStep,
                progress,
                lastUpdated: formatRelativeTime(r.updatedAt),
                dateCreated: formatShortDate(r.createdAt),
            };
        });
    }, [listVersion]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((row) => {
            if (filter === 'progress' && row.status !== 'En progreso') return false;
            if (filter === 'finished' && row.status !== 'Finalizada') return false;
            if (!q) return true;
            return (
                row.name.toLowerCase().includes(q) ||
                row.jiraTicket.toLowerCase().includes(q) ||
                row.squad.toLowerCase().includes(q)
            );
        });
    }, [rows, filter, search]);

    const total = rows.length;
    const inProgress = rows.filter((r) => r.status === 'En progreso').length;
    const finished = rows.filter((r) => r.status === 'Finalizada').length;

    function onCreateNew() {
        createNewInitiative();
        navigate('/iniciativa/nueva');
    }

    function onContinue(row: RowVM) {
        const w = loadWorkflowByInitiativeId(row.id);
        setCurrentInitiativeId(row.id);
        const path = getWorkflowPhaseInfo(w).continuePath;
        navigate(path);
    }

    function onViewDetails(row: RowVM) {
        setCurrentInitiativeId(row.id);
        navigate('/resumen');
    }

    function onReopen(row: RowVM) {
        setCurrentInitiativeId(row.id);
        const w = loadWorkflowByInitiativeId(row.id);
        if (w) {
            const next: WorkflowSession = {
                ...w,
                workflowCompleted: false,
                handoffVisited: false,
            };
            saveWorkflow(next);
        }
        setInitiativeCompleted(row.id, false);
        navigate('/ideacion');
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 fade-in">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-8 mb-8 text-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">¡Bienvenido al UX Agent! 👋</h1>
                        <p className="text-purple-100 text-lg max-w-2xl">
                            Transformá problemas de negocio en soluciones de producto usando IA
                        </p>
                    </div>
                    <div className="hidden md:block shrink-0">
                        <svg
                            className="w-24 h-24 text-white opacity-20"
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
                    </div>
                </div>
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={onCreateNew}
                        className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-all shadow-md flex items-center w-fit ux-focus"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Crear nueva iniciativa
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-600">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">Total de iniciativas</p>
                            <p className="text-3xl font-bold text-gray-900">{total}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">En progreso</p>
                            <p className="text-3xl font-bold text-gray-900">{inProgress}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">Finalizadas</p>
                            <p className="text-3xl font-bold text-gray-900">{finished}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2 className="text-xl font-bold text-gray-900">Mis iniciativas</h2>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as FilterKey)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent ux-focus"
                            aria-label="Filtrar por estado"
                        >
                            <option value="all">Todas</option>
                            <option value="progress">En progreso</option>
                            <option value="finished">Finalizadas</option>
                        </select>
                        <input
                            type="search"
                            placeholder="Buscar por nombre o Jira…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64 ux-focus"
                        />
                    </div>
                </div>

                <div className="divide-y divide-gray-200">
                    {filtered.length === 0 ? (
                        <div className="p-10 text-center text-gray-600 text-sm">
                            {total === 0
                                ? 'Todavía no hay iniciativas. Creá una nueva para comenzar el flujo.'
                                : 'No hay resultados con este filtro o búsqueda.'}
                        </div>
                    ) : (
                        filtered.map((row) => (
                            <div key={row.id} className="p-6 hover:bg-gray-50 transition-all">
                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">{row.name}</h3>
                                            {row.status === 'Finalizada' ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                                    ✓ Finalizada
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                                    ● En progreso
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                                            <div className="flex items-center">
                                                <svg
                                                    className="w-4 h-4 mr-1 text-purple-600 shrink-0"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    aria-hidden
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                                    />
                                                </svg>
                                                <span className="font-medium text-gray-800">{row.jiraTicket}</span>
                                            </div>
                                            <div className="flex items-center min-w-0">
                                                <svg
                                                    className="w-4 h-4 mr-1 text-gray-400 shrink-0"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    aria-hidden
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                                    />
                                                </svg>
                                                <span className="truncate">{row.squad}</span>
                                            </div>
                                            <div className="flex items-center">
                                                <svg
                                                    className="w-4 h-4 mr-1 text-gray-400 shrink-0"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    aria-hidden
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                </svg>
                                                {row.lastUpdated}
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3">Creada: {row.dateCreated}</p>
                                        <div className="mb-1">
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-gray-600">
                                                    Estado actual:{' '}
                                                    <span className="font-medium text-gray-900">{row.currentStep}</span>
                                                </span>
                                                <span className="text-gray-600 font-medium">{row.progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${
                                                        row.status === 'Finalizada' ? 'bg-green-600' : 'bg-purple-600'
                                                    }`}
                                                    style={{ width: `${row.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 lg:ml-6 lg:flex-col xl:flex-row shrink-0">
                                        {row.status === 'Finalizada' ? (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => onViewDetails(row)}
                                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all ux-focus"
                                                >
                                                    Ver detalles
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onReopen(row)}
                                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all flex items-center justify-center gap-2 ux-focus"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                        />
                                                    </svg>
                                                    Iterar
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onContinue(row)}
                                                className="px-6 py-2 gradient-bg text-white rounded-lg font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 ux-focus"
                                            >
                                                Continuar
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                    />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
