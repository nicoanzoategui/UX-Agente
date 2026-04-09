import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../components/platform/ProgressBar';
import { useToast } from '../context/ToastContext';
import { createNewInitiative, getCurrentInitiativeId } from '../lib/initiativesSession';
import { loadWorkflow, saveWorkflow } from '../lib/workflowSession';
import { api, ApiError } from '../services/api';

const DRAFT_KEY = 'ux-agent-understanding-v2';

const FILE_ICON_COLORS = [
    'text-blue-500',
    'text-green-500',
    'text-purple-500',
    'text-orange-500',
] as const;

export type ContextFileRow = {
    id: string;
    name: string;
    sizeBytes: number;
    tag: string;
    file?: File;
};

export type ScreenshotSlot = {
    id: string;
    label: string;
    defaultName: string;
    file?: File;
    previewUrl?: string;
};

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialScreenshots: ScreenshotSlot[] = [
    { id: 's1', label: 'Pantalla 1', defaultName: '' },
    { id: 's2', label: 'Pantalla 2', defaultName: '' },
    { id: 's3', label: 'Pantalla 3', defaultName: '' },
];

type DraftShape = {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    files: ContextFileRow[];
    notes: string;
    screenshotMeta: { id: string; displayName: string }[];
};

export default function UnderstandingPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const modalTitleId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    const [initiativeName, setInitiativeName] = useState('');
    const [jiraTicket, setJiraTicket] = useState('');
    const [squad, setSquad] = useState('');
    const [files, setFiles] = useState<ContextFileRow[]>([]);
    const [notes, setNotes] = useState('');
    const [screenshots, setScreenshots] = useState<ScreenshotSlot[]>(() =>
        initialScreenshots.map((s) => ({ ...s }))
    );
    const [fileModalOpen, setFileModalOpen] = useState(false);
    const [stagingFiles, setStagingFiles] = useState<File[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const persistDraft = useCallback(() => {
        try {
            const draft: DraftShape = {
                initiativeName,
                jiraTicket,
                squad,
                files: files.map(({ id, name, sizeBytes, tag }) => ({ id, name, sizeBytes, tag })),
                notes,
                screenshotMeta: screenshots.map((s) => ({
                    id: s.id,
                    displayName: s.file?.name ?? s.defaultName,
                })),
            };
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* ignore */
        }
    }, [initiativeName, jiraTicket, squad, files, notes, screenshots]);

    useEffect(() => {
        document.title = 'Entendimiento · UX Agent Platform';
        return () => {
            document.title = 'UX Agent Platform';
        };
    }, []);

    useEffect(() => {
        if (!getCurrentInitiativeId()) {
            createNewInitiative();
        }
        const w = loadWorkflow();
        if (w) {
            setInitiativeName(w.initiativeName || '');
            setJiraTicket(w.jiraTicket || '');
            setSquad(w.squad || '');
        }
    }, []);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const d = JSON.parse(raw) as DraftShape;
            if (typeof d.initiativeName === 'string') setInitiativeName(d.initiativeName);
            if (typeof d.jiraTicket === 'string') setJiraTicket(d.jiraTicket);
            if (typeof d.squad === 'string') setSquad(d.squad);
            if (Array.isArray(d.files) && d.files.length > 0) {
                setFiles(
                    d.files.map((f) => ({
                        id: f.id || uid(),
                        name: f.name,
                        sizeBytes: f.sizeBytes,
                        tag: f.tag || 'Documento',
                    }))
                );
            }
            if (typeof d.notes === 'string') setNotes(d.notes);
        } catch {
            /* ignore */
        }
    }, []);

    function removeFile(id: string) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    }

    function addFilesFromList(list: File[]) {
        const next: ContextFileRow[] = list.map((file) => ({
            id: uid(),
            name: file.name,
            sizeBytes: file.size,
            tag: guessTag(file.name),
            file,
        }));
        setFiles((prev) => [...prev, ...next]);
    }

    function guessTag(name: string): string {
        const n = name.toLowerCase();
        if (n.includes('transcript') || n.includes('kickoff') || n.endsWith('.txt') || n.endsWith('.vtt'))
            return 'Transcripción de reunión';
        if (n.includes('spec')) return 'Spec de negocio';
        if (n.includes('voz') || n.includes('tono')) return 'Manual de voz y tono';
        if (n.endsWith('.md') || n.includes('doc')) return 'Documentación técnica';
        return 'Documento';
    }

    function onDropModal(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        const list = [...e.dataTransfer.files];
        if (list.length) setStagingFiles((s) => [...s, ...list]);
    }

    function confirmStaging() {
        if (stagingFiles.length) addFilesFromList(stagingFiles);
        setStagingFiles([]);
        setFileModalOpen(false);
    }

    function closeModal() {
        setStagingFiles([]);
        setFileModalOpen(false);
    }

    function setScreenshotFile(slotId: string, file: File | null) {
        setScreenshots((prev) =>
            prev.map((s) => {
                if (s.id !== slotId) return s;
                if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
                if (!file) return { ...s, file: undefined, previewUrl: undefined };
                return { ...s, file, previewUrl: URL.createObjectURL(file) };
            })
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const title = initiativeName.trim();
        if (!title) {
            toast('Completá el nombre de la iniciativa.', 'error');
            return;
        }
        persistDraft();
        if (!getCurrentInitiativeId()) {
            createNewInitiative();
        }
        const prev = loadWorkflow() ?? { initiativeName: '', jiraTicket: '', squad: '' };
        saveWorkflow({
            ...prev,
            initiativeName: title,
            jiraTicket: jiraTicket.trim(),
            squad: squad.trim(),
        });
        setIsAnalyzing(true);
        try {
            const fd = new FormData();
            fd.append('initiativeName', title);
            fd.append('jiraTicket', jiraTicket.trim());
            fd.append('squad', squad.trim());
            fd.append('notes', notes);
            const manifest = files
                .filter((f) => !f.file)
                .map((f) => ({ name: f.name, tag: f.tag, sizeBytes: f.sizeBytes }));
            fd.append('fileManifest', JSON.stringify(manifest));
            for (const f of files) {
                if (f.file) fd.append('contextFiles', f.file);
            }
            for (const s of screenshots) {
                if (s.file) fd.append('screenshots', s.file);
            }
            const { analysis } = await api.analyzeUnderstanding(fd);
            navigate('/analisis', {
                state: {
                    analysis,
                    initiativeName: title,
                    jiraTicket: jiraTicket.trim(),
                    squad: squad.trim(),
                },
            });
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'No se pudo analizar el contexto. Intentá de nuevo.';
            toast(msg, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    }

    return (
        <div className="flex flex-col flex-1">
            <a
                href="#contenido-entendimiento"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-20 focus:z-[100] focus:rounded-lg focus:bg-purple-600 focus:px-4 focus:py-2 focus:text-white"
            >
                Saltar al formulario
            </a>

            <main
                id="contenido-entendimiento"
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 fade-in"
            >
                <ProgressBar currentStep={1} />

                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-8 space-y-8" noValidate>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">1. Entendimiento</h1>
                        <p className="text-gray-600">
                            Carga el contexto de tu iniciativa para que el UX Agent pueda analizarla
                        </p>
                    </div>

                    <div>
                        <label htmlFor="initiative-name" className="block text-sm font-medium text-gray-700 mb-2">
                            Nombre de la iniciativa
                        </label>
                        <input
                            id="initiative-name"
                            type="text"
                            value={initiativeName}
                            onChange={(e) => setInitiativeName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            autoComplete="off"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="jira-ticket" className="block text-sm font-medium text-gray-700 mb-2">
                                Ticket de Jira
                            </label>
                            <input
                                id="jira-ticket"
                                type="text"
                                value={jiraTicket}
                                onChange={(e) => setJiraTicket(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                autoComplete="off"
                            />
                        </div>
                        <div>
                            <label htmlFor="squad" className="block text-sm font-medium text-gray-700 mb-2">
                                Squad / Producto
                            </label>
                            <input
                                id="squad"
                                type="text"
                                value={squad}
                                onChange={(e) => setSquad(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div>
                        <span className="block text-sm font-medium text-gray-700 mb-2">Contexto del proyecto</span>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-gray-600">Archivos cargados</p>
                                <button
                                    type="button"
                                    onClick={() => setFileModalOpen(true)}
                                    className="text-sm text-purple-600 hover:text-purple-700 font-medium ux-focus rounded-lg px-1"
                                >
                                    + Agregar archivos
                                </button>
                            </div>
                            {files.length === 0 ? (
                                <p className="text-sm text-gray-500 py-2">
                                    Todavía no hay archivos. Usá «+ Agregar archivos» para subir contexto.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {files.map((f, i) => (
                                        <li
                                            key={f.id}
                                            className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center min-w-0">
                                                <svg
                                                    className={`w-8 h-8 mr-3 shrink-0 ${FILE_ICON_COLORS[i % FILE_ICON_COLORS.length]}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    aria-hidden
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                    />
                                                </svg>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatBytes(f.sizeBytes)} • {f.tag}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(f.id)}
                                                className="text-gray-400 hover:text-red-500 p-1 rounded-lg ux-focus shrink-0"
                                                aria-label={`Quitar ${f.name}`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500 flex items-start gap-1">
                                    <svg
                                        className="w-4 h-4 text-blue-500 shrink-0 mt-0.5"
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
                                    Puedes cargar PDFs, Word, TXT, transcripciones y documentación técnica
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                            Notas y aspectos adicionales{' '}
                            <span className="text-gray-500 font-normal text-xs ml-1">(Opcional)</span>
                        </label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={8}
                            placeholder="Agrega aquí cualquier contexto adicional, restricciones técnicas, consideraciones especiales, insights de research, feedback de usuarios, o aspectos que consideres importantes para esta iniciativa..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y min-h-[160px]"
                        />
                        <div className="mt-2 flex items-start gap-2">
                            <svg
                                className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"
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
                            <p className="text-xs text-gray-600">
                                Este campo es útil para agregar información que no está en los documentos:
                                observaciones del kickoff, restricciones técnicas conocidas, feedback previo de
                                usuarios, o cualquier contexto que ayude al UX Agent a generar mejores propuestas.
                            </p>
                        </div>
                    </div>

                    <div>
                        <span className="block text-sm font-medium text-gray-700 mb-2">
                            Screenshots del flujo actual
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {screenshots.map((slot) => (
                                <ScreenshotCard
                                    key={slot.id}
                                    slot={slot}
                                    onPick={(file) => setScreenshotFile(slot.id, file)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isAnalyzing}
                            className="w-full gradient-bg text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all ux-focus disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isAnalyzing ? 'Analizando con Gemini…' : 'Analizar contexto con IA'}
                        </button>
                    </div>
                </form>
            </main>

            {fileModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={modalTitleId}
                >
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 id={modalTitleId} className="text-xl font-bold text-gray-900">
                                Agregar archivos de contexto
                            </h3>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg ux-focus"
                                aria-label="Cerrar"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <p className="text-gray-600 mb-4">
                            Carga documentos que ayuden al UX Agent a entender el contexto del proyecto
                        </p>
                        <div
                            ref={dropZoneRef}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={onDropModal}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 hover:border-purple-400 transition-colors cursor-pointer"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="sr-only"
                                accept=".pdf,.doc,.docx,.txt,.md,.vtt,.srt,text/plain,application/pdf"
                                onChange={(e) => {
                                    const list = e.target.files ? [...e.target.files] : [];
                                    if (list.length) setStagingFiles((s) => [...s, ...list]);
                                    e.target.value = '';
                                }}
                            />
                            <svg
                                className="mx-auto h-12 w-12 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                            <p className="mt-2 text-sm text-gray-600">
                                Arrastra archivos aquí o hacé click para seleccionar
                            </p>
                            <p className="mt-1 text-xs text-gray-500">PDF, DOCX, TXT, MD hasta 20 MB por archivo</p>
                        </div>
                        {stagingFiles.length > 0 && (
                            <ul className="text-sm text-gray-700 mb-4 space-y-1">
                                {stagingFiles.map((f, i) => (
                                    <li key={`${f.name}-${i}`}>
                                        {f.name} ({formatBytes(f.size)})
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 ux-focus"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmStaging}
                                className="flex-1 gradient-bg text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 ux-focus"
                            >
                                {stagingFiles.length > 0
                                    ? `Agregar ${stagingFiles.length} archivo(s)`
                                    : 'Listo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ScreenshotCard({
    slot,
    onPick,
}: {
    slot: ScreenshotSlot;
    onPick: (file: File | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const displayName =
        (slot.file?.name ?? slot.defaultName).trim() || 'Sin imagen cargada';

    return (
        <div className="border border-gray-200 rounded-lg p-4 text-center">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full text-left ux-focus rounded-lg"
            >
                <div className="bg-gray-100 h-32 rounded mb-2 flex items-center justify-center overflow-hidden">
                    {slot.previewUrl ? (
                        <img
                            src={slot.previewUrl}
                            alt={`Captura ${slot.label}`}
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : (
                        <span className="text-xs text-gray-500">{slot.label}</span>
                    )}
                </div>
                <p className="text-xs text-gray-600 truncate" title={displayName}>
                    {displayName}
                </p>
                <span className="text-[10px] text-purple-600 font-medium mt-1 inline-block">
                    Click para cambiar imagen
                </span>
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    onPick(f);
                    e.target.value = '';
                }}
            />
            {slot.file && (
                <button
                    type="button"
                    onClick={(ev) => {
                        ev.stopPropagation();
                        onPick(null);
                    }}
                    className="mt-2 text-xs text-red-600 hover:underline ux-focus"
                >
                    Quitar imagen
                </button>
            )}
        </div>
    );
}
