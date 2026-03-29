import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import StoryCard from '../components/StoryCard';

interface Story {
    id: string;
    jira_key: string;
    title: string;
    status: string;
    current_level: number;
    outputs_count: number;
    approved_count: number;
    created_at: string;
}

export default function Dashboard() {
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadStories();
        const interval = setInterval(loadStories, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    async function loadStories() {
        try {
            const data = await api.getStories();
            setStories(data);
            setError('');
        } catch (err: any) {
            setError('Error cargando stories de diseño');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const pending = stories.filter(s => s.status === 'in_progress');
    const completed = stories.filter(s => s.status === 'completed');

    if (loading && stories.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Summary */}
            <div className="flex items-end justify-between border-b border-[#DFE1E6] pb-6">
                <div>
                    <h1 className="text-2xl font-medium tracking-tight text-[#172B4D]">Panel de Diseño</h1>
                    <p className="text-[#5E6C84] text-sm mt-1 flex items-center gap-2">
                        Monitoreando Jira para el label <span className="bg-[#EAE6FF] text-[#403294] px-2 py-0.5 rounded font-mono text-xs font-semibold uppercase">design-pending</span>
                    </p>
                </div>
                <div className="flex gap-8">
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-[#FFAB00]">{pending.length}</span>
                        <span className="text-[10px] uppercase font-bold text-[#5E6C84] tracking-wider">En progreso</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-[#36B37E]">{completed.length}</span>
                        <span className="text-[10px] uppercase font-bold text-[#5E6C84] tracking-wider">Completadas</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-[#FFEBE6] border border-[#FF5630] rounded-[3px] text-[#BF2600] text-sm flex items-center gap-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="grid gap-8">
                {/* Pending Items */}
                {pending.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold text-[#5E6C84] uppercase tracking-widest mb-4 flex items-center gap-2">
                            Pendientes de revisión ({pending.length})
                        </h2>
                        <div className="grid gap-1">
                            {pending.map(story => (
                                <Link key={story.id} to={`/review/${story.id}`}>
                                    <StoryCard story={story} />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Completed Items */}
                {completed.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold text-[#5E6C84] uppercase tracking-widest mb-4">
                            Completadas ({completed.length})
                        </h2>
                        <div className="grid gap-1 opacity-80">
                            {completed.map(story => (
                                <Link key={story.id} to={`/review/${story.id}`}>
                                    <StoryCard story={story} />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Empty state */}
            {!loading && stories.length === 0 && (
                <div className="text-center py-20 bg-white border border-[#DFE1E6] rounded-[3px]">
                    <div className="w-20 h-20 mx-auto mb-6 bg-[#F4F5F7] rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-[#A5ADBA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium text-[#172B4D]">No hay historias de diseño</h3>
                    <p className="text-[#5E6C84] mt-2 max-w-xs mx-auto">
                        Añade el label <code className="text-[#403294] font-bold">design-pending</code> en Jira para que el agente comience a trabajar.
                    </p>
                </div>
            )}
        </div>
    );
}
