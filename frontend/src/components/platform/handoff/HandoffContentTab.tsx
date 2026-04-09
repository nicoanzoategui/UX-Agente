import type { PrototypeScreenSpec } from '../../../lib/workflowSession';

export default function HandoffContentTab({
    initiativeName,
    prototypeScreens,
    flowSteps,
}: {
    initiativeName: string;
    prototypeScreens?: PrototypeScreenSpec[] | null;
    flowSteps: string[];
}) {
    const contentScreens: PrototypeScreenSpec[] = (() => {
        if (prototypeScreens && prototypeScreens.length === 6) {
            return prototypeScreens;
        }
        const pad: PrototypeScreenSpec[] = flowSteps.slice(0, 6).map((step, i) => ({
            title: `Paso ${i + 1}`,
            subtitle: step,
            bullets: [],
            cta: 'Continuar',
        }));
        while (pad.length < 6) {
            const n = pad.length + 1;
            pad.push({
                title: `Pantalla ${n}`,
                subtitle: 'Definir copy y estados en diseño detallado.',
                bullets: [],
                cta: 'Continuar',
            });
        }
        return pad;
    })();

    return (
        <div className="doc-content p-6 max-h-[600px] overflow-y-auto bg-white">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-purple-600">Contenido de cada pantalla</h3>
            <p className="text-gray-600 mb-6">
                Textos guía del prototipo generado para <strong>{initiativeName}</strong>. Ajustá tono y microcopy con el manual de
                marca.
            </p>

            <div className="space-y-8">
                {contentScreens.map((s, i) => (
                    <div
                        key={i}
                        className={`border-l-4 p-5 rounded-r-lg ${
                            i % 3 === 0
                                ? 'border-purple-600 bg-purple-50'
                                : i % 3 === 1
                                  ? 'border-blue-600 bg-blue-50'
                                  : 'border-green-600 bg-green-50'
                        }`}
                    >
                        <h4 className="text-lg font-bold text-gray-900 mb-4">
                            Pantalla {i + 1}: {s.title}
                        </h4>
                        <div className="space-y-3 text-sm">
                            {s.subtitle ? (
                                <div className="bg-white rounded p-3">
                                    <p className="text-xs text-gray-500 mb-1">Texto principal / contexto</p>
                                    <p className="text-gray-900 whitespace-pre-wrap">{s.subtitle}</p>
                                </div>
                            ) : null}
                            {s.bullets && s.bullets.length > 0 ? (
                                <div className="bg-white rounded p-3">
                                    <p className="text-xs text-gray-500 mb-1">Lista / viñetas</p>
                                    <ul className="space-y-1 text-gray-800">
                                        {s.bullets.map((b, j) => (
                                            <li key={j}>• {b.replace(/^•\s*/, '')}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                            {s.note ? (
                                <div className="bg-white rounded p-3">
                                    <p className="text-xs text-gray-500 mb-1">Ayuda / aviso</p>
                                    <p className="text-gray-900 whitespace-pre-wrap">{s.note}</p>
                                </div>
                            ) : null}
                            <div className="bg-white rounded p-3">
                                <p className="text-xs text-gray-500 mb-1">CTA sugerido</p>
                                <p className="font-semibold text-purple-600">&quot;{s.cta || 'Continuar'}&quot;</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
