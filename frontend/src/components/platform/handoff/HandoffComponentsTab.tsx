function CompCard({ title, source, usage }: { title: string; source: string; usage: string }) {
    return (
        <div className="bg-gray-50 rounded p-3 border border-gray-200">
            <p className="font-medium text-sm text-gray-900">{title}</p>
            <p className="text-xs text-gray-600">{source}</p>
            <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{usage}</p>
        </div>
    );
}

export default function HandoffComponentsTab({
    howItSolves,
    opportunities,
}: {
    howItSolves: string[];
    opportunities: string[];
}) {
    const fromSolution = howItSolves.map((t, i) => ({
        title: `Patrón de producto ${i + 1}`,
        source: 'Cómo resuelve la solución elegida',
        usage: t.replace(/^•\s*/, ''),
    }));
    const fromAnalysis = opportunities.slice(0, 8).map((t, i) => ({
        title: `Oportunidad ${i + 1}`,
        source: 'Análisis de contexto',
        usage: t.replace(/^•\s*/, ''),
    }));
    const items = [...fromSolution, ...fromAnalysis];

    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">
                Patrones y piezas sugeridas
            </h3>
            <p className="text-gray-600 mb-6">
                Derivado del análisis y de la solución documentada (no es un inventario fijo de Flowbite: adaptalo a tu design
                system).
            </p>

            {items.length === 0 ? (
                <p className="text-sm text-gray-600">No hay datos suficientes. Revisá que el análisis y la ideación estén completos.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((it, i) => (
                        <CompCard key={`${it.title}-${i}`} title={it.title} source={it.source} usage={it.usage} />
                    ))}
                </div>
            )}
        </div>
    );
}
