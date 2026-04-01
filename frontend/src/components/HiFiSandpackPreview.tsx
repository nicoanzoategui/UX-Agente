import React from 'react';
import {
    SandpackLayout,
    SandpackPreview,
    SandpackProvider,
} from '@codesandbox/sandpack-react';

function prepareAppTsx(raw: string): string {
    const t = raw.trim();
    if (!t) {
        return `import React from "react";
export default function App() {
  return <div style={{ padding: 32, color: '#666' }}>Sin código UI generado.</div>;
}`;
    }
    if (/export\s+default\s+function\s+App\b/.test(t)) return t;

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

type Props = { code: string };

const BASE_DEPS: Record<string, string> = {
    '@mui/material': '^5.15.0',
    '@mui/icons-material': '^5.15.0',
    '@emotion/react': '^11.11.0',
    '@emotion/styled': '^11.11.0',
    '@mui/x-data-grid': '^6.20.0',
    '@mui/lab': '^5.0.0-alpha.170',
    '@mui/x-date-pickers': '^6.20.0',
    dayjs: '^1.11.10',
};

function extractDependencies(code: string): Record<string, string> {
    const deps: Record<string, string> = {
        '@mui/material': BASE_DEPS['@mui/material'],
        '@emotion/react': BASE_DEPS['@emotion/react'],
        '@emotion/styled': BASE_DEPS['@emotion/styled'],
    };
    const matches = code.matchAll(/(?:from\s+|import\s+['"])([^'"]+)['"]/g);
    for (const m of matches) {
        const pkg = (m[1] || '').trim();
        if (!pkg || pkg.startsWith('.') || pkg.startsWith('/')) continue;
        const scope = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
        deps[scope] = BASE_DEPS[scope] || 'latest';
    }
    return deps;
}

export default function HiFiSandpackPreview({ code }: Props) {
    const appCode = prepareAppTsx(code);
    const dependencies = extractDependencies(appCode);

    return (
        <div className="hi-fi-sandpack rounded-[3px] overflow-hidden border border-[#DFE1E6] bg-white">
            <SandpackProvider
                template="react-ts"
                theme="light"
                files={{
                    '/App.tsx': appCode,
                    '/index.tsx': `import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";

const theme = createTheme();
const root = createRoot(document.getElementById("root")!);
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);`,
                }}
                customSetup={{
                    dependencies,
                }}
                options={{ initMode: 'immediate' }}
            >
                <SandpackLayout>
                    <SandpackPreview
                        showOpenInCodeSandbox={false}
                        showRefreshButton
                        style={{ minHeight: 'min(62vh, 600px)', height: '100%' }}
                    />
                </SandpackLayout>
            </SandpackProvider>
        </div>
    );
}