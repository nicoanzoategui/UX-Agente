/** Tab “Componentes” — alineado a docs/reference/ux-agent-platform_3.html (Flowbite) */

function CompCard({
    title,
    source,
    usage,
}: {
    title: string;
    source: string;
    usage: string;
}) {
    return (
        <div className="bg-gray-50 rounded p-3">
            <p className="font-medium text-sm text-gray-900">{title}</p>
            <p className="text-xs text-gray-600">{source}</p>
            <p className="text-xs text-gray-500 mt-1">{usage}</p>
        </div>
    );
}

export default function HandoffComponentsTab() {
    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">
                Componentes sugeridos (Flowbite)
            </h3>
            <p className="text-gray-600 mb-6">
                Listado de componentes del design system recomendados para implementar cada pantalla. Esto facilita la
                construcción del diseño final y asegura consistencia.
            </p>

            <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                    <h4 className="font-bold text-gray-900 mb-3">Componentes globales (todas las pantallas)</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-sm text-gray-900 mb-1">Progress Bar</p>
                            <p className="text-xs text-gray-600">Flowbite &gt; Components &gt; Progress</p>
                            <p className="text-xs text-gray-500 mt-1">Uso: Mostrar avance del flujo (25%, 50%, 75%, 90%)</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-sm text-gray-900 mb-1">Button Primary</p>
                            <p className="text-xs text-gray-600">Flowbite &gt; Components &gt; Buttons &gt; Primary</p>
                            <p className="text-xs text-gray-500 mt-1">Uso: CTAs principales en cada pantalla</p>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Pantalla 1: Bienvenida</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <CompCard title="Icon" source="Heroicons > User Circle" usage="64x64px, color: purple-600" />
                        <CompCard title="List with Icons" source="Flowbite > Components > List" usage="Para mostrar los 3 beneficios" />
                        <CompCard title="Badge/Pill" source="Flowbite > Components > Badge" usage='Opcional para destacar "2 minutos"' />
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Pantalla 2: Contexto de validación</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <CompCard
                            title="Alert Info"
                            source="Flowbite > Components > Alerts > Info"
                            usage='Para el mensaje "¿Por qué necesitamos esto?"'
                        />
                        <CompCard title="Stepper Indicator" source="Flowbite > Components > Stepper" usage="Para mostrar los 3 pasos siguientes" />
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Pantalla 3: Captura de DNI</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <CompCard title="File Upload" source="Flowbite > Components > File Input" usage="Variante con preview de imagen" />
                        <CompCard title="Alert Warning" source="Flowbite > Components > Alerts > Warning" usage="Para el tip de iluminación" />
                        <CompCard title="Alert Error" source="Flowbite > Components > Alerts > Danger" usage="Para errores de captura" />
                        <CompCard title="Camera Icon" source="Heroicons > Camera" usage="Para área de captura" />
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Pantalla 4: Captura de Selfie</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <CompCard title="File Upload (Camera)" source="Flowbite > Components > File Input" usage="Con acceso a cámara frontal" />
                        <CompCard title="Checklist" source="Flowbite > Components > List > Checklist" usage="Para requisitos de la selfie" />
                        <CompCard title="User Icon" source="Heroicons > User" usage="Para overlay circular" />
                        <CompCard title="Alert Error" source="Flowbite > Components > Alerts > Danger" usage="Para errores de validación facial" />
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Pantalla 5: Datos personales</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <CompCard title="Input Text" source="Flowbite > Forms > Input > Text" usage="Para nombre y DNI (readonly)" />
                        <CompCard title="Input Date" source="Flowbite > Forms > Input > Date Picker" usage="Para fecha de nacimiento" />
                        <CompCard title="Input Tel" source="Flowbite > Forms > Input > Phone" usage="Para número de teléfono" />
                        <CompCard title="Form Validation" source="Flowbite > Forms > Validation" usage="Estados de error inline" />
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Pantalla 6: Confirmación</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <CompCard title="Success Badge" source="Flowbite > Components > Badge > Success" usage="Icono de éxito circular" />
                        <CompCard title="Alert Info" source="Flowbite > Components > Alerts > Info" usage='Para "Próximos pasos"' />
                        <CompCard title="Check Icon" source="Heroicons > Check Circle" usage="80x80px, color: green-600" />
                    </div>
                </div>
            </div>
        </div>
    );
}
