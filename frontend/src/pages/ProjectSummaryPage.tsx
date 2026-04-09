import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import { clearCurrentInitiativeSelection, loadWorkflow } from '../lib/workflowSession';
import { getWorkflowPhaseInfo } from '../lib/workflowPhase';

export default function ProjectSummaryPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const wf = loadWorkflow();

    if (!wf?.workflowCompleted) {
        return <Navigate to={getWorkflowPhaseInfo(wf).continuePath} replace />;
    }

    function startNew() {
        clearCurrentInitiativeSelection();
        navigate('/');
    }

    function exportSummary() {
        toast('La exportación del resumen estará disponible cuando conectemos Confluence / export.', 'success');
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={4} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Proyecto Completado</h1>
                    <p className="text-gray-600">De problema de negocio a solución lista para desarrollo</p>
                </div>

                <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Flujo AI-First completado</h2>
                    <div className="space-y-4">
                        {[
                            { n: 1, t: 'Entendimiento', d: 'Contexto estructurado del problema por el UX Agent' },
                            { n: 2, t: 'Ideación', d: '3 propuestas de solución generadas con impacto estimado' },
                            { n: 3, t: 'Prototipado', d: 'Wireframe navegable en baja fidelidad (6 pantallas)' },
                            { n: 4, t: 'Handoff', d: 'Documentación completa en Confluence + Diseño en Figma' },
                        ].map((row) => (
                            <div key={row.n} className="flex items-center">
                                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-4 shrink-0">
                                    {row.n}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900">{row.t}</p>
                                    <p className="text-sm text-gray-700">{row.d}</p>
                                </div>
                                <svg className="w-6 h-6 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="text-center">
                        <div className="text-4xl font-bold text-purple-600 mb-2">70%</div>
                        <p className="text-sm text-gray-600">
                            Reducción de tiempo
                            <br />
                            en documentación
                        </p>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-bold text-purple-600 mb-2">3x</div>
                        <p className="text-sm text-gray-600">
                            Más soluciones
                            <br />
                            exploradas
                        </p>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-bold text-purple-600 mb-2">100%</div>
                        <p className="text-sm text-gray-600">
                            Contexto estructurado
                            <br />y trazable
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Beneficios del flujo AI-First</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            ['Mayor velocidad', 'Exploración y prototipado 3x más rápido'],
                            ['Mejor análisis', 'Contexto estructurado del problema'],
                            ['Menos trabajo manual', 'Documentación generada automáticamente'],
                            ['Handoff claro', 'Dev recibe especificación completa'],
                        ].map(([title, desc]) => (
                            <div key={title} className="flex items-start">
                                <svg className="w-6 h-6 text-green-600 mr-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <div>
                                    <p className="font-medium text-gray-900">{title}</p>
                                    <p className="text-sm text-gray-600">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-4">
                    <button
                        type="button"
                        onClick={startNew}
                        className="flex-1 border border-gray-300 rounded-lg px-6 py-3 font-semibold hover:bg-gray-50 transition-all ux-focus"
                    >
                        Comenzar nueva iniciativa
                    </button>
                    <button
                        type="button"
                        onClick={exportSummary}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus"
                    >
                        Exportar resumen del proyecto
                    </button>
                </div>

                <p className="mt-6 text-center">
                    <Link to="/handoff" className="text-sm text-purple-600 hover:underline">
                        ← Volver al handoff
                    </Link>
                </p>
            </div>
        </main>
    );
}
