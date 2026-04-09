/** Pantallas del mockup móvil (paso 3): contenido generado por el agente o demo fijo. */

import type { PrototypeScreenSpec } from '../../../lib/workflowSession';

type NextProps = {
    brand: string;
    onNext: () => void;
};

export const PROTOTYPE_SCREEN_COUNT = 6;

function DynamicFlowScreen({
    spec,
    onNext,
    brand,
    showBrandHint,
}: {
    spec: PrototypeScreenSpec;
    onNext: () => void;
    brand: string;
    showBrandHint: boolean;
}) {
    const cta = spec.cta?.trim() || 'Continuar';
    return (
        <div className="p-6">
            {showBrandHint ? (
                <p className="text-center text-xs font-medium text-purple-600 mb-3 uppercase tracking-wide">
                    {brand}
                </p>
            ) : null}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{spec.title}</h2>
            {spec.subtitle ? <p className="text-gray-600 mb-4 text-sm sm:text-base">{spec.subtitle}</p> : null}
            {spec.bullets && spec.bullets.length > 0 ? (
                <ul className="space-y-2 mb-6">
                    {spec.bullets.map((b, i) => (
                        <li key={i} className="flex items-start text-sm text-gray-800">
                            <svg
                                className="w-5 h-5 text-green-500 mr-2 shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                aria-hidden
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span>{b.replace(/^•\s*/, '')}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
            {spec.note ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{spec.note}</p>
                </div>
            ) : null}
            <button
                type="button"
                onClick={onNext}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all"
            >
                {cta}
            </button>
        </div>
    );
}

export function PrototypeScreen({
    index,
    brand,
    onNext,
    customScreens,
}: {
    index: number;
    brand: string;
    onNext: () => void;
    /** 6 pantallas alineadas a la solución / iteración (API). */
    customScreens?: PrototypeScreenSpec[] | null;
}) {
    if (customScreens && customScreens.length === PROTOTYPE_SCREEN_COUNT && index >= 0 && index < PROTOTYPE_SCREEN_COUNT) {
        return (
            <DynamicFlowScreen
                spec={customScreens[index]}
                onNext={onNext}
                brand={brand}
                showBrandHint={index === 0}
            />
        );
    }
    switch (index) {
        case 0:
            return <ScreenWelcome brand={brand} onNext={onNext} />;
        case 1:
            return <ScreenValidationContext onNext={onNext} />;
        case 2:
            return <ScreenDni onNext={onNext} />;
        case 3:
            return <ScreenSelfie onNext={onNext} />;
        case 4:
            return <ScreenPersonal onNext={onNext} />;
        case 5:
            return <ScreenSuccess />;
        default:
            return <ScreenWelcome brand={brand} onNext={onNext} />;
    }
}

function ScreenWelcome({ brand, onNext }: NextProps) {
    return (
        <div className="p-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido a {brand}</h2>
                <p className="text-gray-600">Completa tu registro en solo 2 minutos</p>
            </div>
            <div className="space-y-4 mb-8">
                <div className="flex items-start">
                    <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div>
                        <p className="font-medium text-gray-900">Seguridad garantizada</p>
                        <p className="text-sm text-gray-600">Tus datos están protegidos</p>
                    </div>
                </div>
                <div className="flex items-start">
                    <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div>
                        <p className="font-medium text-gray-900">Proceso rápido</p>
                        <p className="text-sm text-gray-600">Sin complicaciones ni demoras</p>
                    </div>
                </div>
                <div className="flex items-start">
                    <svg className="w-6 h-6 text-green-500 mr-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div>
                        <p className="font-medium text-gray-900">100% online</p>
                        <p className="text-sm text-gray-600">Sin necesidad de ir a una sucursal</p>
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={onNext}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all"
            >
                Comenzar
            </button>
        </div>
    );
}

function ScreenValidationContext({ onNext }: { onNext: () => void }) {
    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Paso 1 de 4</span>
                    <span className="text-sm text-gray-500">25%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-purple-600 rounded-full w-1/4" />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Necesitamos validar tu identidad</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div>
                        <p className="text-sm font-medium text-blue-900">¿Por qué necesitamos esto?</p>
                        <p className="text-sm text-blue-800 mt-1">
                            Por regulaciones financieras, debemos confirmar tu identidad para proteger tu cuenta y prevenir
                            fraudes.
                        </p>
                    </div>
                </div>
            </div>
            <div className="space-y-4 mb-8">
                {['Foto de tu documento (30 seg)', 'Selfie para verificación (30 seg)', 'Datos personales (1 min)'].map(
                    (t, i) => (
                        <div key={i} className="flex items-center">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                                <span className="text-purple-600 font-bold">{i + 1}</span>
                            </div>
                            <p className="text-gray-700">{t}</p>
                        </div>
                    )
                )}
            </div>
            <button
                type="button"
                onClick={onNext}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold"
            >
                Continuar
            </button>
        </div>
    );
}

function ScreenDni({ onNext }: { onNext: () => void }) {
    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Paso 2 de 4</span>
                    <span className="text-sm text-gray-500">50%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-purple-600 rounded-full w-1/2" />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Foto de tu DNI</h2>
            <p className="text-gray-600 mb-6">Coloca tu documento dentro del recuadro</p>
            <div className="border-4 border-dashed border-purple-400 rounded-lg aspect-video mb-6 flex items-center justify-center bg-purple-50">
                <div className="text-center">
                    <svg className="w-16 h-16 text-purple-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                    </svg>
                    <p className="text-sm text-purple-600 font-medium">Toca para tomar foto</p>
                </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-yellow-800">
                    <strong>Consejo:</strong> Asegúrate de que haya buena iluminación y que todos los datos sean legibles.
                </p>
            </div>
            <button type="button" onClick={onNext} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold">
                Capturar foto
            </button>
        </div>
    );
}

function ScreenSelfie({ onNext }: { onNext: () => void }) {
    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Paso 3 de 4</span>
                    <span className="text-sm text-gray-500">75%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-purple-600 rounded-full w-3/4" />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ahora una selfie</h2>
            <p className="text-gray-600 mb-6">Ubica tu rostro dentro del óvalo</p>
            <div className="border-4 border-purple-400 rounded-full aspect-square mb-6 flex items-center justify-center bg-purple-50 max-w-xs mx-auto">
                <svg className="w-20 h-20 text-purple-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                </svg>
            </div>
            <div className="space-y-2 mb-6">
                {['Retira lentes y gorra', 'Busca un lugar bien iluminado', 'Mira directamente a la cámara'].map((t, i) => (
                    <div key={i} className="flex items-center text-sm">
                        <svg className="w-5 h-5 text-green-500 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span className="text-gray-700">{t}</span>
                    </div>
                ))}
            </div>
            <button type="button" onClick={onNext} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold">
                Tomar selfie
            </button>
        </div>
    );
}

function ScreenPersonal({ onNext }: { onNext: () => void }) {
    return (
        <div className="p-6">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Paso 4 de 4</span>
                    <span className="text-sm text-gray-500">90%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-purple-600 rounded-full w-[90%]" />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Últimos detalles</h2>
            <p className="text-gray-600 mb-6">Confirma tu información personal</p>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                    <input
                        type="text"
                        value="Juan Pérez"
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                    <input
                        type="text"
                        value="12345678"
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                    <input type="text" placeholder="DD/MM/AAAA" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input type="tel" placeholder="+54 9 11 1234-5678" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
            </div>
            <button type="button" onClick={onNext} className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold">
                Finalizar registro
            </button>
        </div>
    );
}

function ScreenSuccess() {
    return (
        <div className="p-6 text-center">
            <div className="mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Todo listo!</h2>
                <p className="text-gray-600 mb-6">Tu cuenta está siendo verificada</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-medium text-blue-900 mb-2">Próximos pasos:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Verificaremos tu identidad en las próximas 24 horas</li>
                    <li>• Te notificaremos por email cuando esté lista</li>
                    <li>• Podrás comenzar a usar todas las funciones</li>
                </ul>
            </div>
            <button type="button" className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold">
                Ir al inicio
            </button>
        </div>
    );
}
