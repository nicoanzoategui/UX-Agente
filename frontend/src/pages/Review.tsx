import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import WireframePreview from '../components/WireframePreview';
import ProgressSteps from '../components/ProgressSteps';

const LEVEL_NAMES = ['', 'Wireframe', 'Wireframe Alta', 'UI High-Fi'];

export default function Review() {
    const { storyId } = useParams();
    const navigate = useNavigate();
    const [story, setStory] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        loadStory();
        const interval = setInterval(loadStory, 5000); // Poll every 5s for updates
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
    const isGenerating =
        story &&
        (Number((story as any).is_generating) === 1 || (story as any).is_generating === true);

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
                {/* Columna historia de usuario (izquierda en desktop) */}
                <aside className="w-full lg:w-[min(100%,380px)] lg:shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto space-y-4 pr-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <a
                            href={`https://${import.meta.env.VITE_JIRA_HOST || 'jira.atlassian.com'}/browse/${story.jira_key}`}
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
                    {story.description ? (
                        <div className="bg-white border border-[#DFE1E6] p-4 rounded-[3px] text-sm text-[#42526E] leading-relaxed shadow-sm">
                            <h4 className="text-[10px] uppercase font-bold text-[#7A869A] mb-2 tracking-widest">
                                Historia / descripción
                            </h4>
                            <p className="whitespace-pre-wrap">{story.description}</p>
                        </div>
                    ) : (
                        <p className="text-xs text-[#7A869A] italic">Sin descripción en el ticket.</p>
                    )}
                    <div className="pt-2 border-t border-[#DFE1E6]">
                        <p className="text-[10px] uppercase font-bold text-[#7A869A] mb-3 tracking-widest">Etapas</p>
                        <ProgressSteps
                            currentLevel={pendingOutput?.level || (story.status === 'completed' ? 4 : 0)}
                            approvedLevels={approvedOutputs.map((o: any) => o.level)}
                        />
                    </div>
                </aside>

                {/* Columna diseño + acciones */}
                <div className="flex-1 min-w-0 space-y-6">
                    {pendingOutput ? (
                        <div className="flex flex-col xl:flex-row gap-6 xl:items-start">
                            <div className="flex-1 min-w-0 space-y-4">
                                <div className="flex items-center justify-between border-b-2 border-[#0052CC] pb-1">
                                    <h2 className="font-semibold text-lg text-[#172B4D] flex items-center gap-2 flex-wrap">
                                        {LEVEL_NAMES[pendingOutput.level]}
                                        <span className="text-[#5E6C84] font-mono text-xs bg-[#EBECF0] px-2 py-0.5 rounded-[3px]">
                                            v{pendingOutput.version}
                                        </span>
                                    </h2>
                                </div>
                                <div className="bg-white border border-[#DFE1E6] rounded-[3px] p-1 shadow-sm overflow-hidden">
                                    <WireframePreview
                                        content={pendingOutput.content}
                                        type={pendingOutput.content_type}
                                    />
                                </div>
                            </div>

                            <div className="w-full xl:w-72 shrink-0 xl:sticky xl:top-4 xl:self-start">
                                <div className="bg-white border border-[#DFE1E6] p-5 rounded-[3px] shadow-sm">
                                    <h2 className="text-xs font-bold text-[#7A869A] uppercase tracking-widest mb-5">
                                        Revisión
                                    </h2>

                                    <button
                                        onClick={handleApprove}
                                        disabled={submitting}
                                        className="w-full py-2.5 bg-[#36B37E] hover:bg-[#32a473] disabled:bg-[#EBECF0] disabled:text-[#A5ADBA] rounded-[3px] font-bold transition-all flex items-center justify-center gap-2 text-white text-sm"
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
                                                Aprobar este nivel
                                            </>
                                        )}
                                    </button>

                                    {pendingOutput.level < 3 && !submitting && (
                                        <p className="text-[11px] text-center text-[#5E6C84] mt-3 leading-tight italic">
                                            Luego se genera {LEVEL_NAMES[pendingOutput.level + 1]}
                                        </p>
                                    )}

                                    <div className="mt-6 border-t border-[#EBECF0] pt-5">
                                        <label className="block text-xs font-bold text-[#7A869A] uppercase tracking-widest mb-2">
                                            Pedir cambios (v{pendingOutput.version + 1})
                                        </label>
                                        <textarea
                                            value={feedback}
                                            onChange={(e) => setFeedback(e.target.value)}
                                            placeholder="Feedback para el agente…"
                                            className="w-full h-28 px-3 py-2 bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] text-sm resize-none focus:bg-white focus:border-[#4C9AFF] outline-none transition-all placeholder-[#A5ADBA] text-[#172B4D]"
                                            disabled={submitting}
                                        />
                                        <button
                                            onClick={handleReject}
                                            disabled={submitting || !feedback.trim()}
                                            className="mt-2 w-full py-2 bg-white hover:bg-[#F4F5F7] text-[#42526E] disabled:opacity-50 disabled:cursor-not-allowed rounded-[3px] text-sm font-bold transition-colors border border-[#DFE1E6]"
                                        >
                                            Enviar feedback e iterar
                                        </button>
                                    </div>
                                </div>
                            </div>
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
        </div>
    );
}
