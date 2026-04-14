import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import { splitPlatformDelimitedBlocks } from '../lib/platformDelimited';
import { loadWorkflow, patchWorkflow, type WorkflowSession } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

type ChatTurn = { role: 'user' | 'assistant'; text: string };

/**
 * Candado module-scope para deduplicar auto-generación (misma sesión / solución).
 * El efecto añade y quita la clave alrededor de la llamada a la API.
 */
const userFlowAutoGenLocks = new Set<string>();

export default function UserFlowPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [svg, setSvg] = useState('');
    const [messages, setMessages] = useState<ChatTurn[]>([
        {
            role: 'assistant',
            text: 'Estamos generando el diagrama de user flow a partir de tu solución aprobada. Podés charlar con el agente y actualizar el SVG después.',
        },
    ]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [genBusy, setGenBusy] = useState(false);
    const [approveBusy, setApproveBusy] = useState(false);
    const [expandedView, setExpandedView] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const idx = wf?.selectedSolutionIndex;
    const solution = wf && idx != null && idx >= 1 && idx <= 3 ? wf.ideationSolutions?.[idx - 1] : undefined;

    const canApprove = useMemo(
        () => Boolean(svg.trim()) && !genBusy && !busy && !approveBusy,
        [svg, genBusy, busy, approveBusy]
    );

    useEffect(() => {
        document.title = 'User flow · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    /** Al montar: si no hay `userFlowSvg` en sesión, llama a `generateUserFlow` una vez. */
    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.analysis || w.selectedSolutionIndex == null) {
            navigate('/ideacion', { replace: true });
            return;
        }
        const analysis = w.analysis;
        const sol = w.ideationSolutions?.[w.selectedSolutionIndex - 1];
        if (!sol) {
            navigate('/ideacion', { replace: true });
            return;
        }
        setWf(w);
        if (w.userFlowSvg) {
            setSvg(w.userFlowSvg);
            return;
        }
        // Sin SVG en sesión: generación automática al montar (sin botón manual).
        const lockKey = `auto:${w.initiativeName}:${w.selectedSolutionIndex}`;
        setGenBusy(true);
        let cancelled = false;
        void (async () => {
            if (userFlowAutoGenLocks.has(lockKey)) {
                return;
            }
            userFlowAutoGenLocks.add(lockKey);
            try {
                const { svg: next } = await api.generateUserFlow({
                    initiativeName: w.initiativeName,
                    jiraTicket: w.jiraTicket,
                    squad: w.squad,
                    analysis,
                    solution: sol,
                });
                if (cancelled) return;
                setSvg(next);
                patchWorkflow({ userFlowSvg: next });
                setMessages((m) => [
                    ...m,
                    { role: 'assistant', text: 'Listo: generé el diagrama SVG. Revisalo y usá el chat si querés ajustes.' },
                ]);
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof ApiError ? e.message : 'No se pudo generar el user flow.';
                toast(msg, 'error');
                setMessages((m) => [...m, { role: 'assistant', text: `No pude generar el diagrama: ${msg}` }]);
            } finally {
                userFlowAutoGenLocks.delete(lockKey);
                if (!cancelled) setGenBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, busy]);

    async function generateSvg(feedback?: string) {
        if (!wf || !solution || !wf.analysis) return;
        setGenBusy(true);
        try {
            const { svg: next } = await api.generateUserFlow({
                initiativeName: wf.initiativeName,
                jiraTicket: wf.jiraTicket,
                squad: wf.squad,
                analysis: wf.analysis,
                solution,
                feedback: feedback?.trim() || undefined,
                currentSvg: feedback?.trim() && svg.trim() ? svg : undefined,
            });
            setSvg(next);
            patchWorkflow({ userFlowSvg: next });
            toast('Diagrama actualizado.', 'success');
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'No se pudo generar el user flow.';
            toast(msg, 'error');
        } finally {
            setGenBusy(false);
        }
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const t = input.trim();
        if (!t || !wf || !solution || !wf.analysis || busy) return;
        setInput('');
        setMessages((m) => [...m, { role: 'user', text: t }]);
        setBusy(true);
        try {
            if (!svg.trim()) {
                const reply =
                    'Esperá a que termine la primera generación del diagrama, o reintentá recargando la página.';
                setMessages((m) => [...m, { role: 'assistant', text: reply }]);
            } else {
                const { reply } = await api.iterateUserFlowChat({
                    initiativeName: wf.initiativeName,
                    jiraTicket: wf.jiraTicket,
                    squad: wf.squad,
                    analysis: wf.analysis,
                    solution,
                    currentSvg: svg,
                    history: messages.map((x) => ({ role: x.role, text: x.text })),
                    userMessage: t,
                });
                setMessages((m) => [...m, { role: 'assistant', text: reply }]);
            }
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Error en el chat.';
            setMessages((m) => [...m, { role: 'assistant', text: `No pude responder: ${msg}` }]);
        } finally {
            setBusy(false);
        }
    }

    async function applyChatToDiagram() {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        if (!lastUser?.text.trim() || !wf || !solution || !wf.analysis) {
            toast('Escribí primero un mensaje con los cambios que querés en el diagrama.', 'error');
            return;
        }
        await generateSvg(lastUser.text);
        setMessages((m) => [
            ...m,
            { role: 'assistant', text: 'Actualicé el diagrama SVG incorporando tu último mensaje.' },
        ]);
    }

    async function approve() {
        if (!wf || !solution || !wf.analysis || !svg.trim()) return;
        setApproveBusy(true);
        try {
            const { raw } = await api.generateFullFlowHifi({
                initiativeName: wf.initiativeName,
                jiraTicket: wf.jiraTicket,
                squad: wf.squad,
                analysis: wf.analysis,
                solution,
            });
            const parts = splitPlatformDelimitedBlocks(raw, 'SCREEN');
            if (parts.length === 0) {
                throw new Error('No se pudieron leer los bloques ---SCREEN_N--- en la respuesta.');
            }
            patchWorkflow({
                userFlowApproved: true,
                hifiWireframesRaw: raw,
                hifiWireframesHtml: parts,
            });
            toast('User flow aprobado. Los wireframes HiFi ya están listos.', 'success');
            navigate('/wireframes-hifi');
        } catch (e) {
            const msg =
                e instanceof ApiError
                    ? e.message
                    : e instanceof Error
                      ? e.message
                      : 'No se pudieron generar los wireframes HiFi.';
            toast(msg, 'error');
        } finally {
            setApproveBusy(false);
        }
    }

    if (!wf || !solution) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">Cargando…</div>
        );
    }

    if (wf.userFlowApproved) {
        return <Navigate to="/wireframes-hifi" replace />;
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={3} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">3. User flow</h1>
                        <p className="text-gray-600 mt-1">
                            El diagrama se genera automáticamente al entrar. Podés afinarlo con el chat y «Actualizar
                            diagrama».
                        </p>
                    </div>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium w-fit">
                        Post-ideación
                    </span>
                </div>

                <div className="flex flex-wrap gap-3 mb-6">
                    <button
                        type="button"
                        disabled={genBusy || !svg.trim()}
                        onClick={() => void applyChatToDiagram()}
                        className="px-6 py-2 border border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 ux-focus disabled:opacity-50"
                    >
                        Actualizar diagrama (último mensaje)
                    </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden mb-8 bg-gray-50 relative">
                    <div className="bg-white p-4 overflow-auto min-h-[320px] relative">
                        {svg.trim() ? (
                            <div
                                className={`max-w-full [&_svg]:h-auto [&_svg]:max-w-none ${
                                    genBusy ? 'opacity-40 pointer-events-none' : ''
                                }`}
                                dangerouslySetInnerHTML={{ __html: svg }}
                            />
                        ) : !genBusy ? (
                            <p className="text-sm text-gray-500 text-center py-16">No hay diagrama todavía.</p>
                        ) : null}
                        {genBusy ? (
                            <div
                                className={`flex flex-col items-center justify-center text-gray-600 text-sm gap-3 ${
                                    svg.trim() ? 'absolute inset-0 bg-white/70' : 'py-20'
                                }`}
                            >
                                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                {svg.trim() ? 'Actualizando diagrama…' : 'Generando diagrama…'}
                            </div>
                        ) : null}
                    </div>
                    {svg.trim() ? (
                        <button
                            type="button"
                            onClick={() => setExpandedView(true)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-purple-600 text-white rounded-full w-10 h-10 shadow-lg hover:bg-purple-700 ux-focus"
                            aria-label="Expandir diagrama"
                            title="Expandir"
                        >
                            ↗
                        </button>
                    ) : null}
                </div>

                {expandedView ? (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[92vh] flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <p className="font-semibold text-gray-900">User flow expandido</p>
                                <button
                                    type="button"
                                    onClick={() => setExpandedView(false)}
                                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 ux-focus"
                                >
                                    Cerrar
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                                <div
                                    className="inline-block bg-white border border-gray-200 rounded p-3 [&_svg]:h-auto [&_svg]:max-w-none"
                                    dangerouslySetInnerHTML={{ __html: svg }}
                                />
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <p className="font-semibold text-gray-900">Chat con el agente</p>
                        <p className="text-xs text-gray-500">Pedí feedback; para cambiar el SVG usá «Actualizar diagrama».</p>
                    </div>
                    <div className="bg-white p-4 h-72 overflow-y-auto">
                        {messages.map((m, i) => (
                            <div key={i} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-xl rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                        m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-900'
                                    }`}
                                >
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>
                    <form onSubmit={onSubmit} className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Preguntá o describí cambios para el diagrama…"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            disabled={busy || genBusy}
                        />
                        <button
                            type="submit"
                            disabled={busy || genBusy || !input.trim()}
                            className="gradient-bg text-white px-5 py-2 rounded-lg font-semibold ux-focus disabled:opacity-50"
                        >
                            Enviar
                        </button>
                    </form>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                    Al continuar generamos los wireframes HiFi de todas las pantallas; suele tardar uno o dos minutos.
                    En el siguiente paso ya los vas a ver listos.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/ideacion"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 text-center text-gray-900 ux-focus"
                    >
                        ← Volver a ideación
                    </Link>
                    <button
                        type="button"
                        disabled={!canApprove}
                        onClick={() => void approve()}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                    >
                        {approveBusy ? 'Generando wireframes HiFi…' : 'Aprobar user flow y continuar →'}
                    </button>
                </div>
            </div>
        </main>
    );
}
