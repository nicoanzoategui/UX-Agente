import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { loadWorkflow, patchWorkflow, type PrototypeMeta, type WorkflowSession } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

type ChatTurn = { role: 'user' | 'assistant'; text: string };

const SUGGESTIONS = [
    'Reducir el número de pasos del flujo',
    'Agregar opción de validación manual como alternativa',
    'Hacer el proceso más amigable para adultos mayores',
    'Incluir gamificación para aumentar engagement',
];

function buildPrototypeMetaFromTitle(title: string): PrototypeMeta {
    const short = title.replace(/^Solución\s*\d+\s*:\s*/i, '').trim() || title;
    return {
        screenCount: 6,
        estimatedTimeLabel: '~2min',
        flowType: 'Lineal',
        summaryLine: `${short} • 6 pantallas • Flujo lineal`,
    };
}

export default function SolutionIterationPage() {
    const { solutionIndex } = useParams<{ solutionIndex: string }>();
    const navigate = useNavigate();
    const idx = Number(solutionIndex);
    const num = idx >= 1 && idx <= 3 ? (idx as 1 | 2 | 3) : null;

    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [messages, setMessages] = useState<ChatTurn[]>([]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [busy, setBusy] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const solution = wf?.ideationSolutions && num ? wf.ideationSolutions[num - 1] : null;
    const shortName =
        solution?.title.replace(/^Solución\s*\d+\s*:\s*/i, '').trim() || solution?.title || '';

    useEffect(() => {
        document.title = 'Iterar solución · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        if (!num) {
            navigate('/ideacion', { replace: true });
            return;
        }
        const w = loadWorkflow();
        if (!w?.analysis || !w.ideationSolutions?.[num - 1]) {
            navigate('/ideacion', { replace: true });
            return;
        }
        setWf(w);
        const sol = w.ideationSolutions[num - 1];
        const short = sol.title.replace(/^Solución\s*\d+\s*:\s*/i, '').trim() || sol.title;
        setMessages([
            {
                role: 'assistant',
                text: `Hola! Estoy listo para ayudarte a refinar la solución "${short}".\n\n¿Qué aspecto te gustaría mejorar?`,
            },
        ]);
    }, [num, navigate]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    async function sendMessage(text: string) {
        const t = text.trim();
        if (!t || !wf || !solution || !num || busy) return;
        const analysis = wf.analysis;
        if (!analysis) return;
        const userTurn: ChatTurn = { role: 'user', text: t };
        const history = messages.map((m) => ({ role: m.role, text: m.text }));
        setMessages((prev) => [...prev, userTurn]);
        setInput('');
        setTyping(true);
        setBusy(true);
        try {
            const { reply } = await api.iterateSolution({
                solutionTitle: solution.title,
                initiativeName: wf.initiativeName,
                analysis,
                history,
                userMessage: t,
            });
            setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error al contactar al agente.';
            setMessages((prev) => [...prev, { role: 'assistant', text: `No pude responder: ${msg}` }]);
        } finally {
            setTyping(false);
            setBusy(false);
        }
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        void sendMessage(input);
    }

    async function acceptIterated() {
        if (!wf || !solution || !num) return;
        patchWorkflow({
            selectedSolutionIndex: num,
            prototypeMeta: buildPrototypeMetaFromTitle(solution.title),
        });
        await new Promise((r) => setTimeout(r, 1600));
        navigate('/prototipado');
    }

    if (!wf || !solution || !num) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">
                Cargando…
            </div>
        );
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={2} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <div className="flex items-center mb-4">
                        <Link to="/ideacion" className="text-purple-600 hover:text-purple-700 mr-4 ux-focus p-1 rounded-lg" aria-label="Volver">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Iterar Solución {num}</h1>
                    </div>
                    <p className="text-gray-600">
                        Refina la propuesta &quot;{shortName}&quot; conversando con el UX Agent
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
                            <p className="text-sm font-medium text-purple-900">Solución actual seleccionada</p>
                            <p className="text-sm text-purple-800 mt-1">{shortName}</p>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mr-3">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">UX Agent</p>
                                <p className="text-xs text-gray-500">Listo para iterar</p>
                            </div>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">● En línea</span>
                    </div>

                    <div className="bg-white p-4 h-96 overflow-y-auto">
                        {messages.map((m, i) => (
                            <div key={i} className="mb-4">
                                {m.role === 'assistant' ? (
                                    <div className="flex items-start">
                                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3 shrink-0">
                                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                                />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="bg-gray-100 rounded-lg p-3 inline-block max-w-2xl">
                                                <p className="text-sm text-gray-900 whitespace-pre-wrap">{m.text}</p>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Hace un momento</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-end">
                                        <div className="flex-1 flex justify-end min-w-0">
                                            <div className="bg-purple-600 text-white rounded-lg p-3 inline-block max-w-2xl">
                                                <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center ml-3 shrink-0">
                                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {messages.length === 1 && (
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-2 ml-11">Sugerencias:</p>
                                <div className="ml-11 space-y-2">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void sendMessage(s)}
                                            className="block w-full text-left px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-sm text-gray-900 transition-all ux-focus disabled:opacity-50"
                                        >
                                            &quot;{s}&quot;
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {typing && (
                            <div className="mb-4 flex items-start">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3 shrink-0">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                    </svg>
                                </div>
                                <div className="bg-gray-100 rounded-lg p-3 inline-flex gap-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full pulse-animation" />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full pulse-animation" style={{ animationDelay: '0.2s' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full pulse-animation" style={{ animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                        <form onSubmit={onSubmit} className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe tu sugerencia para iterar la solución..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                disabled={busy}
                            />
                            <button
                                type="submit"
                                disabled={busy || !input.trim()}
                                className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus disabled:opacity-50"
                            >
                                Enviar
                            </button>
                        </form>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start">
                        <svg
                            className="w-5 h-5 text-blue-600 mr-3 mt-0.5 shrink-0"
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
                            <p className="text-sm font-medium text-blue-900">Cómo funciona la iteración</p>
                            <p className="text-sm text-blue-800 mt-1">
                                Conversá con el UX Agent para refinar cualquier aspecto de la solución: flujo, cantidad de pasos,
                                contenido, interacciones, o casos de uso específicos. El agente incorporará tus cambios en la
                                propuesta.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/ideacion"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                    >
                        ← Volver a soluciones
                    </Link>
                    <button
                        type="button"
                        onClick={() => void acceptIterated()}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus"
                    >
                        Aceptar solución iterada
                    </button>
                </div>
            </div>
        </main>
    );
}
