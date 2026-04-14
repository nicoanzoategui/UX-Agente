import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import { loadWorkflow, patchWorkflow, type WorkflowSession } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

export default function CodigoMuiPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [tab, setTab] = useState(0);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');

    const idx = wf?.selectedSolutionIndex;
    const solution = wf && idx != null && idx >= 1 && idx <= 3 ? wf.ideationSolutions?.[idx - 1] : undefined;
    const hifi = wf?.hifiWireframesHtml;
    const tsxFinal = wf?.tsxFinalScreens;
    const tsxLegacy = wf?.tsxMuiScreens;
    const tsx = (tsxFinal?.length ?? 0) > 0 ? tsxFinal : tsxLegacy;
    const fromFigma = (tsxFinal?.length ?? 0) > 0;

    useEffect(() => {
        document.title = 'Código TSX MUI · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.figmaApproved) {
            navigate('/figma', { replace: true });
            return;
        }
        setWf(w);
    }, [navigate]);

    /** Primera carga: TSX desde Figma (API) con fallback a wireframes HiFi. */
    useEffect(() => {
        if (!wf?.hifiWireframesApproved || !wf.analysis) return;
        const analysis = wf.analysis;
        const solIdx = wf.selectedSolutionIndex;
        const sol =
            solIdx != null && solIdx >= 1 && solIdx <= 3 ? wf.ideationSolutions?.[solIdx - 1] : undefined;
        if (!sol) return;
        const hifiHtml = wf.hifiWireframesHtml ?? [];
        if (hifiHtml.length === 0) return;
        if ((wf.tsxFinalScreens?.length ?? 0) > 0 || (wf.tsxMuiScreens?.length ?? 0) > 0) return;

        setBusy(true);
        let cancelled = false;
        void (async () => {
            const canFigma = Boolean(wf.figmaFileUrl?.trim() && wf.figmaScreensMeta && wf.figmaScreensMeta.length > 0);
            try {
                if (canFigma && wf.figmaFileUrl && wf.figmaScreensMeta) {
                    const { tsxFinalScreens } = await api.generateTsxFromFigma({
                        initiativeName: wf.initiativeName,
                        jiraTicket: wf.jiraTicket,
                        squad: wf.squad,
                        analysis,
                        solution: sol,
                        figmaFileUrl: wf.figmaFileUrl,
                        figmaScreensMeta: wf.figmaScreensMeta,
                        hifiWireframesHtml: hifiHtml,
                    });
                    if (cancelled) return;
                    patchWorkflow({ tsxFinalScreens: tsxFinalScreens, tsxMuiScreens: undefined });
                    setWf(loadWorkflow());
                    toast(`Se generaron ${tsxFinalScreens.length} TSX desde Figma.`, 'success');
                    return;
                }
                const { tsxScreens } = await api.generateTsxMuiScreens({
                    initiativeName: wf.initiativeName,
                    jiraTicket: wf.jiraTicket,
                    squad: wf.squad,
                    analysis,
                    solution: sol,
                    hifiHtmlScreens: hifiHtml,
                });
                if (cancelled) return;
                patchWorkflow({ tsxMuiScreens: tsxScreens, tsxFinalScreens: undefined });
                setWf(loadWorkflow());
                toast(`Se generaron ${tsxScreens.length} TSX desde wireframes (sin metadata Figma).`, 'success');
            } catch (e) {
                if (cancelled) return;
                if (canFigma) {
                    console.warn('TSX desde Figma falló; probando legado wireframes:', e);
                    try {
                        const { tsxScreens } = await api.generateTsxMuiScreens({
                            initiativeName: wf.initiativeName,
                            jiraTicket: wf.jiraTicket,
                            squad: wf.squad,
                            analysis,
                            solution: sol,
                            hifiHtmlScreens: hifiHtml,
                        });
                        if (cancelled) return;
                        patchWorkflow({ tsxMuiScreens: tsxScreens, tsxFinalScreens: undefined });
                        setWf(loadWorkflow());
                        toast(
                            'No se pudo generar desde Figma; se usó TSX desde wireframes HiFi (modo legado).',
                            'success'
                        );
                    } catch (e2) {
                        const msg = e2 instanceof ApiError ? e2.message : 'Error al generar TSX.';
                        toast(msg, 'error');
                    }
                } else {
                    const msg = e instanceof ApiError ? e.message : 'Error al generar TSX.';
                    toast(msg, 'error');
                }
            } finally {
                if (!cancelled) setBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // `toast` estable; incluirlo re-dispararía generación duplicada.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wf]);

    useEffect(() => {
        const n = tsx?.length ?? 0;
        if (n > 0) setTab((t) => Math.min(t, n - 1));
    }, [tsx?.length]);

    async function regenerateWithFeedback() {
        if (!wf || !solution || !wf.analysis || !hifi?.length) return;
        setBusy(true);
        try {
            const canFigma = Boolean(wf.figmaFileUrl?.trim() && wf.figmaScreensMeta && wf.figmaScreensMeta.length > 0);
            if (canFigma && wf.figmaFileUrl && wf.figmaScreensMeta) {
                const { tsxFinalScreens } = await api.generateTsxFromFigma({
                    initiativeName: wf.initiativeName,
                    jiraTicket: wf.jiraTicket,
                    squad: wf.squad,
                    analysis: wf.analysis,
                    solution,
                    figmaFileUrl: wf.figmaFileUrl,
                    figmaScreensMeta: wf.figmaScreensMeta,
                    hifiWireframesHtml: hifi,
                    feedback: feedback.trim() || undefined,
                });
                patchWorkflow({ tsxFinalScreens: tsxFinalScreens, tsxMuiScreens: undefined });
                setWf(loadWorkflow());
                setFeedback('');
                toast(`Se actualizaron ${tsxFinalScreens.length} TSX desde Figma.`, 'success');
                return;
            }
            const { tsxScreens } = await api.generateTsxMuiScreens({
                initiativeName: wf.initiativeName,
                jiraTicket: wf.jiraTicket,
                squad: wf.squad,
                analysis: wf.analysis,
                solution,
                hifiHtmlScreens: hifi,
                feedback: feedback.trim() || undefined,
            });
            patchWorkflow({ tsxMuiScreens: tsxScreens, tsxFinalScreens: undefined });
            setWf(loadWorkflow());
            setFeedback('');
            toast(`Se actualizaron ${tsxScreens.length} archivo(s) TSX (wireframes).`, 'success');
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'Error al generar TSX.';
            toast(msg, 'error');
        } finally {
            setBusy(false);
        }
    }

    function approve() {
        if (!tsx?.length) {
            toast('Generá el código TSX antes de aprobar.', 'error');
            return;
        }
        patchWorkflow({ tsxMuiApproved: true });
        toast('Código TSX aprobado. Podés ir a Handoff.', 'success');
        navigate('/handoff');
    }

    async function copyOne() {
        const code = tsx?.[tab];
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            toast('Copiado al portapapeles.', 'success');
        } catch {
            toast('No se pudo copiar.', 'error');
        }
    }

    if (!wf || !solution) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">Cargando…</div>
        );
    }

    if (wf.tsxMuiApproved) {
        return <Navigate to="/handoff" replace />;
    }

    const n = tsx?.length ?? 0;

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={6} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">6. Código TSX final (MUI v5)</h1>
                    <p className="text-gray-600 mt-1">
                        Prioridad: TSX generado desde Figma (metadata + capturas PNG si el servidor tiene{' '}
                        <code className="text-xs bg-gray-100 px-1 rounded">FIGMA_ACCESS_TOKEN</code>). Si falla, se usa
                        wireframes HiFi como respaldo.
                    </p>
                    {fromFigma ? (
                        <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1 mt-2 inline-block">
                            Fuente actual: Figma
                        </p>
                    ) : n > 0 ? (
                        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 inline-block">
                            Fuente actual: wireframes HiFi (legado / fallback)
                        </p>
                    ) : null}
                </div>

                {n > 0 ? (
                    <div className="mb-6 space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Feedback opcional para regenerar TSX
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                            placeholder="Ej.: usar OutlinedInput en pantalla 2, más espacio entre secciones…"
                        />
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void regenerateWithFeedback()}
                            className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                        >
                            {busy ? 'Generando…' : 'Regenerar TSX con feedback'}
                        </button>
                    </div>
                ) : null}

                {n > 0 ? (
                    <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex flex-wrap gap-2">
                            {tsx!.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setTab(i)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded ${
                                        tab === i
                                            ? 'bg-white text-purple-600 border border-purple-600'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Pantalla {i + 1}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => void copyOne()}
                                className="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white"
                            >
                                Copiar esta pantalla
                            </button>
                        </div>
                        <pre className="p-4 text-xs bg-gray-900 text-gray-100 overflow-x-auto max-h-[480px] overflow-y-auto whitespace-pre-wrap">
                            {tsx![tab]}
                        </pre>
                    </div>
                ) : busy ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-600 text-sm gap-3 mb-8 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        Generando código TSX (Figma o wireframes HiFi)…
                    </div>
                ) : (
                    <div className="mb-8 space-y-3">
                        <p className="text-sm text-gray-500">
                            No se pudo generar el código automáticamente. Reintentá o volvé a Figma / wireframes HiFi.
                        </p>
                        <button
                            type="button"
                            onClick={() => void regenerateWithFeedback()}
                            className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 ux-focus"
                        >
                            Reintentar generación
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/figma"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 text-center text-gray-900 ux-focus"
                    >
                        ← Volver a Figma
                    </Link>
                    <button
                        type="button"
                        disabled={!n || busy}
                        onClick={approve}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                    >
                        Aprobar código y continuar a Handoff →
                    </button>
                </div>
            </div>
        </main>
    );
}
