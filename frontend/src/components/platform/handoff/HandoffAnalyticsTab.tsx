import type { ReactNode } from 'react';

/** Tab “Analytics” — alineado a docs/reference/ux-agent-platform_3.html */

function GlobalEventCard({
    name,
    badge,
    badgeClass,
    description,
    children,
}: {
    name: string;
    badge: string;
    badgeClass: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <div className="bg-white rounded-lg p-3 border border-gray-300">
            <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-gray-900">{name}</p>
                <span className={`px-2 py-1 rounded text-xs ${badgeClass}`}>{badge}</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{description}</p>
            <div className="bg-gray-50 p-2 rounded text-xs">{children}</div>
        </div>
    );
}

function ScreenEventBlock({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">{title}</h4>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function EventRow({ name, lines }: { name: string; lines: string[] }) {
    return (
        <div className="bg-gray-50 rounded p-3 text-sm">
            <p className="font-medium text-gray-900 mb-1">{name}</p>
            {lines.map((line, i) => (
                <p key={i} className="text-gray-600 text-xs">
                    {line}
                </p>
            ))}
        </div>
    );
}

function GoalBox({ text }: { text: string }) {
    return (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
            <p className="font-medium text-blue-900">Objetivo de medición:</p>
            <p className="text-blue-800">{text}</p>
        </div>
    );
}

export default function HandoffAnalyticsTab() {
    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">
                Instrumentación y medición
            </h3>
            <p className="text-gray-600 mb-6">
                Especificación completa de eventos, tagging y métricas para medir el éxito de la solución. Esto permite hacer
                seguimiento del funnel de conversión e identificar oportunidades de mejora.
            </p>

            <div className="space-y-6">
                <div className="bg-purple-50 border-2 border-purple-600 rounded-lg p-5">
                    <h4 className="font-bold text-gray-900 mb-3">Eventos globales del flujo</h4>
                    <div className="space-y-3">
                        <GlobalEventCard
                            name="onboarding_flow_started"
                            badge="Event"
                            badgeClass="bg-blue-100 text-blue-800"
                            description="Se dispara cuando el usuario accede por primera vez al flujo de onboarding"
                        >
                            <p className="font-medium text-gray-900 mb-1">Properties:</p>
                            <p className="text-gray-600">• user_id: string</p>
                            <p className="text-gray-600">• timestamp: datetime</p>
                            <p className="text-gray-600">• source: string (email_signup, social_signup, etc.)</p>
                        </GlobalEventCard>
                        <GlobalEventCard
                            name="onboarding_flow_completed"
                            badge="Conversion Event"
                            badgeClass="bg-green-100 text-green-800"
                            description="Se dispara cuando el usuario completa exitosamente todo el flujo"
                        >
                            <p className="font-medium text-gray-900 mb-1">Properties:</p>
                            <p className="text-gray-600">• user_id: string</p>
                            <p className="text-gray-600">• total_time: number (segundos)</p>
                            <p className="text-gray-600">• retry_count_dni: number</p>
                            <p className="text-gray-600">• retry_count_selfie: number</p>
                        </GlobalEventCard>
                        <GlobalEventCard
                            name="onboarding_flow_abandoned"
                            badge="Drop-off Event"
                            badgeClass="bg-red-100 text-red-800"
                            description="Se dispara cuando el usuario sale del flujo sin completarlo"
                        >
                            <p className="font-medium text-gray-900 mb-1">Properties:</p>
                            <p className="text-gray-600">• user_id: string</p>
                            <p className="text-gray-600">• abandoned_at_screen: string</p>
                            <p className="text-gray-600">• time_spent: number (segundos)</p>
                            <p className="text-gray-600">• progress_percentage: number</p>
                        </GlobalEventCard>
                    </div>
                </div>

                <ScreenEventBlock title="Pantalla 1: Bienvenida">
                    <EventRow name="screen_welcome_viewed" lines={['Disparo: Cuando la pantalla se muestra']} />
                    <EventRow
                        name="cta_comenzar_clicked"
                        lines={['Disparo: Click en botón "Comenzar"', 'Properties: time_on_screen (segundos)']}
                    />
                    <GoalBox text='Tasa de click en CTA "Comenzar" / Tiempo promedio en pantalla' />
                </ScreenEventBlock>

                <ScreenEventBlock title="Pantalla 2: Contexto de validación">
                    <EventRow name="screen_validation_context_viewed" lines={['Disparo: Cuando la pantalla se muestra']} />
                    <EventRow
                        name="info_banner_viewed"
                        lines={['Disparo: Cuando el banner "¿Por qué necesitamos esto?" se hace visible']}
                    />
                    <EventRow name="cta_continuar_clicked" lines={['Disparo: Click en botón "Continuar"']} />
                    <GoalBox text="Drop-off rate en esta pantalla / Engagement con mensaje explicativo" />
                </ScreenEventBlock>

                <ScreenEventBlock title="Pantalla 3: Captura de DNI">
                    <EventRow name="screen_dni_capture_viewed" lines={['Disparo: Cuando la pantalla se muestra']} />
                    <EventRow name="dni_capture_started" lines={['Disparo: Usuario toca el área de captura / abre cámara']} />
                    <EventRow
                        name="dni_capture_success"
                        lines={['Disparo: Foto validada exitosamente', 'Properties: attempt_number, processing_time']}
                    />
                    <EventRow
                        name="dni_capture_error"
                        lines={[
                            'Disparo: Error en validación de foto',
                            'Properties: error_type (blurry, incomplete, not_detected), attempt_number',
                        ]}
                    />
                    <EventRow
                        name="dni_capture_retry"
                        lines={['Disparo: Usuario reintenta captura después de error', 'Properties: retry_number, previous_error_type']}
                    />
                    <GoalBox text="Tasa de éxito en primer intento / Tipos de errores más frecuentes / Promedio de reintentos" />
                </ScreenEventBlock>

                <ScreenEventBlock title="Pantalla 4: Captura de Selfie">
                    <EventRow name="screen_selfie_capture_viewed" lines={['Disparo: Cuando la pantalla se muestra']} />
                    <EventRow
                        name="selfie_capture_started"
                        lines={['Disparo: Usuario toca botón "Tomar selfie" / abre cámara frontal']}
                    />
                    <EventRow
                        name="selfie_capture_success"
                        lines={['Disparo: Selfie validada exitosamente', 'Properties: attempt_number, face_match_score']}
                    />
                    <EventRow
                        name="selfie_capture_error"
                        lines={[
                            'Disparo: Error en validación de selfie',
                            'Properties: error_type (no_face, bad_lighting, glasses_detected), attempt_number',
                        ]}
                    />
                    <EventRow
                        name="selfie_capture_retry"
                        lines={['Disparo: Usuario reintenta captura después de error', 'Properties: retry_number, previous_error_type']}
                    />
                    <GoalBox text="Tasa de éxito en primer intento / Errores más comunes / Impacto de instrucciones visuales" />
                </ScreenEventBlock>

                <ScreenEventBlock title="Pantalla 5: Datos personales">
                    <EventRow name="screen_personal_data_viewed" lines={['Disparo: Cuando la pantalla se muestra']} />
                    <EventRow
                        name="form_field_focused"
                        lines={['Disparo: Usuario hace foco en un campo del formulario', 'Properties: field_name']}
                    />
                    <EventRow
                        name="form_validation_error"
                        lines={['Disparo: Error de validación en un campo', 'Properties: field_name, error_type']}
                    />
                    <EventRow name="cta_finalizar_clicked" lines={['Disparo: Click en botón "Finalizar registro"']} />
                    <EventRow
                        name="form_submission_success"
                        lines={['Disparo: Datos enviados exitosamente al backend', 'Properties: time_spent_on_form']}
                    />
                    <GoalBox text="Campos con mayor tasa de error / Tiempo promedio en formulario / Drop-off en validación" />
                </ScreenEventBlock>

                <ScreenEventBlock title="Pantalla 6: Confirmación">
                    <EventRow name="screen_confirmation_viewed" lines={['Disparo: Cuando la pantalla se muestra']} />
                    <EventRow name="cta_ir_inicio_clicked" lines={['Disparo: Click en botón "Ir al inicio"']} />
                    <GoalBox text="Tiempo en pantalla de confirmación / Tasa de navegación al home" />
                </ScreenEventBlock>

                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-5">
                    <h4 className="font-bold text-gray-900 mb-3">Métricas del funnel completo</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-1">Conversion Rate</p>
                            <p className="text-xs text-gray-600">onboarding_completed / onboarding_started</p>
                            <p className="text-xs text-purple-600 mt-1">Objetivo: 70%</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-1">Time to Complete</p>
                            <p className="text-xs text-gray-600">Promedio de tiempo total del flujo</p>
                            <p className="text-xs text-purple-600 mt-1">Objetivo: ~2 minutos</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-1">Drop-off by Screen</p>
                            <p className="text-xs text-gray-600">% de abandono en cada pantalla</p>
                            <p className="text-xs text-gray-500 mt-1">Identificar cuellos de botella</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-1">Error Rate</p>
                            <p className="text-xs text-gray-600">Capturas fallidas DNI y Selfie</p>
                            <p className="text-xs text-gray-500 mt-1">Optimizar UX de captura</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-1">Retry Rate</p>
                            <p className="text-xs text-gray-600">Promedio de reintentos por usuario</p>
                            <p className="text-xs text-gray-500 mt-1">Indicador de fricción</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-1">Verification Approval Rate</p>
                            <p className="text-xs text-gray-600">% de verificaciones aprobadas post-flujo</p>
                            <p className="text-xs text-gray-500 mt-1">Calidad de datos capturados</p>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-900 mb-2">Recomendación de dashboard</h4>
                    <p className="text-sm text-yellow-800">Crear dashboard en Amplitude/Mixpanel con visualización de:</p>
                    <ul className="text-sm text-yellow-800 mt-2 space-y-1">
                        <li>• Funnel de conversión por pantalla (visualización de cascada)</li>
                        <li>• Tiempo promedio por step con distribución percentil (P50, P75, P90)</li>
                        <li>• Heatmap de errores por tipo y pantalla</li>
                        <li>• Cohort analysis: comparar performance antes/después del lanzamiento</li>
                        <li>• Segmentación por device (iOS vs Android) y versión de app</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
