import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import { splitPlatformDelimitedBlocks } from '../lib/platformDelimited';
import { loadWorkflow, patchWorkflow, type WorkflowSession } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

export default function WireframesHiFiPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [screen, setScreen] = useState(0);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');

    const idx = wf?.selectedSolutionIndex;
    const solution = wf && idx != null && idx >= 1 && idx <= 3 ? wf.ideationSolutions?.[idx - 1] : undefined;
    const hifi = wf?.hifiWireframesHtml;

    useEffect(() => {
        document.title = 'Wireframes HiFi · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.userFlowApproved) {
            navigate('/user-flow', { replace: true });
            return;
        }
        setWf(w);
    }, [navigate]);

    useEffect(() => {
        if (!wf?.userFlowApproved || !wf.analysis) return;
        const analysis = wf.analysis;
        const solIdx = wf.selectedSolutionIndex;
        const sol =
            solIdx != null && solIdx >= 1 && solIdx <= 3 ? wf.ideationSolutions?.[solIdx - 1] : undefined;
        if (!sol) return;
        if ((wf.hifiWireframesHtml?.length ?? 0) > 0) return;

        let cancelled = false;
        void (async () => {
            setBusy(true);
            try {
                const { raw } = await api.generateFullFlowHifi({
                    initiativeName: wf.initiativeName,
                    jiraTicket: wf.jiraTicket,
                    squad: wf.squad,
                    analysis,
                    solution: sol,
                });
                if (cancelled) return;
                const parts = splitPlatformDelimitedBlocks(raw, 'SCREEN');
                if (parts.length === 0) {
                    throw new Error('No se pudieron leer los bloques ---SCREEN_N---.');
                }
                patchWorkflow({ hifiWireframesRaw: raw, hifiWireframesHtml: parts });
                setWf(loadWorkflow());
                toast(`Se generaron ${parts.length} wireframe(s) HiFi.`, 'success');
            } catch (e) {
                if (cancelled) return;
                const msg = e instanceof ApiError ? e.message : 'Error al generar wireframes HiFi.';
                toast(msg, 'error');
            } finally {
                if (!cancelled) setBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [wf]);

    useEffect(() => {
        const n = hifi?.length ?? 0;
        if (n > 0) setScreen((s) => Math.min(s, n - 1));
    }, [hifi?.length]);

    async function generate() {
        if (!wf || !solution || !wf.analysis) return;
        setBusy(true);
        try {
            const { raw } = await api.generateFullFlowHifi({
                initiativeName: wf.initiativeName,
                jiraTicket: wf.jiraTicket,
                squad: wf.squad,
                analysis: wf.analysis,
                solution,
                feedback: feedback.trim() || undefined,
            });
            const parts = splitPlatformDelimitedBlocks(raw, 'SCREEN');
            if (parts.length === 0) {
                throw new Error('No se pudieron leer los bloques ---SCREEN_N---.');
            }
            patchWorkflow({ hifiWireframesRaw: raw, hifiWireframesHtml: parts });
            setWf(loadWorkflow());
            setFeedback('');
            toast(`Se generaron ${parts.length} wireframe(s) HiFi.`, 'success');
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error al generar wireframes HiFi.';
            toast(msg, 'error');
        } finally {
            setBusy(false);
        }
    }

    function approve() {
        if (!hifi?.length) {
            toast('Generá los wireframes antes de aprobar.', 'error');
            return;
        }
        patchWorkflow({
            hifiWireframesApproved: true,
            figmaGenerated: false,
            figmaApproved: false,
            tsxFinalScreens: undefined,
            tsxMuiScreens: undefined,
            tsxMuiApproved: false,
        });
        toast('Wireframes HiFi aprobados.', 'success');
        navigate('/figma');
    }

    if (!wf || !solution) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">Cargando…</div>
        );
    }

    if (wf.hifiWireframesApproved) {
        return <Navigate to="/figma" replace />;
    }

    const n = hifi?.length ?? 0;

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={4} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">4. Wireframes alta fidelidad</h1>
                        <p className="text-gray-600 mt-1">
                            Pantallas en HTML desktop (estilo tipo MUI v5 vía Tailwind CDN). Suelen generarse al aprobar
                            el user flow; podés regenerarlas acá si querés iterar.
                        </p>
                    </div>
                </div>

                <div className="mb-6 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Feedback opcional para regenerar</label>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                        placeholder="Ej.: más contraste en botones primarios, sidebar en pantalla 2…"
                    />
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void generate()}
                        className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                    >
                        {busy ? 'Generando…' : n ? 'Regenerar wireframes HiFi' : 'Generar wireframes HiFi'}
                    </button>
                </div>

                {n > 0 ? (
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden mb-8">
                        <div className="bg-gray-100 p-4 max-h-[640px] overflow-y-auto">
                            <iframe
                                title={`Wireframe HiFi ${screen + 1}`}
                                className="w-full min-h-[520px] bg-white border border-gray-200 rounded"
                                srcDoc={hifi![screen]}
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>
                        <div className="bg-gray-800 text-white p-4 flex items-center justify-between max-w-4xl mx-auto w-full">
                            <span className="text-sm">
                                Pantalla <span className="font-semibold">{screen + 1}</span> de {n}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setScreen((s) => Math.max(0, s - 1))}
                                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 ux-focus"
                                >
                                    ←
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScreen((s) => Math.min(n - 1, s + 1))}
                                    className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 ux-focus"
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    </div>
                ) : busy ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600 text-sm gap-3 mb-8">
                        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        Generando wireframes HiFi…
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 mb-8">
                        No hay wireframes todavía. Usá «Generar wireframes HiFi» o volvé al paso anterior y aprobá de
                        nuevo el user flow.
                    </p>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/user-flow"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 text-center text-gray-900 ux-focus"
                    >
                        ← Volver a user flow
                    </Link>
                    <button
                        type="button"
                        disabled={!n || busy}
                        onClick={approve}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                    >
                        Aprobar wireframes y continuar a Figma →
                    </button>
                </div>
            </div>
        </main>
    );
}
