import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { PROTOTYPE_SCREEN_COUNT, PrototypeScreen } from '../components/platform/prototype/PrototypeScreens';
import { useToast } from '../context/ToastContext';
import { loadWorkflow } from '../lib/workflowSession';

export default function PrototipadoPage() {
    const toast = useToast();
    const [screen, setScreen] = useState(0);
    const wf = loadWorkflow();

    useEffect(() => {
        document.title = 'Prototipado · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    if (!wf?.prototypeMeta || wf.selectedSolutionIndex == null) {
        return <Navigate to="/ideacion" replace />;
    }

    const brand = wf.initiativeName.trim() || 'FinanceApp';
    const meta = wf.prototypeMeta;

    function next() {
        setScreen((s) => Math.min(s + 1, PROTOTYPE_SCREEN_COUNT - 1));
    }
    function prev() {
        setScreen((s) => Math.max(s - 1, 0));
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={3} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h1 className="text-3xl font-bold text-gray-900">3. Prototipado</h1>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium w-fit">
                            ✓ Generado
                        </span>
                    </div>
                    <p className="text-gray-600">
                        {wf.prototypeScreens?.length === 6
                            ? 'Prototipo generado a partir de la solución elegida y la iteración con el agente.'
                            : 'El UX Agent ha creado un wireframe navegable en baja fidelidad'}
                    </p>
                </div>

                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <svg
                            className="w-5 h-5 text-purple-600 mr-3 mt-0.5 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden
                        >
                            <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-purple-900">Solución seleccionada</p>
                            <p className="text-sm text-purple-800 mt-1">{meta.summaryLine}</p>
                        </div>
                    </div>
                </div>

                <div className="border-2 border-gray-300 rounded-lg overflow-hidden mb-6">
                    <div className="bg-gray-100 p-8">
                        <div className="max-w-md mx-auto bg-white rounded-lg shadow-xl">
                            <div className="border-8 border-gray-800 rounded-[2rem] overflow-hidden">
                                <div className="bg-white h-[600px] overflow-y-auto">
                                    <PrototypeScreen
                                        index={screen}
                                        brand={brand}
                                        onNext={next}
                                        customScreens={wf.prototypeScreens}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 text-white p-4">
                        <div className="flex items-center justify-between max-w-md mx-auto">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm">
                                    Pantalla <span>{screen + 1}</span> de {PROTOTYPE_SCREEN_COUNT}
                                </span>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    type="button"
                                    onClick={prev}
                                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 ux-focus"
                                >
                                    ←
                                </button>
                                <button
                                    type="button"
                                    onClick={next}
                                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 ux-focus"
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-900">{meta.screenCount}</p>
                        <p className="text-sm text-gray-600">Pantallas</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-900">{meta.estimatedTimeLabel}</p>
                        <p className="text-sm text-gray-600">Tiempo estimado</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-gray-900">{meta.flowType}</p>
                        <p className="text-sm text-gray-600">Tipo de flujo</p>
                    </div>
                </div>

                <div className="pt-6 flex flex-col lg:flex-row gap-4">
                    <Link
                        to="/ideacion"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                    >
                        ← Volver a Ideación
                    </Link>
                    <button
                        type="button"
                        onClick={() =>
                            toast(
                                'La iteración guiada del prototipo estará disponible en una próxima versión.',
                                'success'
                            )
                        }
                        className="px-6 py-3 border border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all ux-focus"
                    >
                        ✨ Iterar prototipo
                    </button>
                    <Link
                        to="/handoff"
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all text-center ux-focus"
                    >
                        Aprobar y continuar a Handoff →
                    </Link>
                </div>
            </div>
        </main>
    );
}
