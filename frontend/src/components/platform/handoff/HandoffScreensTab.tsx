/** Tab “Pantallas” — copia estructural de docs/reference/ux-agent-platform_3.html (Confluence). */

export default function HandoffScreensTab() {
    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">Listado de pantallas</h3>
            <p className="text-gray-600 mb-6">
                Mapa completo de las 6 pantallas necesarias para implementar la solución, incluyendo flujo de navegación y
                relaciones entre pantallas.
            </p>

            <div className="space-y-6">
                <div className="border-2 border-purple-200 rounded-lg p-5 bg-purple-50">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">Pantalla 1: Bienvenida</h4>
                            <p className="text-sm text-purple-700">screen_welcome.dart / WelcomeScreen.jsx</p>
                        </div>
                        <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-medium">
                            Punto de entrada
                        </span>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="font-semibold text-gray-900">Objetivo dentro del flujo:</p>
                            <p className="text-gray-700">
                                Generar confianza y establecer expectativas claras sobre el proceso de registro. Debe reducir
                                la ansiedad del usuario mostrando que el proceso es rápido (2 min) y seguro.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Descripción de la interacción:</p>
                            <p className="text-gray-700">
                                Pantalla estática informativa. El usuario lee los beneficios del proceso y hace click en el
                                CTA &quot;Comenzar&quot; para avanzar.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Entrada:</p>
                            <p className="text-gray-700">• Usuario accede desde el home después de registrarse con email/contraseña</p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Salida:</p>
                            <p className="text-gray-700">
                                • Click en &quot;Comenzar&quot; → Navega a Pantalla 2 (Contexto de validación)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-2 border-purple-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">Pantalla 2: Contexto de validación</h4>
                            <p className="text-sm text-gray-600">screen_validation_context.dart / ValidationContextScreen.jsx</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">Paso 1 de 4</span>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="font-semibold text-gray-900">Objetivo dentro del flujo:</p>
                            <p className="text-gray-700">
                                Explicar por qué se solicita la validación de identidad (compliance, seguridad) y descomponer el
                                proceso en 3 pasos concretos. Reducir la percepción de que la validación es una
                                &quot;barrera&quot;.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Descripción de la interacción:</p>
                            <p className="text-gray-700">
                                Pantalla informativa con barra de progreso (25%). Muestra un breakdown de los 3 pasos siguientes
                                con tiempo estimado por cada uno. El usuario lee y hace click en &quot;Continuar&quot;.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla anterior:</p>
                            <p className="text-gray-700">
                                • Viene desde Pantalla 1 (Bienvenida) al hacer click en &quot;Comenzar&quot;
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla siguiente:</p>
                            <p className="text-gray-700">
                                • Click en &quot;Continuar&quot; → Navega a Pantalla 3 (Captura DNI)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-2 border-purple-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">Pantalla 3: Captura de DNI</h4>
                            <p className="text-sm text-gray-600">screen_dni_capture.dart / DNICaptureScreen.jsx</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">Paso 2 de 4</span>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="font-semibold text-gray-900">Objetivo dentro del flujo:</p>
                            <p className="text-gray-700">
                                Capturar imagen del DNI del usuario con calidad suficiente para extraer datos (OCR). Debe guiar
                                al usuario para obtener una buena foto en el primer intento.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Descripción de la interacción:</p>
                            <p className="text-gray-700">
                                Pantalla con acceso a cámara. Muestra overlay con guías visuales para posicionar el DNI. Al
                                tocar el área de captura, abre la cámara nativa. Una vez capturada, valida automáticamente la
                                calidad. Si es exitosa, extrae datos y avanza. Si falla, muestra error específico y permite
                                reintentar.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla anterior:</p>
                            <p className="text-gray-700">
                                • Viene desde Pantalla 2 (Contexto) al hacer click en &quot;Continuar&quot;
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla siguiente:</p>
                            <p className="text-gray-700">
                                • Captura exitosa → Extrae datos automáticamente → Navega a Pantalla 4 (Captura Selfie)
                            </p>
                            <p className="text-gray-700">
                                • Después de 3 intentos fallidos → Muestra opción de &quot;Ayuda&quot; o validación manual
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-2 border-purple-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">Pantalla 4: Captura de Selfie</h4>
                            <p className="text-sm text-gray-600">screen_selfie_capture.dart / SelfieCaptureScreen.jsx</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">Paso 3 de 4</span>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="font-semibold text-gray-900">Objetivo dentro del flujo:</p>
                            <p className="text-gray-700">
                                Capturar foto del rostro del usuario para validar que coincide con el DNI. Debe dar instrucciones
                                claras para obtener una selfie válida (sin lentes, buena iluminación, rostro centrado).
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Descripción de la interacción:</p>
                            <p className="text-gray-700">
                                Pantalla con acceso a cámara frontal. Muestra overlay circular para posicionar el rostro.
                                Incluye checklist de requisitos. Al tocar &quot;Tomar selfie&quot;, captura la foto y valida
                                automáticamente (detección facial, calidad de imagen). Si es exitosa, avanza. Si falla, muestra
                                error específico y permite reintentar.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla anterior:</p>
                            <p className="text-gray-700">
                                • Viene desde Pantalla 3 (Captura DNI) después de validación exitosa del documento
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla siguiente:</p>
                            <p className="text-gray-700">• Captura exitosa → Navega a Pantalla 5 (Datos personales)</p>
                            <p className="text-gray-700">
                                • Después de 3 intentos fallidos → Muestra opción de &quot;Ayuda&quot; o validación manual
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-2 border-purple-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">Pantalla 5: Datos personales</h4>
                            <p className="text-sm text-gray-600">screen_personal_data.dart / PersonalDataScreen.jsx</p>
                        </div>
                        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">Paso 4 de 4</span>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="font-semibold text-gray-900">Objetivo dentro del flujo:</p>
                            <p className="text-gray-700">
                                Permitir al usuario confirmar y completar su información personal. Los datos extraídos del DNI
                                ya están pre-rellenados (nombre, DNI) pero algunos campos requieren input adicional (fecha de
                                nacimiento, teléfono).
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Descripción de la interacción:</p>
                            <p className="text-gray-700">
                                Formulario con campos pre-rellenados (readonly) y campos editables. El usuario completa los
                                campos faltantes y hace click en &quot;Finalizar registro&quot;. Se validan los inputs antes de
                                permitir envío. Si hay errores, se muestran inline debajo de cada campo.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla anterior:</p>
                            <p className="text-gray-700">
                                • Viene desde Pantalla 4 (Captura Selfie) después de validación exitosa del rostro
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla siguiente:</p>
                            <p className="text-gray-700">
                                • Click en &quot;Finalizar registro&quot; con validación exitosa → Envía datos al backend →
                                Navega a Pantalla 6 (Confirmación)
                            </p>
                            <p className="text-gray-700">
                                • Si hay errores de validación → Permanece en la misma pantalla mostrando errores
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-2 border-green-200 rounded-lg p-5 bg-green-50">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">Pantalla 6: Confirmación</h4>
                            <p className="text-sm text-green-700">screen_confirmation.dart / ConfirmationScreen.jsx</p>
                        </div>
                        <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-medium">Estado final</span>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="font-semibold text-gray-900">Objetivo dentro del flujo:</p>
                            <p className="text-gray-700">
                                Confirmar que el proceso de onboarding fue exitoso y establecer expectativas sobre el proceso de
                                verificación asíncrono (puede tomar hasta 24hs). Debe celebrar el éxito y dar tranquilidad
                                sobre los próximos pasos.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Descripción de la interacción:</p>
                            <p className="text-gray-700">
                                Pantalla de éxito con mensaje de confirmación y timeline de próximos pasos. El usuario lee la
                                información y hace click en &quot;Ir al inicio&quot; para acceder a la app con funcionalidades
                                limitadas mientras se verifica su identidad.
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla anterior:</p>
                            <p className="text-gray-700">
                                • Viene desde Pantalla 5 (Datos personales) después de envío exitoso al backend
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Relación con pantalla siguiente:</p>
                            <p className="text-gray-700">
                                • Click en &quot;Ir al inicio&quot; → Navega al home de la aplicación (fuera del flujo de
                                onboarding)
                            </p>
                            <p className="text-gray-700">
                                • El usuario recibirá notificación cuando su verificación esté completa (proceso asíncrono)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Diagrama de flujo</h4>
                <p className="text-sm text-blue-800">
                    Pantalla 1 → Pantalla 2 → Pantalla 3 → [retry o error] → Pantalla 4 → [retry o error] → Pantalla 5 →
                    [validación] → Pantalla 6 → Home
                </p>
            </div>
        </div>
    );
}
