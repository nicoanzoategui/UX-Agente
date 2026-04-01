import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import WireframePreview from '../components/WireframePreview';
import ProgressSteps from '../components/ProgressSteps';

const LEVEL_NAMES = ['', 'Wireframe', 'Wireframe Alta', 'UI High-Fi'];

function parseStoryDescription(text: string) {
    const normalized = text
        .replace(/Criterios de aceptación:?/gi, '\n\nCriterios de aceptación:\n')
        .replace(/(Información a mostrar y editar:|Acciones disponibles:)/gi, '\n\n$1\n')
        .replace(/(\))(?=[A-ZÁÉÍÓÚÑ])/g, '$1\n');
    const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
    const first = lines[0] || '';
    const bulletLines = lines.filter((l) => /^[-*•]/.test(l)).map((l) => l.replace(/^[-*•]\s*/, ''));
    return {
        first,
        bulletLines,
        plain: normalized,
    };
}

export default function Review() {
    const { storyId } = useParams();
    const navigate = useNavigate();
    const [story, setStory] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const jiraHost = ((import.meta as any).env?.VITE_JIRA_HOST as string | undefined) || 'jira.atlassian.com';

    useEffect(() => {
        loadStory();
        const interval = setInterval(loadStory, 5000);
        return () => clearInterval(interval);
    }, [storyId]);

    async function loadStory() {
        try {
            const data = await api.getStory(storyId!);
            setStory(data);
        } catch (error: any) {
            console.error('Error fetching story:', error);
            const msg = (error?.message || '').toLowerCase();
            if (msg.includes('not found') || msg.includes('no encontrad')) {
                setStory(null);
            }
        } finally {
            setLoading(false);
        }
    }

    const pendingOutput = story?.outputs?.find((o: any) => o.status === 'pending');
    const approvedOutputs = story?.outputs?.filter((o: any) => o.status === 'approved') || [];
    const availableLevels = Array.from(new Set((story?.outputs || []).map((o: any) => Number(o.level)))) as number[];
    const activeOutput = selectedLevel != null
        ? (story?.outputs || [])
            .filter((o: any) => o.level === selectedLevel)
            .sort((a: any, b: any) => b.version - a.version)[0]
        : pendingOutput;
    const shownOutput = activeOutput || pendingOutput;
    const parsedDescription = parseStoryDescription(story?.description || '');
    const isGenerating =
        story &&
        (Number((story as any).is_generating) === 1 || (story as any).is_generating === true);

    useEffect(() => {
        if (!story) return;
        if (pendingOutput?.level) {
            setSelectedLevel((prev) => (prev == null ? pendingOutput.level : prev));
            return;
        }
        if (approvedOutputs.length > 0) {
            const latestApprovedLevel = approvedOutputs
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                ?.level;
            if (latestApprovedLevel) {
                setSelectedLevel((prev) => (prev == null ? latestApprovedLevel : prev));
            }
        }
    }, [story?.id, pendingOutput?.id]);

    async function handleApprove() {
        if (!pendingOutput) return;
        setSubmitting(true);
        try {
            await api.approve(pendingOutput.id);
            setFeedback('');
            await loadStory();
        } catch (err: any) {
            alert(err.message || 'Error approving design');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleReject() {
        if (!pendingOutput || !feedback.trim()) return;
        setSubmitting(true);
        try {
            await api.reject(pendingOutput.id, feedback);
            setFeedback('');
            await loadStory();
        } catch (err: any) {
            alert(err.message || 'Error sending feedback');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleRetryFirstDesign() {
        if (!storyId) return;
        setRetrying(true);
        try {
            await api.retryFirstDesign(storyId);
            await loadStory();
        } catch (err: any) {
            alert(err.message || 'No se pudo reintentar. Revisá la consola del backend y GEMINI_API_KEY / GEMINI_MODEL.');
        } finally {
            setRetrying(false);
        }
    }

    if (loading && !story) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!story) {
        return (
            <div className="text-center py-16 max-w-md mx-auto space-y-3">
                <p className="text-gray-300">No encontramos esta historia.</p>
                <p className="text-gray-500 text-sm">
                    Puede haber sido eliminada en Jira: el panel se actualiza al refrescar y ya no la lista.
                </p>
                <button onClick={() => navigate('/')} className="mt-4 text-purple-400 hover:underline">
                    Volver al dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto">
            <button
                onClick={() => navigate('/')}
                className="text-[#5E6C84] hover:text-[#172B4D] mb-6 text-sm flex items-center gap-1 group font-medium"
            >
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Volver al dashboard
            </button>

            <div className="flex flex-col lg:flex-row gap-8 lg:items-start lg:min-h-[calc(100vh-8rem)]">

                {/* Columna historia de usuario — colapsable */}
                <aside className="w-full lg:w-[min(100%,300px)] lg:shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto space-y-4 pr-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <a
                            href={`https://${jiraHost}/browse/${story.jira_key}`}
                            target="_blank"
                            rel="noopener"
                            className="text-[#0052CC] font-semibold text-sm hover:underline"
                        >
                            {story.jira_key}
                        </a>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[3px] ${story.status === 'completed'
                            ? 'bg-[#E3FCEF] text-[#006644]'
                            : 'bg-[#FFF0B3] text-[#855700]'
                            }`}>
                            {story.status === 'completed' ? 'Hecho' : 'Diseñando'}
                        </span>
                    </div>
                    <h1 className="text-xl lg:text-2xl font-semibold text-[#172B4D] leading-snug">{story.title}</h1>

                    {/* Descripción colapsable */}
                    {story.description && (
                        <div className="bg-white border border-[#DFE1E6] rounded-[3px] shadow-sm overflow-hidden">
                            <div className="w-full flex items-center justify-between px-4 py-3 border-b border-[#DFE1E6]">
                                <span className="text-[10px] uppercase font-bold text-[#7A869A] tracking-widest">
                                    Historia / descripción
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setDescriptionModalOpen(true)}
                                    className="text-[10px] font-bold uppercase tracking-wider text-[#0052CC] hover:underline"
                                >
                                    Expandir
                                </button>
                            </div>
                            <div className="px-4 py-3 text-sm text-[#42526E] leading-relaxed space-y-2">
                                {parsedDescription.first && <p className="font-medium">{parsedDescription.first}</p>}
                                <p className="text-[#6B778C] text-xs line-clamp-5 whitespace-pre-wrap">
                                    {parsedDescription.plain}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-[#DFE1E6]">
                        <p className="text-[10px] uppercase font-bold text-[#7A869A] mb-3 tracking-widest">Etapas</p>
                        <ProgressSteps
                            currentLevel={shownOutput?.level || (story.status === 'completed' ? 4 : 0)}
                            approvedLevels={approvedOutputs.map((o: any) => o.level)}
                            availableLevels={availableLevels}
                            selectedLevel={selectedLevel}
                            onStepClick={(level) => setSelectedLevel(level)}
                        />
                    </div>
                </aside>

                {/* Columna diseño + acciones */}
                <div className="flex-1 min-w-0 space-y-6">
                    {shownOutput ? (
                        <div className="space-y-6">

                            {/* Header del nivel */}
                            <div className="flex items-center justify-between border-b-2 border-[#0052CC] pb-2">
                                <h2 className="font-semibold text-lg text-[#172B4D] flex items-center gap-2 flex-wrap">
                                    {LEVEL_NAMES[shownOutput.level]}
                                    <span className="text-[#5E6C84] font-mono text-xs bg-[#EBECF0] px-2 py-0.5 rounded-[3px]">
                                        v{shownOutput.version}
                                    </span>
                                </h2>
                                {shownOutput.status === 'pending' && shownOutput.level < 3 && (
                                    <span className="text-[11px] text-[#5E6C84] italic">
                                        Si aprobás, se genera {LEVEL_NAMES[shownOutput.level + 1]}
                                    </span>
                                )}
                            </div>

                            {/* Preview del diseño */}
                            <div className="bg-white border border-[#DFE1E6] rounded-[3px] shadow-sm overflow-hidden" style={{ minHeight: 600 }}>
                                <WireframePreview
                                    content={shownOutput.content}
                                    type={shownOutput.content_type}
                                />
                            </div>

                            {shownOutput.status === 'pending' ? (
                                <div className="bg-white border border-[#DFE1E6] rounded-[3px] shadow-sm p-5 space-y-5">
                                    <button
                                        onClick={handleApprove}
                                        disabled={submitting}
                                        className="w-full py-3 bg-[#36B37E] hover:bg-[#32a473] disabled:bg-[#EBECF0] disabled:text-[#A5ADBA] rounded-[3px] font-bold transition-all flex items-center justify-center gap-2 text-white text-sm"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Aprobando...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Aprobar y continuar
                                            </>
                                        )}
                                    </button>

                                    <div className="border-t border-[#EBECF0] pt-5 space-y-2">
                                        <label className="block text-xs font-bold text-[#7A869A] uppercase tracking-widest">
                                            Pedir cambios — v{shownOutput.version + 1}
                                        </label>
                                        <textarea
                                            value={feedback}
                                            onChange={(e) => setFeedback(e.target.value)}
                                            placeholder="Describí qué querés cambiar…"
                                            className="w-full h-24 px-3 py-2 bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] text-sm resize-none focus:bg-white focus:border-[#4C9AFF] outline-none transition-all placeholder-[#A5ADBA] text-[#172B4D]"
                                            disabled={submitting}
                                        />
                                        <button
                                            onClick={handleReject}
                                            disabled={submitting || !feedback.trim()}
                                            className="w-full py-2 bg-white hover:bg-[#F4F5F7] text-[#42526E] disabled:opacity-50 disabled:cursor-not-allowed rounded-[3px] text-sm font-bold transition-colors border border-[#DFE1E6]"
                                        >
                                            Enviar feedback e iterar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white border border-[#DFE1E6] rounded-[3px] shadow-sm p-4 text-sm text-[#5E6C84]">
                                    Estás viendo una versión ya aprobada/iterada. Podés cambiar de etapa desde la columna izquierda.
                                </div>
                            )}
                        </div>

                    ) : story.status === 'completed' ? (
                        <div className="text-center py-16 bg-white border border-[#36B37E] border-dashed rounded-[3px]">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#E3FCEF] flex items-center justify-center">
                                <svg className="w-10 h-10 text-[#36B37E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-[#172B4D]">Flujo de Diseño Finalizado</h3>
                            <p className="text-[#5E6C84] mt-2 max-w-sm mx-auto leading-relaxed">
                                Todas las etapas fueron aprobadas. Los assets finales y el código están disponibles en Jira.
                            </p>
                        </div>

                    ) : (
                        <div className="text-center py-20 max-w-lg mx-auto space-y-6 bg-white border border-[#DFE1E6] rounded-[3px] border-dashed">
                            {(!story.outputs || story.outputs.length === 0) && isGenerating ? (
                                <>
                                    <div className="relative w-12 h-12 mx-auto mb-6">
                                        <div className="absolute inset-0 border-4 border-[#EBECF0] rounded-full" />
                                        <div className="absolute inset-0 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin" />
                                    </div>
                                    <p className="text-[#172B4D] font-medium text-lg">Gemini está creando el diseño…</p>
                                    <p className="text-[#5E6C84] text-xs">
                                        Este proceso puede tardar unos 2 minutos. La página se actualizará automáticamente.
                                    </p>
                                </>
                            ) : (!story.outputs || story.outputs.length === 0) ? (
                                <>
                                    <p className="text-[#BF2600] font-medium">
                                        No se ha podido generar el diseño inicial.
                                    </p>
                                    <p className="text-[#5E6C84] text-xs px-10">
                                        Revisa los logs del backend para identificar si hay errores de cuota en Gemini o problemas de red.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleRetryFirstDesign}
                                        disabled={retrying}
                                        className="px-6 py-2 bg-[#0052CC] hover:bg-[#0747A6] disabled:bg-[#EBECF0] rounded-[3px] font-medium text-white transition-colors text-sm"
                                    >
                                        {retrying ? 'Generando…' : 'Reintentar nivel 1'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="relative w-12 h-12 mx-auto mb-6">
                                        <div className="absolute inset-0 border-4 border-[#EBECF0] rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                    <p className="text-[#42526E] animate-pulse font-medium">
                                        {isGenerating
                                            ? 'Generando el siguiente nivel en segundo plano…'
                                            : 'Esperando el nuevo diseño…'}
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {story.outputs?.filter((o: any) => o.status !== 'pending').length > 0 && (
                <div className="mt-12 border-t border-[#DFE1E6] pt-8 pb-12">
                    <h2 className="text-xs font-bold text-[#7A869A] uppercase tracking-widest mb-6">Historial de Iteraciones</h2>
                    <div className="space-y-2">
                        {story.outputs
                            .filter((o: any) => o.status !== 'pending')
                            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((output: any) => (
                                <div
                                    key={output.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-[#DFE1E6] rounded-[3px] gap-4 hover:bg-[#F4F5F7] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${output.status === 'approved' ? 'bg-[#36B37E]' : 'bg-[#FF5630]'}`} />
                                        <div>
                                            <span className="font-semibold text-sm text-[#172B4D]">{LEVEL_NAMES[output.level]}</span>
                                            <span className="text-[#5E6C84] text-[11px] font-mono ml-2">v{output.version}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        {output.feedback && (
                                            <span className="text-xs text-[#5E6C84] italic bg-[#F4F5F7] px-3 py-1.5 rounded-[3px] border border-[#DFE1E6] max-w-sm truncate whitespace-pre-wrap">
                                                &quot;{output.feedback}&quot;
                                            </span>
                                        )}
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-[3px] flex-shrink-0 ${output.status === 'approved'
                                            ? 'bg-[#E3FCEF] text-[#006644]'
                                            : 'bg-[#FFEBE6] text-[#BF2600]'
                                            }`}>
                                            {output.status === 'approved' ? 'Aprobado' : 'Iterado'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {descriptionModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#091E42]/45 backdrop-blur-[1px] flex items-center justify-center p-6">
                    <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-md border border-[#DFE1E6] shadow-2xl overflow-hidden flex flex-col">
                        <div className="h-16 px-6 border-b border-[#DFE1E6] flex items-center justify-between shrink-0 bg-white">
                            <h3 className="text-2xl font-semibold text-[#172B4D]">Historia / Descripción</h3>
                            <button
                                onClick={() => setDescriptionModalOpen(false)}
                                className="text-[#6B778C] hover:text-[#172B4D] text-2xl leading-none px-2 py-1 rounded hover:bg-[#F4F5F7]"
                                aria-label="Cerrar modal"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 bg-[#FAFBFC] border-b border-[#DFE1E6] overflow-y-auto flex-1">
                            <div className="h-11 px-4 bg-white border border-[#DFE1E6] rounded-t-[3px] flex items-center gap-3 text-[#5E6C84] text-sm">
                                <span className="font-semibold">B</span>
                                <span className="italic">I</span>
                                <span className="underline">U</span>
                                <span className="mx-1 text-[#C1C7D0]">|</span>
                                <span>• Lista</span>
                                <span>🔗</span>
                                <span>🖼</span>
                                <span>&lt;/&gt;</span>
                            </div>
                            <div className="border border-t-0 border-[#DFE1E6] rounded-b-[3px] bg-white min-h-[360px] p-6">
                                {parsedDescription.first && (
                                    <h4 className="text-xl font-semibold text-[#172B4D] mb-4">{parsedDescription.first}</h4>
                                )}
                                {parsedDescription.bulletLines.length > 0 ? (
                                    <ul className="list-disc pl-6 space-y-2 text-base text-[#172B4D] leading-relaxed">
                                        {parsedDescription.bulletLines.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <pre className="whitespace-pre-wrap text-base leading-relaxed text-[#172B4D] font-sans">
                                        {parsedDescription.plain}
                                    </pre>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-white flex items-center justify-end gap-3 shrink-0 border-t border-[#DFE1E6]">
                            <button
                                onClick={() => setDescriptionModalOpen(false)}
                                className="px-5 py-2 rounded-[3px] text-sm font-semibold text-[#42526E] hover:bg-[#F4F5F7]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setDescriptionModalOpen(false)}
                                className="px-5 py-2 rounded-[3px] text-sm font-semibold bg-[#0052CC] text-white hover:bg-[#0747A6]"
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}