import { lazy, Suspense, useState } from 'react';

const HiFiSandpackPreview = lazy(() => import('./HiFiSandpackPreview'));

interface Props {
    content: string;
    type: 'svg' | 'code';
}

export default function WireframePreview({ content, type }: Props) {
    const [hiFiTab, setHiFiTab] = useState<'preview' | 'code'>('preview');

    if (type === 'svg' || content.trim().startsWith('<svg')) {
        return (
            <div className="bg-[#F4F5F7] rounded-[3px] p-8 overflow-auto max-h-[700px] flex justify-center border border-[#DFE1E6]">
                <div
                    className="bg-white shadow-xl rounded-sm p-4 w-full"
                    style={{ maxWidth: '375px' }}
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-1 p-1 bg-[#EBECF0] rounded-[3px] w-fit">
                <button
                    type="button"
                    onClick={() => setHiFiTab('preview')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-[3px] transition-colors ${hiFiTab === 'preview'
                        ? 'bg-white text-[#0052CC] shadow-sm'
                        : 'text-[#5E6C84] hover:text-[#172B4D]'
                        }`}
                >
                    Vista previa
                </button>
                <button
                    type="button"
                    onClick={() => setHiFiTab('code')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-[3px] transition-colors ${hiFiTab === 'code'
                        ? 'bg-white text-[#0052CC] shadow-sm'
                        : 'text-[#5E6C84] hover:text-[#172B4D]'
                        }`}
                >
                    Código
                </button>
            </div>

            {hiFiTab === 'preview' ? (
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center min-h-[320px] bg-[#F4F5F7] rounded-[3px] border border-[#DFE1E6] text-sm text-[#5E6C84]">
                            Cargando vista previa interactiva…
                        </div>
                    }
                >
                    <HiFiSandpackPreview code={content} />
                </Suspense>
            ) : (
                <div className="relative group">
                    <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(content)}
                        className="absolute top-4 right-4 px-3 py-1.5 bg-white border border-[#DFE1E6] hover:bg-[#F4F5F7] rounded-[3px] text-xs font-bold text-[#42526E] z-10 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        Copiar código
                    </button>
                    <div className="bg-[#091E42] rounded-[3px] p-6 overflow-auto max-h-[min(70vh,700px)] border border-[#091E42] shadow-inner">
                        <pre className="text-sm font-mono leading-relaxed">
                            <code className="text-[#EBECF0] whitespace-pre-wrap">{content}</code>
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
