import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import {
    loadWorkflow,
    patchWorkflow,
    type IdeationSolution,
    type PrototypeMeta,
    type WorkflowSession,
} from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

function buildPrototypeMeta(solution: IdeationSolution): PrototypeMeta {
    const short = solution.title.replace(/^Solución\s*\d+\s*:\s*/i, '').trim() || solution.title;
    return {
        screenCount: 6,
        estimatedTimeLabel: '~2min',
        flowType: 'Lineal',
        summaryLine: `${short} • 6 pantallas • Flujo lineal`,
    };
}

function IconRefresh() {
    return (
        <svg className="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
        </svg>
    );
}

function IconCheck() {
    return (
        <svg className="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    );
}

function SolutionCard({
    index,
    solution,
    onIterate,
    onAccept,
}: {
    index: 1 | 2 | 3;
    solution: IdeationSolution;
    onIterate: () => void;
    onAccept: () => void;
}) {
    return (
        <div className={`border-2 border-gray-200 rounded-lg p-6 card-hover solution-card`} id={`solution-${index}`}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{solution.title}</h3>
                    {solution.recommendedByAi ? (
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            Recomendado por IA
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Descripción del flujo</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    {solution.flowSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                    ))}
                </ol>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">Cómo resuelve el problema</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                        {solution.howItSolves.map((line, i) => (
                            <li key={i}>• {line.replace(/^•\s*/, '')}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Impacto esperado</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                        {solution.expectedImpact.map((line, i) => (
                            <li key={i}>• {line.replace(/^•\s*/, '')}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={onIterate}
                    className="flex-1 border-2 border-purple-600 text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-purple-50 transition-all flex items-center justify-center ux-focus"
                >
                    <IconRefresh />
                    Iterar solución
                </button>
                <button
                    type="button"
                    onClick={onAccept}
                    className="flex-1 gradient-bg text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center ux-focus"
                >
                    <IconCheck />
                    Aceptar solución
                </button>
            </div>
        </div>
    );
}

export default function IdeacionPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [overlayMode, setOverlayMode] = useState<'idle' | 'ideation' | 'prototype'>('idle');
    const [error, setError] = useState<string | null>(null);

    const runIdeation = useCallback(async (base: WorkflowSession) => {
        if (!base.analysis) return;
        setOverlayMode('ideation');
        setError(null);
        try {
            const { solutions } = await api.generateIdeationSolutions({
                initiativeName: base.initiativeName,
                jiraTicket: base.jiraTicket,
                squad: base.squad,
                analysis: base.analysis,
            });
            const next = patchWorkflow({ ideationSolutions: solutions });
            if (next) setWf(next);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo generar la ideación.');
        } finally {
            setOverlayMode('idle');
        }
    }, []);

    useEffect(() => {
        document.title = 'Ideación · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.analysis) {
            navigate('/', { replace: true });
            return;
        }
        setWf(w);
        if (w.ideationSolutions && w.ideationSolutions.length === 3) {
            return;
        }
        void runIdeation(w);
    }, [navigate, runIdeation]);

    async function acceptSolution(index: 1 | 2 | 3) {
        if (!wf?.ideationSolutions?.[index - 1]) return;
        const solution = wf.ideationSolutions[index - 1];
        patchWorkflow({
            selectedSolutionIndex: index,
            prototypeMeta: buildPrototypeMeta(solution),
        });
        setOverlayMode('prototype');
        await new Promise((r) => setTimeout(r, 1600));
        setOverlayMode('idle');
        navigate('/prototipado');
    }

    const contextLine = wf
        ? [wf.initiativeName, wf.jiraTicket, wf.squad].filter(Boolean).join(' • ')
        : '';

    if (!wf) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">
                Cargando…
            </div>
        );
    }

    if (error && !wf?.ideationSolutions?.length) {
        return (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
                <ProgressBar currentStep={2} />
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            const w = loadWorkflow();
                            if (w) void runIdeation(w);
                        }}
                        className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold ux-focus"
                    >
                        Reintentar
                    </button>
                </div>
            </main>
        );
    }

    const solutions = wf.ideationSolutions ?? [];

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 relative">
            <ProgressBar currentStep={2} />

            {(overlayMode === 'ideation' || overlayMode === 'prototype') && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[400] p-4">
                    <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-xl">
                        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">UX Agent procesando…</h3>
                        <p className="text-gray-600">
                            {overlayMode === 'ideation'
                                ? 'Analizando información y generando propuestas'
                                : 'Preparando el prototipo navegable'}
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">2. Ideación</h1>
                    <p className="text-gray-600">
                        El UX Agent ha generado 3 propuestas de solución basadas en el análisis del problema
                    </p>
                </div>

                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <svg
                            className="w-5 h-5 text-blue-600 mr-3 mt-0.5 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden
                        >
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-blue-900">Contexto del problema</p>
                            <p className="text-sm text-blue-800 mt-1">
                                {contextLine || 'Completá el entendimiento y el análisis.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 mb-8">
                    {solutions.length === 0 && !error ? (
                        <p className="text-center text-gray-600 py-12">Preparando las tres propuestas de solución…</p>
                    ) : null}
                    {solutions.map((sol, i) => {
                        const idx = (i + 1) as 1 | 2 | 3;
                        return (
                            <SolutionCard
                                key={i}
                                index={idx}
                                solution={sol}
                                onIterate={() => navigate(`/ideacion/iterar/${idx}`)}
                                onAccept={() => void acceptSolution(idx)}
                            />
                        );
                    })}
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/iniciativa/nueva"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                    >
                        ← Volver a Entendimiento
                    </Link>
                    <button
                        type="button"
                        onClick={() =>
                            toast(
                                'Elegí una solución y usá «Iterar solución» para refinar con el agente, o escribinos desde ahí.',
                                'success'
                            )
                        }
                        className="px-6 py-3 border border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all ux-focus"
                    >
                        ✨ Iterar con el agente
                    </button>
                </div>
            </div>
        </main>
    );
}
