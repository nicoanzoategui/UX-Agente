import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import HandoffAnalyticsTab from '../components/platform/handoff/HandoffAnalyticsTab';
import HandoffComponentsTab from '../components/platform/handoff/HandoffComponentsTab';
import HandoffContentTab from '../components/platform/handoff/HandoffContentTab';
import HandoffScreensTab from '../components/platform/handoff/HandoffScreensTab';
import { useToast } from '../context/ToastContext';
import { getCurrentInitiativeId, setInitiativeCompleted } from '../lib/initiativesSession';
import { loadWorkflow, patchWorkflow } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

function CheckLi({ className, children }: { className: string; children: ReactNode }) {
    return (
        <li className="flex items-start">
            <svg className={`w-5 h-5 ${className} mr-2 mt-0.5 shrink-0`} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                />
            </svg>
            <span className="text-gray-700 text-sm">{children}</span>
        </li>
    );
}

type DocTab = 'overview' | 'screens' | 'content' | 'components' | 'analytics';

export default function HandoffPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const wf = loadWorkflow();
    const [tab, setTab] = useState<DocTab>('overview');
    const [zipBusy, setZipBusy] = useState(false);
    const markedHandoffVisit = useRef(false);

    useEffect(() => {
        document.title = 'Handoff · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.tsxMuiApproved) return;
        if (markedHandoffVisit.current) return;
        markedHandoffVisit.current = true;
        patchWorkflow({ handoffVisited: true });
    }, []);

    if (!wf?.analysis || wf.selectedSolutionIndex == null || !wf.ideationSolutions?.length) {
        return <Navigate to="/ideacion" replace />;
    }

    if (!wf.tsxMuiApproved) {
        if (!wf.userFlowApproved) return <Navigate to="/user-flow" replace />;
        if (!wf.hifiWireframesApproved) return <Navigate to="/wireframes-hifi" replace />;
        if (!wf.figmaApproved) return <Navigate to="/figma" replace />;
        return <Navigate to="/codigo-mui" replace />;
    }

    const sol = wf.ideationSolutions[wf.selectedSolutionIndex - 1];
    if (!sol) {
        return <Navigate to="/ideacion" replace />;
    }

    const created = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date());
    const problema = [wf.analysis.executiveSummary, wf.analysis.contextSynthesis].filter(Boolean).join('\n\n');
    const objetivoNegocio =
        wf.analysis.businessObjectives.length > 0
            ? wf.analysis.businessObjectives.join(' ')
            : 'Definir objetivos de negocio con el equipo de producto.';
    const flujoPrincipal = sol.flowSteps.length > 0 ? sol.flowSteps.join(' → ') : 'Definir el flujo en base al análisis.';

    const opportunities = wf.analysis.opportunities ?? [];
    const risks = wf.analysis.risksAndConstraints ?? [];
    const openQuestions = wf.analysis.openQuestions ?? [];
    const keyInsights = wf.analysis.keyInsights ?? [];
    const focusIdeacion = wf.analysis.suggestedFocusForIdeation?.trim() ?? '';

    async function downloadHandoffZip() {
        const w = loadWorkflow();
        if (!w?.analysis) {
            toast('No hay análisis en sesión.', 'error');
            return;
        }
        const tsxFinal = w.tsxFinalScreens?.filter((x) => x.trim()) ?? [];
        const tsxLegacy = w.tsxMuiScreens?.filter((x) => x.trim()) ?? [];
        const tsxForZip = tsxFinal.length > 0 ? tsxFinal : tsxLegacy;
        if (tsxForZip.length === 0) {
            toast('No hay código TSX generado para armar el handoff.', 'error');
            return;
        }
        const idx = w.selectedSolutionIndex;
        const activeSol =
            idx != null && idx >= 1 && idx <= 3 ? w.ideationSolutions?.[idx - 1] : undefined;
        const flowStepLabels = activeSol?.flowSteps ?? sol.flowSteps;
        setZipBusy(true);
        try {
            await api.generateHandoffZip({
                initiativeName: w.initiativeName,
                analysis: w.analysis,
                userFlowSvg: w.userFlowSvg ?? '',
                hifiWireframesHtml: w.hifiWireframesHtml ?? [],
                tsxFinalScreens: tsxFinal.length > 0 ? tsxFinal : undefined,
                tsxMuiScreens: tsxFinal.length > 0 ? undefined : tsxLegacy.length > 0 ? tsxLegacy : undefined,
                tsxSource: tsxFinal.length > 0 ? 'figma' : 'wireframes',
                figmaFileUrl: w.figmaFileUrl,
                figmaScreensMeta: w.figmaScreensMeta,
                flowStepLabels,
            });
            toast('Paquete handoff descargado.', 'success');
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'No se pudo generar el ZIP de handoff.';
            toast(msg, 'error');
        } finally {
            setZipBusy(false);
        }
    }

    function tabBtn(id: DocTab, label: string) {
        const active = tab === id;
        return (
            <button
                type="button"
                onClick={() => setTab(id)}
                className={`doc-tab px-4 py-2 text-sm font-medium rounded ${
                    active
                        ? 'bg-white text-purple-600 border border-purple-600'
                        : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
                {label}
            </button>
        );
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={7} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold text-gray-900">7. Handoff colaborativo</h1>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            ✓ Documentación generada
                        </span>
                    </div>
                    <p className="text-gray-600">El UX Agent ha creado la documentación completa en Confluence</p>
                </div>

                {(wf.figmaFileUrl || (wf.figmaScreensMeta && wf.figmaScreensMeta.length > 0)) && (
                    <div className="mb-6 border border-indigo-200 bg-indigo-50 rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Fuente de diseño final: Figma</h3>
                        {wf.figmaFileUrl ? (
                            <p className="text-sm text-gray-700 mb-2">
                                Archivo:{' '}
                                <a
                                    href={wf.figmaFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-purple-700 underline font-medium"
                                >
                                    Abrir en Figma
                                </a>
                            </p>
                        ) : null}
                        {wf.figmaScreensMeta && wf.figmaScreensMeta.length > 0 ? (
                            <div className="text-sm text-gray-700">
                                <p className="font-medium text-gray-800 mb-1">Pantallas (nodeId)</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    {wf.figmaScreensMeta.map((s) => (
                                        <li key={`${s.screenIndex}-${s.nodeId}`}>
                                            {s.screenIndex}. {s.name}{' '}
                                            <span className="text-gray-500 font-mono text-xs">{s.nodeId}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        <p className="text-xs text-gray-600 mt-2">
                            El ZIP incluye <code className="bg-white/80 px-1 rounded">figma-metadata.json</code> cuando hay
                            datos de Figma.
                        </p>
                    </div>
                )}

                <div className="mb-6 rounded-xl border-2 border-purple-500 bg-gradient-to-br from-purple-600 to-indigo-700 p-6 text-white shadow-lg">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold mb-1">Descargar Handoff para el Dev</h2>
                            <p className="text-sm text-purple-100 max-w-xl">
                                ZIP listo con README, tema MUI, rutas React Router, carpeta{' '}
                                <code className="text-xs bg-white/15 px-1 rounded">screens/</code>,{' '}
                                <code className="text-xs bg-white/15 px-1 rounded">api/endpoints.ts</code>, user flow en SVG
                                y, si aplica, <code className="text-xs bg-white/15 px-1 rounded">figma-metadata.json</code>.
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={zipBusy}
                            onClick={() => void downloadHandoffZip()}
                            className="shrink-0 inline-flex items-center justify-center gap-2 bg-white text-purple-800 font-semibold px-6 py-3 rounded-lg shadow hover:bg-purple-50 ux-focus disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {zipBusy ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                    Generando ZIP…
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                    </svg>
                                    Descargar Handoff para el Dev
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentación generada automáticamente</h3>
                            <p className="text-gray-700 mb-4">
                                El UX Agent ha creado una página completa de Confluence lista para desarrollo
                            </p>
                            <a
                                href="#"
                                className="inline-flex items-center text-purple-600 font-medium hover:text-purple-700 ux-focus"
                                onClick={(e) => e.preventDefault()}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                </svg>
                                Ver en Confluence
                            </a>
                        </div>
                        <svg className="w-16 h-16 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h3 className="font-semibold text-gray-900">Vista previa de la documentación en Confluence</h3>
                        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                            {tabBtn('overview', 'Resumen')}
                            {tabBtn('screens', 'Pantallas')}
                            {tabBtn('content', 'Contenido')}
                            {tabBtn('components', 'Componentes')}
                            {tabBtn('analytics', 'Analytics')}
                        </div>
                    </div>

                    {tab === 'overview' && (
                        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">{wf.initiativeName}</h2>

                            <div className="mb-8">
                                <h3 className="text-xl font-semibold text-gray-900 mb-3 pb-2 border-b-2 border-purple-600">
                                    Contexto de la iniciativa
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Nombre de la iniciativa</p>
                                        <p className="font-medium text-gray-900">{wf.initiativeName}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Ticket de Jira</p>
                                        <p className="font-medium text-gray-900">
                                            {wf.jiraTicket ? (
                                                <a href="#" className="text-purple-600 hover:underline ux-focus" onClick={(e) => e.preventDefault()}>
                                                    {wf.jiraTicket}
                                                </a>
                                            ) : (
                                                '—'
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Squad / Producto</p>
                                        <p className="font-medium text-gray-900">{wf.squad || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Fecha de creación</p>
                                        <p className="font-medium text-gray-900">{created}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <p className="text-sm text-gray-600 mb-1">Problema identificado</p>
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{problema}</p>
                                </div>
                                <div className="mt-4">
                                    <p className="text-sm text-gray-600 mb-1">Objetivo de negocio</p>
                                    <p className="text-gray-700 leading-relaxed">{objetivoNegocio}</p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-xl font-semibold text-gray-900 mb-3 pb-2 border-b-2 border-purple-600">
                                    Descripción de la solución
                                </h3>
                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Flujo completo de la experiencia</h4>
                                    <p className="text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">
                                        <span className="font-medium text-gray-900">Solución:</span> {sol.title}.
                                        {focusIdeacion ? (
                                            <>
                                                {' '}
                                                <span className="font-medium text-gray-900">Foco sugerido para ideación:</span>{' '}
                                                {focusIdeacion}
                                            </>
                                        ) : null}
                                    </p>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-blue-900 mb-2">Flujo principal (pasos)</p>
                                        <p className="text-sm text-blue-800">{flujoPrincipal}</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Cómo resuelve el problema</h4>
                                    <ul className="space-y-2 text-gray-700">
                                        {sol.howItSolves.map((line, i) => (
                                            <li key={i} className="flex items-start">
                                                <span className="text-purple-600 mr-2">•</span>
                                                <span>{line.replace(/^•\s*/, '')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {opportunities.length > 0 ? (
                                    <div className="mb-4">
                                        <h4 className="font-semibold text-gray-900 mb-2">Oportunidades (análisis)</h4>
                                        <ul className="space-y-2 text-gray-700">
                                            {opportunities.map((line, i) => (
                                                <li key={i} className="flex items-start">
                                                    <span className="text-green-600 mr-2">•</span>
                                                    <span>{line.replace(/^•\s*/, '')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {keyInsights.length > 0 ? (
                                    <div className="mb-4">
                                        <h4 className="font-semibold text-gray-900 mb-2">Insights clave</h4>
                                        <ul className="space-y-2 text-gray-700">
                                            {keyInsights.map((line, i) => (
                                                <li key={i} className="flex items-start">
                                                    <span className="text-blue-600 mr-2">•</span>
                                                    <span>{line.replace(/^•\s*/, '')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {risks.length > 0 ? (
                                    <div className="mb-4">
                                        <h4 className="font-semibold text-gray-900 mb-2">Riesgos y restricciones</h4>
                                        <div className="space-y-2">
                                            {risks.map((line, i) => (
                                                <div key={i} className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-gray-800">
                                                    {line.replace(/^•\s*/, '')}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {openQuestions.length > 0 ? (
                                    <div className="mb-4">
                                        <h4 className="font-semibold text-gray-900 mb-2">Preguntas abiertas</h4>
                                        <ul className="space-y-2 text-gray-700">
                                            {openQuestions.map((line, i) => (
                                                <li key={i} className="flex items-start">
                                                    <span className="text-gray-500 mr-2">?</span>
                                                    <span>{line.replace(/^•\s*/, '')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {tab === 'screens' && (
                        <HandoffScreensTab
                            prototypeScreens={wf.prototypeScreens}
                            flowSteps={sol.flowSteps}
                            flowStepLabels={sol.flowSteps}
                            hifiWireframesHtml={wf.hifiWireframesHtml}
                        />
                    )}

                    {tab === 'content' && (
                        <HandoffContentTab
                            initiativeName={wf.initiativeName}
                            prototypeScreens={wf.prototypeScreens}
                            flowSteps={sol.flowSteps}
                        />
                    )}

                    {tab === 'components' && (
                        <HandoffComponentsTab
                            howItSolves={sol.howItSolves}
                            opportunities={opportunities}
                            tsxMuiScreens={
                                wf.tsxFinalScreens && wf.tsxFinalScreens.length > 0
                                    ? wf.tsxFinalScreens
                                    : wf.tsxMuiScreens
                            }
                            flowStepLabels={sol.flowSteps}
                        />
                    )}

                    {tab === 'analytics' && (
                        <HandoffAnalyticsTab
                            expectedImpact={sol.expectedImpact}
                            keyInsights={keyInsights}
                            businessObjectives={wf.analysis.businessObjectives}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                        <h3 className="font-semibold text-gray-900 mb-3">🤖 Output del UX Agent</h3>
                        <ul className="space-y-2 text-gray-700 text-sm">
                            <CheckLi className="text-purple-600">Contexto del problema</CheckLi>
                            <CheckLi className="text-purple-600">Flujo de la solución</CheckLi>
                            <CheckLi className="text-purple-600">Mapa de pantallas</CheckLi>
                            <CheckLi className="text-purple-600">Contenido UX (copy)</CheckLi>
                            <CheckLi className="text-purple-600">Componentes sugeridos</CheckLi>
                            <CheckLi className="text-purple-600">Instrumentación analytics</CheckLi>
                        </ul>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="font-semibold text-gray-900 mb-3">👤 Trabajo del Designer</h3>
                        <ul className="space-y-2 text-gray-700 text-sm">
                            <CheckLi className="text-blue-600">Diseño en alta fidelidad (Figma)</CheckLi>
                            <CheckLi className="text-blue-600">Aplicación del design system</CheckLi>
                            <CheckLi className="text-blue-600">Estados y variantes</CheckLi>
                            <CheckLi className="text-blue-600">Refinamiento de contenido</CheckLi>
                            <CheckLi className="text-blue-600">Especificaciones de interacción</CheckLi>
                            <CheckLi className="text-blue-600">Implementación visual final</CheckLi>
                        </ul>
                    </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <h3 className="font-semibold text-green-900 mb-2">✅ Resultado del handoff</h3>
                    <p className="text-green-800 text-sm">
                        El equipo de desarrollo recibe documentación funcional completa (UX Agent) + diseño final en alta
                        fidelidad (Designer), permitiendo una implementación clara y estructurada de la solución.
                    </p>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/codigo-mui"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                    >
                        ← Volver a código TSX
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            patchWorkflow({ workflowCompleted: true });
                            const id = getCurrentInitiativeId();
                            if (id) setInitiativeCompleted(id, true);
                            navigate('/resumen');
                        }}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all text-center ux-focus"
                    >
                        Ver resumen final del proyecto
                    </button>
                </div>
            </div>
        </main>
    );
}
