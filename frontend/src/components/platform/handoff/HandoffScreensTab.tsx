import type { PrototypeScreenSpec } from '../../../lib/workflowSession';

type ScreenRow = { index: number; title: string; objective: string; interaction: string };

function buildRows(
    prototypeScreens: PrototypeScreenSpec[] | undefined | null,
    flowSteps: string[]
): ScreenRow[] {
    if (prototypeScreens && prototypeScreens.length === 6) {
        return prototypeScreens.map((s, i) => ({
            index: i + 1,
            title: s.title || `Pantalla ${i + 1}`,
            objective: s.subtitle || 'Pantalla del flujo prototipado para esta iniciativa.',
            interaction: [s.note, ...(s.bullets || []).map((b) => `• ${b}`)].filter(Boolean).join('\n') || 'Ver detalle en prototipado y en contenido.',
        }));
    }
    const steps = flowSteps.length ? flowSteps : ['Definir paso 1', 'Definir paso 2', 'Definir paso 3', 'Definir paso 4', 'Definir paso 5', 'Definir paso 6'];
    const out: ScreenRow[] = [];
    for (let i = 0; i < 6; i++) {
        const text = steps[i] ?? `Paso ${i + 1} (completar en diseño)`;
        out.push({
            index: i + 1,
            title: `Pantalla ${i + 1}`,
            objective: text,
            interaction: `El usuario avanza en el flujo según este paso: ${text}`,
        });
    }
    return out;
}

export default function HandoffScreensTab({
    prototypeScreens,
    flowSteps,
}: {
    prototypeScreens?: PrototypeScreenSpec[] | null;
    flowSteps: string[];
}) {
    const rows = buildRows(prototypeScreens, flowSteps);

    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">Listado de pantallas</h3>
            <p className="text-gray-600 mb-6">
                Mapa de las 6 pantallas del prototipo de esta iniciativa (generadas a partir del análisis, la solución elegida y la
                iteración).
            </p>

            <div className="space-y-6">
                {rows.map((row, i) => (
                    <div
                        key={row.index}
                        className={`border-2 rounded-lg p-5 ${i === 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900">
                                    Pantalla {row.index}: {row.title}
                                </h4>
                            </div>
                            {i === 0 ? (
                                <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-medium">
                                    Punto de entrada
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                                    Paso {row.index}
                                </span>
                            )}
                        </div>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="font-semibold text-gray-900">Objetivo en el flujo</p>
                                <p className="text-gray-700 whitespace-pre-wrap">{row.objective}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">Interacción / notas</p>
                                <p className="text-gray-700 whitespace-pre-wrap">{row.interaction}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
