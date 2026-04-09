import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { loadWorkflow, saveWorkflow, type WorkflowSession } from '../lib/workflowSession';
import type { UnderstandingAnalysisResult } from '../services/api';

type AnalisisPayload = {
    analysis: UnderstandingAnalysisResult;
    initiativeName: string;
    jiraTicket: string;
    squad: string;
};

function isValidAnalysis(a: unknown): a is UnderstandingAnalysisResult {
    if (!a || typeof a !== 'object') return false;
    const o = a as Record<string, unknown>;
    return typeof o.executiveSummary === 'string';
}

function IconCheckCircle() {
    return (
        <svg
            className="w-5 h-5 text-purple-600 mr-2 mt-0.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden
        >
            <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
            />
        </svg>
    );
}

function IconInsight() {
    return (
        <svg
            className="w-5 h-5 text-orange-500 mr-2 mt-0.5 shrink-0"
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
    );
}

export default function UxAgentAnalysisPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [payload, setPayload] = useState<AnalisisPayload | null>(null);

    useEffect(() => {
        document.title = 'Análisis del UX Agent · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const st = location.state as Partial<AnalisisPayload> | null;
        if (st?.analysis && isValidAnalysis(st.analysis)) {
            const next: AnalisisPayload = {
                analysis: st.analysis,
                initiativeName: typeof st.initiativeName === 'string' ? st.initiativeName : '',
                jiraTicket: typeof st.jiraTicket === 'string' ? st.jiraTicket : '',
                squad: typeof st.squad === 'string' ? st.squad : '',
            };
            setPayload(next);
            const prev = loadWorkflow() ?? { initiativeName: '', jiraTicket: '', squad: '' };
            const session: WorkflowSession = {
                ...prev,
                initiativeName: next.initiativeName,
                jiraTicket: next.jiraTicket,
                squad: next.squad,
                analysis: next.analysis,
                ideationSolutions: undefined,
                selectedSolutionIndex: undefined,
                prototypeMeta: undefined,
                handoffVisited: false,
                workflowCompleted: false,
            };
            saveWorkflow(session);
            return;
        }
        const w = loadWorkflow();
        if (w?.analysis) {
            setPayload({
                initiativeName: w.initiativeName,
                jiraTicket: w.jiraTicket,
                squad: w.squad,
                analysis: w.analysis,
            });
            return;
        }
        navigate('/', { replace: true });
    }, [location.state, navigate]);

    if (!payload) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">
                Cargando análisis…
            </div>
        );
    }

    const { analysis: a, initiativeName, jiraTicket, squad } = payload;

    const contextParagraph = [a.executiveSummary?.trim(), a.contextSynthesis?.trim()]
        .filter(Boolean)
        .join('\n\n');

    const objectives = a.businessObjectives?.length ? a.businessObjectives : [];
    const insights = a.keyInsights?.length ? a.keyInsights : [];

    const hasExtended =
        a.userPainPoints.length > 0 ||
        a.opportunities.length > 0 ||
        a.risksAndConstraints.length > 0 ||
        a.openQuestions.length > 0 ||
        a.suggestedFocusForIdeation.trim().length > 0;

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={1} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h1 className="text-3xl font-bold text-gray-900">Análisis del UX Agent</h1>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium w-fit">
                            ✓ Completado
                        </span>
                    </div>
                    <p className="text-gray-600">
                        El agente ha procesado toda la información y estructurado el contexto del problema
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="border-l-4 border-purple-600 bg-purple-50 p-6 rounded-r-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">Contexto del problema</h3>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {contextParagraph || 'Sin síntesis disponible.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-3">Objetivo de negocio</h3>
                            <ul className="space-y-2 text-gray-700">
                                {objectives.length > 0 ? (
                                    objectives.map((line, i) => (
                                        <li key={i} className="flex items-start">
                                            <IconCheckCircle />
                                            <span>{line}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="flex items-start text-gray-500 italic">
                                        <IconCheckCircle />
                                        <span>
                                            No se inferieron objetivos explícitos; podés enriquecer el contexto en
                                            Entendimiento y volver a analizar.
                                        </span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-3">Insights clave</h3>
                            <ul className="space-y-2 text-gray-700">
                                {insights.length > 0 ? (
                                    insights.map((line, i) => (
                                        <li key={i} className="flex items-start">
                                            <IconInsight />
                                            <span>{line}</span>
                                        </li>
                                    ))
                                ) : (
                                    <li className="flex items-start text-gray-500 italic">
                                        <IconInsight />
                                        <span>Sin insights listados; revisá documentación o notas adicionales.</span>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {hasExtended ? (
                        <details className="border border-gray-200 rounded-lg p-4 bg-gray-50/80">
                            <summary className="cursor-pointer font-medium text-gray-900 text-sm select-none">
                                Ver detalle ampliado del análisis
                            </summary>
                            <div className="mt-4 space-y-4 text-sm text-gray-700">
                                {a.userPainPoints.length > 0 ? (
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-2">Pain points de usuario</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {a.userPainPoints.map((x, i) => (
                                                <li key={i}>{x}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {a.opportunities.length > 0 ? (
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-2">Oportunidades</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {a.opportunities.map((x, i) => (
                                                <li key={i}>{x}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {a.risksAndConstraints.length > 0 ? (
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-2">Riesgos y restricciones</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {a.risksAndConstraints.map((x, i) => (
                                                <li key={i}>{x}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {a.openQuestions.length > 0 ? (
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-2">Preguntas abiertas</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {a.openQuestions.map((x, i) => (
                                                <li key={i}>{x}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {a.suggestedFocusForIdeation.trim() ? (
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-2">
                                            Enfoque sugerido para ideación
                                        </p>
                                        <p className="leading-relaxed whitespace-pre-wrap">
                                            {a.suggestedFocusForIdeation}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </details>
                    ) : null}

                    <div className="pt-6 flex flex-col-reverse sm:flex-row gap-4">
                        <Link
                            to="/iniciativa/nueva"
                            className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                        >
                            ← Editar contexto
                        </Link>
                        <button
                            type="button"
                            onClick={() => navigate('/ideacion')}
                            className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus"
                        >
                            Continuar a Ideación →
                        </button>
                    </div>
                </div>
            </div>

            <p className="mt-4 text-xs text-gray-500 text-center sm:text-left">
                {initiativeName}
                {jiraTicket ? ` · ${jiraTicket}` : ''}
                {squad ? ` · ${squad}` : ''}
            </p>
        </main>
    );
}
