import React from 'react';
import { lazy, Suspense, useState } from 'react';

const HiFiSandpackPreview = lazy(() => import('./HiFiSandpackPreview'));

interface Props {
    content: string;
    type: 'svg' | 'code';
}

type PreviewTab = 'preview' | 'code';
type DeviceTab = 'desktop' | 'mobile';

export default function WireframePreview({ content, type }: Props) {
    const [previewTab, setPreviewTab] = useState<PreviewTab>('preview');
    const [deviceTab, setDeviceTab] = useState<DeviceTab>('desktop');
    const [zoom, setZoom] = useState(100);

    const isSvg = type === 'svg' || content.trim().startsWith('<svg');

    const parts = content.split('---DESKTOP---');
    const desktopSvg = parts.length === 2 ? parts[0].trim() : content.trim();
    const mobileSvg = parts.length === 2 ? parts[1].trim() : content.trim();
    const activeSvg = deviceTab === 'desktop' ? desktopSvg : mobileSvg;

    return (
        <div className="flex flex-col h-full">
            <div className="border-b border-[#DFE1E6] flex">
                {(['preview', 'code'] as PreviewTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setPreviewTab(tab)}
                        className={`px-5 py-2.5 text-[13px] font-semibold tracking-wide uppercase transition-colors border-b-2 ${previewTab === tab
                            ? 'text-[#0052CC] border-[#0052CC]'
                            : 'text-[#7A869A] border-transparent hover:text-[#42526E]'
                            }`}
                    >
                        {tab === 'preview' ? 'Vista previa' : 'Código'}
                    </button>
                ))}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-[#DFE1E6] bg-[#FAFBFC]">
                <div className="flex gap-1 bg-[#EBECF0] rounded-[3px] p-1">
                    {(['desktop', 'mobile'] as DeviceTab[]).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDeviceTab(d)}
                            className={`px-3 py-1.5 rounded-[3px] text-[11px] font-bold uppercase tracking-wide transition-colors flex items-center gap-1.5 ${deviceTab === d
                                ? 'bg-white text-[#0052CC] shadow-sm'
                                : 'text-[#5E6C84] hover:text-[#172B4D]'
                                }`}
                        >
                            {d === 'desktop' ? 'Desktop' : 'Mobile'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#7A869A]">
                    <span>Zoom</span>
                    <div className="flex items-center border border-[#DFE1E6] rounded-[3px] overflow-hidden bg-white">
                        <button
                            onClick={() => setZoom((z) => Math.max(25, z - 25))}
                            className="px-2 py-1 text-sm text-[#42526E] hover:bg-[#F4F5F7]"
                        >
                            -
                        </button>
                        <span className="px-3 py-1 text-xs font-semibold text-[#172B4D] border-x border-[#DFE1E6] min-w-[58px] text-center">
                            {zoom}%
                        </span>
                        <button
                            onClick={() => setZoom((z) => Math.min(200, z + 25))}
                            className="px-2 py-1 text-sm text-[#42526E] hover:bg-[#F4F5F7]"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>

            {previewTab === 'preview' ? (
                <div className="flex-1 overflow-auto bg-[#F4F5F7] p-6">
                    {isSvg ? (
                        <div className="h-full w-full bg-white border border-[#DFE1E6] rounded-[3px] flex items-start justify-center overflow-auto p-6">
                            <div
                                style={{
                                    transform: `scale(${zoom / 100})`,
                                    transformOrigin: 'top center',
                                    width: deviceTab === 'desktop' ? `${10000 / zoom}%` : '375px',
                                    maxWidth: deviceTab === 'desktop' ? undefined : '375px',
                                }}
                                dangerouslySetInnerHTML={{ __html: activeSvg }}
                            />
                        </div>
                    ) : (
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center min-h-[320px] text-[#5E6C84] text-sm">
                                    Cargando vista previa interactiva...
                                </div>
                            }
                        >
                            <HiFiSandpackPreview code={content} />
                        </Suspense>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-[#F4F5F7] p-6">
                    <div className="bg-white border border-[#DFE1E6] rounded-[3px] min-h-[460px] relative">
                        <button
                            onClick={() => navigator.clipboard.writeText(content)}
                            className="absolute top-3 right-3 text-[11px] text-[#5E6C84] bg-[#F4F5F7] border border-[#DFE1E6] rounded-[3px] px-3 py-1 hover:bg-white"
                        >
                            Copiar
                        </button>
                        <pre className="m-0 p-6 text-[13px] leading-7 text-[#172B4D] font-mono whitespace-pre-wrap">
                            {content}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}