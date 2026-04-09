/** Tab “Contenido” — alineado a docs/reference/ux-agent-platform_3.html */

export default function HandoffContentTab({ initiativeName }: { initiativeName: string }) {
    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">Contenido de cada pantalla</h3>
            <p className="text-gray-600 mb-6">
                Contenido textual completo para cada pantalla, respetando el manual de voz y tono del producto. Incluye
                títulos, textos de ayuda, mensajes de error y confirmación, CTAs, y estados vacíos.
            </p>

            <div className="space-y-8">
                <div className="border-l-4 border-purple-600 bg-purple-50 p-5 rounded-r-lg">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Pantalla 1: Bienvenida</h4>
                    <div className="space-y-3 text-sm">
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Título principal (H1)</p>
                            <p className="font-bold text-gray-900">&quot;Bienvenido a {initiativeName}&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Subtítulo (H2)</p>
                            <p className="text-gray-900">&quot;Completa tu registro en solo 2 minutos&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Beneficios (lista de características)</p>
                            <div className="space-y-2 mt-2">
                                <div>
                                    <p className="font-medium text-gray-900">Seguridad garantizada</p>
                                    <p className="text-gray-600">Tus datos están protegidos</p>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Proceso rápido</p>
                                    <p className="text-gray-600">Sin complicaciones ni demoras</p>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">100% online</p>
                                    <p className="text-gray-600">Sin necesidad de ir a una sucursal</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">CTA (Call to Action)</p>
                            <p className="font-semibold text-purple-600">&quot;Comenzar&quot;</p>
                        </div>
                    </div>
                </div>

                <div className="border-l-4 border-blue-600 bg-blue-50 p-5 rounded-r-lg">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Pantalla 2: Contexto de validación</h4>
                    <div className="space-y-3 text-sm">
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Indicador de progreso</p>
                            <p className="text-gray-900">&quot;Paso 1 de 4&quot; + &quot;25%&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Título principal (H1)</p>
                            <p className="font-bold text-gray-900">&quot;Necesitamos validar tu identidad&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Texto informativo (Alert / Banner)</p>
                            <div className="bg-blue-100 p-2 rounded mt-2">
                                <p className="font-medium text-blue-900 mb-1">¿Por qué necesitamos esto?</p>
                                <p className="text-blue-800">
                                    Por regulaciones financieras, debemos confirmar tu identidad para proteger tu cuenta y
                                    prevenir fraudes.
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Desglose de pasos (lista numerada)</p>
                            <div className="space-y-1 mt-2 text-gray-700">
                                <p>1. Foto de tu documento (30 seg)</p>
                                <p>2. Selfie para verificación (30 seg)</p>
                                <p>3. Datos personales (1 min)</p>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">CTA</p>
                            <p className="font-semibold text-purple-600">&quot;Continuar&quot;</p>
                        </div>
                    </div>
                </div>

                <div className="border-l-4 border-green-600 bg-green-50 p-5 rounded-r-lg">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Pantalla 3: Captura de DNI</h4>
                    <div className="space-y-3 text-sm">
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Indicador de progreso</p>
                            <p className="text-gray-900">&quot;Paso 2 de 4&quot; + &quot;50%&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Título principal (H1)</p>
                            <p className="font-bold text-gray-900">&quot;Foto de tu DNI&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Instrucción</p>
                            <p className="text-gray-900">&quot;Coloca tu documento dentro del recuadro&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Área de captura</p>
                            <p className="text-gray-600 italic">[Overlay con recuadro punteado para guiar posicionamiento]</p>
                            <p className="text-purple-600 mt-1">&quot;Toca para tomar foto&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Texto de ayuda (Tip)</p>
                            <div className="bg-yellow-100 p-2 rounded mt-2">
                                <p className="text-yellow-900">
                                    <strong>Consejo:</strong> Asegúrate de que haya buena iluminación y que todos los datos sean
                                    legibles.
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Mensaje de error (si la captura falla)</p>
                            <div className="space-y-2 mt-2">
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 font-medium">Imagen borrosa</p>
                                    <p className="text-red-800 text-xs">La foto no está clara. Intenta de nuevo con mejor iluminación.</p>
                                </div>
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 font-medium">Documento incompleto</p>
                                    <p className="text-red-800 text-xs">Asegúrate de que todo el documento esté dentro del recuadro.</p>
                                </div>
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 font-medium">No se detectó un documento</p>
                                    <p className="text-red-800 text-xs">Coloca tu DNI frente a la cámara.</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">CTA</p>
                            <p className="font-semibold text-purple-600">&quot;Capturar foto&quot;</p>
                        </div>
                    </div>
                </div>

                <div className="border-l-4 border-orange-600 bg-orange-50 p-5 rounded-r-lg">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Pantalla 4: Captura de Selfie</h4>
                    <div className="space-y-3 text-sm">
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Indicador de progreso</p>
                            <p className="text-gray-900">&quot;Paso 3 de 4&quot; + &quot;75%&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Título principal (H1)</p>
                            <p className="font-bold text-gray-900">&quot;Ahora una selfie&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Instrucción</p>
                            <p className="text-gray-900">&quot;Ubica tu rostro dentro del óvalo&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Área de captura</p>
                            <p className="text-gray-600 italic">[Overlay circular para guiar posicionamiento del rostro]</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Checklist de requisitos</p>
                            <div className="space-y-1 mt-2 text-gray-700">
                                <p>✓ Retira lentes y gorra</p>
                                <p>✓ Busca un lugar bien iluminado</p>
                                <p>✓ Mira directamente a la cámara</p>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Mensajes de error (si la captura falla)</p>
                            <div className="space-y-2 mt-2">
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 font-medium">No se detectó un rostro</p>
                                    <p className="text-red-800 text-xs">Posiciona tu rostro dentro del óvalo y vuelve a intentar.</p>
                                </div>
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 font-medium">Iluminación insuficiente</p>
                                    <p className="text-red-800 text-xs">Muévete a un lugar con mejor luz natural o artificial.</p>
                                </div>
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 font-medium">Retira los lentes</p>
                                    <p className="text-red-800 text-xs">Para una validación correcta, necesitamos ver tu rostro sin lentes.</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">CTA</p>
                            <p className="font-semibold text-purple-600">&quot;Tomar selfie&quot;</p>
                        </div>
                    </div>
                </div>

                <div className="border-l-4 border-indigo-600 bg-indigo-50 p-5 rounded-r-lg">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Pantalla 5: Datos personales</h4>
                    <div className="space-y-3 text-sm">
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Indicador de progreso</p>
                            <p className="text-gray-900">&quot;Paso 4 de 4&quot; + &quot;90%&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Título principal (H1)</p>
                            <p className="font-bold text-gray-900">&quot;Últimos detalles&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Subtítulo</p>
                            <p className="text-gray-900">&quot;Confirma tu información personal&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Labels de campos (formulario)</p>
                            <div className="space-y-2 mt-2">
                                <div>
                                    <p className="font-medium text-gray-700">Nombre completo</p>
                                    <p className="text-xs text-gray-500 italic">[Pre-rellenado, readonly]</p>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-700">DNI</p>
                                    <p className="text-xs text-gray-500 italic">[Pre-rellenado, readonly]</p>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-700">Fecha de nacimiento</p>
                                    <p className="text-xs text-gray-500">Placeholder: &quot;DD/MM/AAAA&quot;</p>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-700">Teléfono</p>
                                    <p className="text-xs text-gray-500">Placeholder: &quot;+54 9 11 1234-5678&quot;</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Mensajes de error de validación</p>
                            <div className="space-y-2 mt-2">
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 text-xs">Campo fecha de nacimiento: &quot;Ingresa una fecha válida&quot;</p>
                                </div>
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 text-xs">Campo teléfono: &quot;El número de teléfono no es válido&quot;</p>
                                </div>
                                <div className="bg-red-100 p-2 rounded">
                                    <p className="text-red-900 text-xs">Validación de edad: &quot;Debes ser mayor de 18 años para continuar&quot;</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">CTA</p>
                            <p className="font-semibold text-purple-600">&quot;Finalizar registro&quot;</p>
                        </div>
                    </div>
                </div>

                <div className="border-l-4 border-teal-600 bg-teal-50 p-5 rounded-r-lg">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Pantalla 6: Confirmación</h4>
                    <div className="space-y-3 text-sm">
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Título principal (H1)</p>
                            <p className="font-bold text-gray-900">&quot;¡Todo listo!&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Subtítulo</p>
                            <p className="text-gray-900">&quot;Tu cuenta está siendo verificada&quot;</p>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">Mensaje informativo (Alert / Card)</p>
                            <div className="bg-blue-100 p-3 rounded mt-2">
                                <p className="font-medium text-blue-900 mb-2">Próximos pasos:</p>
                                <div className="space-y-1 text-blue-800 text-xs">
                                    <p>• Verificaremos tu identidad en las próximas 24 horas</p>
                                    <p>• Te notificaremos por email cuando esté lista</p>
                                    <p>• Podrás comenzar a usar todas las funciones</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded p-3">
                            <p className="text-xs text-gray-500 mb-1">CTA</p>
                            <p className="font-semibold text-purple-600">&quot;Ir al inicio&quot;</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
