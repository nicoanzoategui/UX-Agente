import {
    SandpackCodeEditor,
    SandpackLayout,
    SandpackPreview,
    SandpackProvider,
} from '@codesandbox/sandpack-react';

function prepareAppTsx(raw: string): string {
    const t = raw.trim();
    if (!t) {
        return `import React from "react";
export default function App() {
  return <div className="p-8 text-slate-500 font-sans">Sin código UI generado.</div>;
}`;
    }
    // Sandpack template "react-ts" espera default export `App`. El LLM suele devolver otro nombre (p. ej. ProfileSection).
    if (/export\s+default\s+function\s+App\b/.test(t)) {
        return t;
    }
    const namedDefault = t.match(/export\s+default\s+function\s+(\w+)\s*\(/);
    if (namedDefault) {
        const comp = namedDefault[1];
        const body = t.replace(
            new RegExp(`export\\s+default\\s+function\\s+${comp}\\b`),
            `function ${comp}`
        );
        return `${body}\n\nexport default function App() {\n  return <${comp} />;\n}\n`;
    }
    return t;
}

type Props = {
    code: string;
};

/**
 * Ejecuta el TSX del nivel 3 en un sandbox (Tailwind vía CDN). Requiere export default del componente principal.
 */
export default function HiFiSandpackPreview({ code }: Props) {
    const appCode = prepareAppTsx(code);

    return (
        <div className="hi-fi-sandpack rounded-[3px] overflow-hidden border border-[#DFE1E6] bg-white">
            <SandpackProvider
                template="react-ts"
                theme="light"
                files={{ '/App.tsx': appCode }}
                options={{
                    externalResources: ['https://cdn.tailwindcss.com'],
                }}
                initMode="immediate"
            >
                <SandpackLayout>
                    <SandpackPreview
                        showOpenInCodeSandbox={false}
                        showRefreshButton
                        style={{ minHeight: 'min(62vh, 600px)', height: '100%' }}
                    />
                    <SandpackCodeEditor
                        showTabs={false}
                        showLineNumbers={false}
                        style={{ minHeight: 160, maxHeight: 220 }}
                    />
                </SandpackLayout>
            </SandpackProvider>
        </div>
    );
}
