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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Tabs principales: Vista previa / Código */}
            <div style={{ borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', gap: 0 }}>
                {(['preview', 'code'] as PreviewTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setPreviewTab(tab)}
                        style={{
                            padding: '10px 20px',
                            fontSize: 13,
                            fontWeight: previewTab === tab ? 600 : 400,
                            color: previewTab === tab ? '#0052CC' : '#5E6C84',
                            borderBottom: previewTab === tab ? '2px solid #0052CC' : '2px solid transparent',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {tab === 'preview' ? 'Vista previa' : 'Código'}
                    </button>
                ))}
            </div>

            {previewTab === 'preview' ? (
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                    {/* Panel izquierdo: preview */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border-tertiary)' }}>

                        {/* Sub-tabs Desktop / Mobile + Zoom */}
                        {isSvg && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--color-border-tertiary)', background: '#F4F5F7' }}>
                                <div style={{ display: 'flex', gap: 4, background: '#EBECF0', borderRadius: 4, padding: 2 }}>
                                    {(['desktop', 'mobile'] as DeviceTab[]).map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDeviceTab(d)}
                                            style={{
                                                padding: '4px 12px',
                                                fontSize: 12,
                                                fontWeight: deviceTab === d ? 600 : 400,
                                                color: deviceTab === d ? '#0052CC' : '#5E6C84',
                                                background: deviceTab === d ? '#fff' : 'transparent',
                                                border: 'none',
                                                borderRadius: 3,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}
                                        >
                                            {d === 'desktop' ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                                            )}
                                            {d === 'desktop' ? 'Desktop' : 'Mobile'}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5E6C84' }}>
                                    <span>Zoom</span>
                                    <button onClick={() => setZoom(z => Math.max(25, z - 25))} style={{ background: '#EBECF0', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 14 }}>−</button>
                                    <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>{zoom}%</span>
                                    <button onClick={() => setZoom(z => Math.min(200, z + 25))} style={{ background: '#EBECF0', border: 'none', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: 14 }}>+</button>
                                </div>
                            </div>
                        )}

                        {/* Contenido del preview */}
                        <div style={{ flex: 1, overflow: 'auto', background: '#F4F5F7', padding: 24, display: 'flex', justifyContent: 'center' }}>
                            {isSvg ? (
                                <div style={{
                                    background: '#fff',
                                    borderRadius: 4,
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                    overflow: 'hidden',
                                    width: deviceTab === 'desktop' ? '100%' : 375,
                                    maxWidth: deviceTab === 'desktop' ? '100%' : 375,
                                }}>
                                    <div style={{
                                        transform: `scale(${zoom / 100})`,
                                        transformOrigin: 'top left',
                                        width: `${10000 / zoom}%`,
                                    }}
                                        dangerouslySetInnerHTML={{ __html: deviceTab === 'desktop' ? desktopSvg : mobileSvg }}
                                    />
                                </div>
                            ) : (
                                <div style={{ width: '100%' }}>
                                    <Suspense fallback={
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, color: '#5E6C84', fontSize: 14 }}>
                                            Cargando vista previa interactiva...
                                        </div>
                                    }>
                                        <HiFiSandpackPreview code={content} />
                                    </Suspense>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panel derecho: código (siempre visible en split) */}
                    <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0D1117' }}>
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: '#8B949E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                                {isSvg ? 'SVG' : 'TSX'}
                            </span>
                            <button
                                onClick={() => navigator.clipboard.writeText(content)}
                                style={{ fontSize: 11, color: '#8B949E', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                            >
                                Copiar
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#E6EDF3', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {content}
                            </pre>
                        </div>
                    </div>
                </div>

            ) : (
                /* Tab Código — fullscreen */
                <div style={{ flex: 1, background: '#0D1117', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => navigator.clipboard.writeText(content)}
                            style={{ fontSize: 11, color: '#8B949E', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
                        >
                            Copiar código
                        </button>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                        <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#E6EDF3', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {content}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}