import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import {
    buildPrototypeMetaFromGenerateResponse,
    loadWorkflow,
    patchWorkflow,
    type WorkflowSession,
} from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

type ChatTurn = { role: 'user' | 'assistant'; text: string };

const SUGGESTIONS = [
    'En la pantalla 3, agregar un texto de ayuda más claro',
    'Cambiar el CTA de la última pantalla a "Listo"',
    'Reducir textos largos en las viñetas',
    'Agregar un paso de confirmación antes del éxito',
];

export default function PrototypeIterationPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [messages, setMessages] = useState<ChatTurn[]>([]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [busy, setBusy] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const idx = wf?.selectedSolutionIndex;
    const solution = wf && idx != null && idx >= 1 && idx <= 3 ? wf.ideationSolutions?.[idx - 1] : undefined;
    const screens = wf?.prototypeScreens;

    const userTurnCount = useMemo(() => messages.filter((m) => m.role === 'user').length, [messages]);
    const canRegenerate = useMemo(() => {
        if (userTurnCount < 1 || typing || busy || regenerating) return false;
        const last = messages[messages.length - 1];
        return Boolean(last && last.role === 'assistant');
    }, [userTurnCount, typing, busy, regenerating, messages]);

    useEffect(() => {
        document.title = 'Iterar prototipo · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.analysis || w.selectedSolutionIndex == null) {
            navigate('/prototipado', { replace: true });
            return;
        }
        const sol = w.ideationSolutions?.[w.selectedSolutionIndex - 1];
        const sc = w.prototypeScreens;
        if (!sol || !sc || sc.length !== 6) {
            navigate('/prototipado', { replace: true });
            return;
        }
        setWf(w);
        setMessages([
            {
                role: 'assistant',
                text:
                    'Podés pedir cambios en textos, orden de pantallas, CTAs o mensajes de ayuda. ' +
                    'Cuando estés conforme, usá «Regenerar prototipo» para que el agente vuelva a armar las 6 pantallas.',
            },
        ]);
    }, [navigate]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    async function sendMessage(text: string) {
        const t = text.trim();
        if (!t || !wf || !solution || !screens || busy || regenerating) return;
        const analysis = wf.analysis;
        if (!analysis) return;
        const userTurn: ChatTurn = { role: 'user', text: t };
        const history = messages.map((m) => ({ role: m.role, text: m.text }));
        setMessages((prev) => [...prev, userTurn]);
        setInput('');
        setTyping(true);
        setBusy(true);
        try {
            const { reply } = await api.iteratePrototype({
                initiativeName: wf.initiativeName,
                analysis,
                solution,
                screens,
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

    async function regeneratePrototype() {
        if (!wf || !solution || !screens || !wf.analysis || !canRegenerate) return;
        setRegenerating(true);
        try {
            const prototypeIterationMessages = messages.map((m) => ({ role: m.role, text: m.text }));
            const { summaryLine, screens: nextScreens, estimatedTimeLabel, flowType } = await api.generatePrototypeScreens({
                initiativeName: wf.initiativeName,
                jiraTicket: wf.jiraTicket,
                squad: wf.squad,
                analysis: wf.analysis,
                solution,
                iterationMessages: [],
                existingScreens: screens,
                prototypeIterationMessages,
            });
            patchWorkflow({
                prototypeMeta: buildPrototypeMetaFromGenerateResponse(solution, {
                    summaryLine,
                    screens: nextScreens,
                    estimatedTimeLabel,
                    flowType,
                }),
                prototypeScreens: nextScreens,
            });
            toast('Prototipo actualizado con tus cambios.', 'success');
            navigate('/prototipado');
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'No se pudo regenerar el prototipo.';
            toast(msg, 'error');
        } finally {
            setRegenerating(false);
        }
    }

    if (!wf || !solution || !screens || screens.length !== 6) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">
                Cargando…
            </div>
        );
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 relative">
            <ProgressBar currentStep={3} />

            {regenerating ? (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[400] p-4">
                    <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-xl">
                        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Regenerando prototipo…</h3>
                        <p className="text-gray-600 text-sm">Aplicando la conversación a las 6 pantallas.</p>
                    </div>
                </div>
            ) : null}

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <div className="flex items-center mb-4">
                        <Link
                            to="/prototipado"
                            className="text-purple-600 hover:text-purple-700 mr-4 ux-focus p-1 rounded-lg"
                            aria-label="Volver"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Iterar prototipo</h1>
                    </div>
                    <p className="text-gray-600">
                        Conversá con el agente sobre las 6 pantallas; luego regenerá el wireframe con un solo clic.
                    </p>
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
                                <p className="text-xs text-gray-500">Enfocado en tus pantallas</p>
                            </div>
                        </div>
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

                        {messages.length === 1 ? (
                            <div className="mb-4">
                                <p className="text-xs text-gray-500 mb-2 ml-11">Sugerencias:</p>
                                <div className="ml-11 space-y-2">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            disabled={busy || regenerating}
                                            onClick={() => void sendMessage(s)}
                                            className="block w-full text-left px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-sm text-gray-900 transition-all ux-focus disabled:opacity-50"
                                        >
                                            &quot;{s}&quot;
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {typing ? (
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
                        ) : null}
                        <div ref={bottomRef} />
                    </div>

                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                        <form id="proto-chat-form" onSubmit={onSubmit} className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Qué querés cambiar en el prototipo…"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                disabled={busy || regenerating}
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                form="proto-chat-form"
                                disabled={busy || regenerating || !input.trim()}
                                className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus disabled:opacity-50"
                            >
                                Enviar
                            </button>
                        </form>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/prototipado"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all text-center text-gray-900 ux-focus"
                    >
                        ← Volver al prototipo
                    </Link>
                    <button
                        type="button"
                        disabled={!canRegenerate || regenerating}
                        title={
                            !canRegenerate
                                ? 'Enviá al menos un mensaje y esperá la respuesta del agente antes de regenerar.'
                                : undefined
                        }
                        onClick={() => void regeneratePrototype()}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {regenerating ? 'Regenerando…' : 'Regenerar prototipo con estos cambios'}
                    </button>
                </div>
                {!canRegenerate && userTurnCount === 0 ? (
                    <p className="text-xs text-gray-500 mt-2 text-center sm:text-right">
                        Escribí qué querés ajustar en las pantallas; después podrás regenerar el prototipo completo.
                    </p>
                ) : null}
            </div>
        </main>
    );
}
