import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import { loadWorkflow, patchWorkflow, type WorkflowSession } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

const DEFAULT_DS_URL =
    'https://www.figma.com/design/g3NxKp17eb4VXN1BnIFgwF/Simple-Design-System--Community-?node-id=3-5&p=f&t=Gq5BxM6wsB4vlY70-0';
const DEFAULT_DEST_URL =
    'https://www.figma.com/design/Jv8IIPGPeMs9aBEKXwt1sv/Archivo-base?node-id=0-1&p=f&t=1xwxcBW78QqL1VIY-0';

export default function FigmaDesignPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const [wf, setWf] = useState<WorkflowSession | null>(null);
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [designSystemUrl, setDesignSystemUrl] = useState(DEFAULT_DS_URL);
    const [destinationUrl, setDestinationUrl] = useState(DEFAULT_DEST_URL);

    const idx = wf?.selectedSolutionIndex;
    const solution = wf && idx != null && idx >= 1 && idx <= 3 ? wf.ideationSolutions?.[idx - 1] : undefined;

    useEffect(() => {
        document.title = 'Figma · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        const w = loadWorkflow();
        if (!w?.hifiWireframesApproved || !w.hifiWireframesHtml?.length) {
            navigate('/wireframes-hifi', { replace: true });
            return;
        }
        setWf(w);
        setDesignSystemUrl(w.figmaDesignSystemUrl?.trim() || DEFAULT_DS_URL);
        setDestinationUrl(w.figmaDestinationUrl?.trim() || DEFAULT_DEST_URL);
    }, [navigate]);

    async function generateInFigma(opts?: { auto?: boolean }) {
        if (!wf || !solution || !wf.analysis || !wf.hifiWireframesHtml?.length) return;
        const ds = designSystemUrl.trim();
        const dest = destinationUrl.trim();
        if (!ds || !dest) {
            toast('Completá links de Design System y destino en Figma.', 'error');
            return;
        }
        setBusy(true);
        try {
            const result = await api.generateFigmaFromWireframes({
                initiativeName: wf.initiativeName,
                analysis: wf.analysis,
                solution,
                hifiWireframesHtml: wf.hifiWireframesHtml,
                designSystemUrl: ds,
                destinationUrl: dest,
            });
            patchWorkflow({
                figmaDesignSystemUrl: ds,
                figmaDestinationUrl: dest,
                figmaFileUrl: result.figmaFileUrl,
                figmaFileKey: result.figmaFileKey ?? undefined,
                figmaScreensMeta: result.screens,
                figmaGenerationLog: result.logs,
                figmaOrchestrationErrors: result.errors?.length ? result.errors : undefined,
                figmaGenerated: true,
                figmaApproved: false,
            });
            setWf(loadWorkflow());
            setLogs(result.logs);
            if (!opts?.auto) toast('Se preparó el material para Figma.', 'success');
        } catch (e) {
            const msg = e instanceof ApiError ? e.message : 'No se pudo preparar la salida para Figma.';
            toast(msg, 'error');
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        if (!wf || !solution || !wf.analysis || !wf.hifiWireframesHtml?.length) return;
        if (wf.figmaGenerated) return;
        void generateInFigma({ auto: true });
        // Hook intencionalmente una vez por estado de workflow.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wf]);

    function approveAndContinue() {
        if (!wf?.figmaGenerated) {
            toast('Primero generá la salida para Figma.', 'error');
            return;
        }
        patchWorkflow({ figmaApproved: true });
        toast('Paso Figma aprobado.', 'success');
        navigate('/codigo-mui');
    }

    if (!wf || !solution) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-24 text-gray-600 text-sm">Cargando…</div>
        );
    }

    if (wf.figmaApproved) {
        return <Navigate to="/codigo-mui" replace />;
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
            <ProgressBar currentStep={5} />

            <div className="bg-white rounded-lg shadow-sm p-8 fade-in">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">5. Figma (desde wireframes)</h1>
                    <p className="text-gray-600 mt-1">
                        El backend resuelve frames reales vía API REST de Figma cuando configurás{' '}
                        <code className="text-xs bg-gray-100 px-1 rounded">FIGMA_ACCESS_TOKEN</code> en el servidor; si no,
                        quedan nodeId en modo <code className="text-xs bg-gray-100 px-1 rounded">pending:*</code> y el TSX
                        siguiente usa metadata + wireframes HiFi.
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Design System URL</label>
                        <input
                            value={designSystemUrl}
                            onChange={(e) => setDesignSystemUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Archivo destino URL</label>
                        <input
                            value={destinationUrl}
                            onChange={(e) => setDestinationUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void generateInFigma()}
                        className="gradient-bg text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                    >
                        {busy ? 'Procesando…' : 'Regenerar metadata Figma'}
                    </button>
                </div>

                {busy ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-600 text-sm gap-3 mb-6 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        Preparando pantallas para Figma…
                    </div>
                ) : null}

                {wf.figmaGenerated ? (
                    <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <p className="text-sm text-gray-700 mb-2">
                            Archivo destino:{' '}
                            <a
                                href={wf.figmaFileUrl || destinationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-700 underline"
                            >
                                Abrir en Figma
                            </a>
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                            Pantallas detectadas: {wf.figmaScreensMeta?.length ?? 0}
                        </p>
                        {(wf.figmaScreensMeta?.length ?? 0) > 0 ? (
                            <ul className="text-sm text-gray-700 space-y-1">
                                {wf.figmaScreensMeta!.map((s) => (
                                    <li key={`${s.screenIndex}-${s.nodeId}`}>
                                        Pantalla {s.screenIndex}: {s.name}{' '}
                                        <span className="text-gray-500">({s.nodeId})</span>
                                        {wf.figmaOrchestrationErrors?.some((e) => e.screenIndex === s.screenIndex) ? (
                                            <span className="text-amber-700 text-xs ml-1">(advertencia)</span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        {(wf.figmaOrchestrationErrors?.length ?? 0) > 0 ? (
                            <div className="mt-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
                                <p className="font-medium mb-1">Progreso parcial / advertencias por pantalla</p>
                                <ul className="space-y-1">
                                    {wf.figmaOrchestrationErrors!.map((e) => (
                                        <li key={e.screenIndex}>
                                            Pantalla {e.screenIndex}: {e.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {logs.length > 0 ? (
                            <details className="mt-3">
                                <summary className="cursor-pointer text-xs text-gray-600">Ver log técnico</summary>
                                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded whitespace-pre-wrap">
                                    {logs.join('\n')}
                                </pre>
                            </details>
                        ) : null}
                    </div>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/wireframes-hifi"
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 text-center text-gray-900 ux-focus"
                    >
                        ← Volver a wireframes HiFi
                    </Link>
                    <button
                        type="button"
                        disabled={!wf.figmaGenerated || busy}
                        onClick={approveAndContinue}
                        className="flex-1 gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 ux-focus disabled:opacity-50"
                    >
                        Aprobar Figma y continuar a Código →
                    </button>
                </div>
            </div>
        </main>
    );
}
