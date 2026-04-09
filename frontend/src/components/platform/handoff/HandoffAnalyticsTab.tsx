export default function HandoffAnalyticsTab({
    expectedImpact,
    keyInsights,
    businessObjectives,
}: {
    expectedImpact: string[];
    keyInsights: string[];
    businessObjectives: string[];
}) {
    const sections: { title: string; items: string[]; className: string }[] = [
        {
            title: 'Objetivos de negocio (contexto)',
            items: businessObjectives,
            className: 'border-purple-200 bg-purple-50',
        },
        {
            title: 'Impacto esperado (solución)',
            items: expectedImpact,
            className: 'border-green-200 bg-green-50',
        },
        {
            title: 'Insights para medir / hipótesis',
            items: keyInsights,
            className: 'border-blue-200 bg-blue-50',
        },
    ];

    const hasAny = sections.some((s) => s.items.length > 0);

    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">
                Analytics e hipótesis
            </h3>
            <p className="text-gray-600 mb-6">
                Eventos y métricas concretas las definís con el equipo; esto es un punto de partida alineado al análisis y a la
                solución de esta iniciativa.
            </p>

            {!hasAny ? (
                <p className="text-sm text-gray-600">No hay datos de análisis para mostrar.</p>
            ) : (
                <div className="space-y-6">
                    {sections.map((sec) =>
                        sec.items.length ? (
                            <div key={sec.title} className={`rounded-lg border-2 p-4 ${sec.className}`}>
                                <h4 className="font-semibold text-gray-900 mb-3">{sec.title}</h4>
                                <ul className="space-y-2 text-sm text-gray-800">
                                    {sec.items.map((line, i) => (
                                        <li key={i} className="flex items-start">
                                            <span className="text-purple-600 mr-2 shrink-0">•</span>
                                            <span>{line.replace(/^•\s*/, '')}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs text-gray-600 mt-3">
                                    Sugerencia: traducir cada ítem a eventos (nombre técnico), propiedades y dashboard en tu
                                    herramienta de analytics.
                                </p>
                            </div>
                        ) : null
                    )}
                </div>
            )}
        </div>
    );
}
