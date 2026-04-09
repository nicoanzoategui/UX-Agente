import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import HandoffAnalyticsTab from '../components/platform/handoff/HandoffAnalyticsTab';
import HandoffComponentsTab from '../components/platform/handoff/HandoffComponentsTab';
import HandoffContentTab from '../components/platform/handoff/HandoffContentTab';
import HandoffScreensTab from '../components/platform/handoff/HandoffScreensTab';
import { getCurrentInitiativeId, setInitiativeCompleted } from '../lib/initiativesSession';
import { loadWorkflow, patchWorkflow } from '../lib/workflowSession';

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
    const wf = loadWorkflow();
    const [tab, setTab] = useState<DocTab>('overview');
    const markedHandoffVisit = useRef(false);

    useEffect(() => {
        document.title = 'Handoff · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        if (markedHandoffVisit.current) return;
        markedHandoffVisit.current = true;
        patchWorkflow({ handoffVisited: true });
    }, []);

    if (
        !wf?.analysis ||
        wf.selectedSolutionIndex == null ||
        !wf.ideationSolutions?.length ||
        !wf.prototypeMeta
    ) {
        return <Navigate to="/prototipado" replace />;
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
    const flujoPrincipal =
        sol.flowSteps.length > 0
            ? sol.flowSteps.join(' → ')
            : 'Bienvenida → Explicación del proceso → Captura DNI → Captura Selfie → Datos personales → Confirmación';

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
            <ProgressBar currentStep={4} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold text-gray-900">4. Handoff Colaborativo</h1>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            ✓ Documentación generada
                        </span>
                    </div>
                    <p className="text-gray-600">El UX Agent ha creado la documentación completa en Confluence</p>
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
                                    <p className="text-gray-700 leading-relaxed mb-3">
                                        Implementación de un onboarding progresivo que prioriza la transparencia y la reducción
                                        de fricción. El usuario es guiado paso a paso con visibilidad total del proceso,
                                        explicaciones contextuales de cada requerimiento, y feedback inmediato de sus
                                        acciones.
                                        {sol.title ? (
                                            <>
                                                {' '}
                                                <span className="font-medium text-gray-900">Solución documentada:</span>{' '}
                                                {sol.title}.
                                            </>
                                        ) : null}
                                    </p>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-blue-900 mb-2">Flujo principal:</p>
                                        <p className="text-sm text-blue-800">{flujoPrincipal}</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Lógica de interacción</h4>
                                    <ul className="space-y-2 text-gray-700">
                                        <li className="flex items-start">
                                            <span className="text-purple-600 mr-2">•</span>
                                            <span>
                                                <strong>Progresividad:</strong> Cada pantalla revela un paso a la vez, evitando
                                                sobrecarga cognitiva
                                            </span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-purple-600 mr-2">•</span>
                                            <span>
                                                <strong>Transparencia:</strong> El usuario siempre sabe en qué paso está,
                                                cuánto falta y por qué se solicita cada dato
                                            </span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-purple-600 mr-2">•</span>
                                            <span>
                                                <strong>Feedback inmediato:</strong> Validación en tiempo real de documentos y
                                                confirmación de acciones completadas
                                            </span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-purple-600 mr-2">•</span>
                                            <span>
                                                <strong>Flujo lineal sin retroceso:</strong> Una vez completado un paso, se
                                                avanza automáticamente al siguiente
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Decisiones clave del flujo</h4>
                                    <div className="space-y-3">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">1. Mostrar tiempo estimado desde el inicio</p>
                                            <p className="text-sm text-gray-600">
                                                Reduce ansiedad y establece expectativas claras sobre la duración del proceso
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">
                                                2. Explicar el &quot;por qué&quot; antes de solicitar información
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Aumenta la confianza del usuario al entender el motivo detrás de cada requerimiento
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">
                                                3. Datos personales pre-rellenados cuando sea posible
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Reduce esfuerzo del usuario aprovechando información extraída del DNI
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">
                                                4. No permitir edición de datos críticos extraídos del DNI
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Evita fraude y asegura integridad de la información validada
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-900 mb-2">Edge cases y estados del sistema</h4>
                                    <div className="space-y-3">
                                        <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">Error en captura de DNI</p>
                                            <p className="text-sm text-gray-700 mb-2">Si el documento no es legible o la foto está borrosa:</p>
                                            <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                                <li>• Mostrar feedback específico del error (ej: &quot;Imagen borrosa&quot;, &quot;Documento cortado&quot;)</li>
                                                <li>• Permitir hasta 3 intentos antes de ofrecer ayuda manual</li>
                                                <li>• Sugerir mejoras en iluminación o posicionamiento</li>
                                            </ul>
                                        </div>
                                        <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">Error en captura de selfie</p>
                                            <p className="text-sm text-gray-700 mb-2">Si el rostro no coincide o la foto no cumple requisitos:</p>
                                            <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                                <li>
                                                    • Indicar específicamente qué está fallando (ej: &quot;Retira los lentes&quot;,
                                                    &quot;Mejora la iluminación&quot;)
                                                </li>
                                                <li>• Permitir hasta 3 intentos antes de escalar a validación manual</li>
                                                <li>• Mostrar ejemplo visual de selfie correcta</li>
                                            </ul>
                                        </div>
                                        <div className="border-l-4 border-red-500 bg-red-50 p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">Usuario abandona el flujo a mitad de proceso</p>
                                            <p className="text-sm text-gray-700 mb-2">Estrategia de recuperación:</p>
                                            <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                                <li>• Guardar progreso automáticamente en cada paso completado</li>
                                                <li>• Enviar email de recordatorio 24hs después del abandono</li>
                                                <li>• Permitir retomar desde el último paso completado</li>
                                                <li>• Eliminar datos guardados después de 7 días de inactividad</li>
                                            </ul>
                                        </div>
                                        <div className="border-l-4 border-blue-500 bg-blue-50 p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">Verificación pendiente (estado asíncrono)</p>
                                            <p className="text-sm text-gray-700 mb-2">Mientras se valida la identidad (puede tomar hasta 24hs):</p>
                                            <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                                <li>• Mostrar pantalla de confirmación con estado &quot;En revisión&quot;</li>
                                                <li>• Permitir acceso limitado a funcionalidades básicas</li>
                                                <li>• Enviar notificación push/email cuando la verificación esté completa</li>
                                                <li>• Desbloquear funcionalidades completas una vez aprobada</li>
                                            </ul>
                                        </div>
                                        <div className="border-l-4 border-red-500 bg-red-50 p-3">
                                            <p className="font-medium text-gray-900 text-sm mb-1">Verificación rechazada</p>
                                            <p className="text-sm text-gray-700 mb-2">Si la validación de identidad es rechazada:</p>
                                            <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                                <li>• Explicar claramente el motivo del rechazo</li>
                                                <li>• Ofrecer opción de reintento con instrucciones específicas</li>
                                                <li>• Proveer canal de soporte para casos especiales</li>
                                                <li>• Después de 3 rechazos, escalar a validación manual con agente</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'screens' && <HandoffScreensTab />}

                    {tab === 'content' && <HandoffContentTab initiativeName={wf.initiativeName} />}

                    {tab === 'components' && <HandoffComponentsTab />}

                    {tab === 'analytics' && <HandoffAnalyticsTab />}
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
                        to="/prototipado"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                    >
                        ← Volver a Prototipado
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
