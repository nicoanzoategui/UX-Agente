import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config, REPO_ROOT } from '../config/env.js';
import type { WireframeOptionParsed } from './llm.service.js';

function truncate(s: string, max: number): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}\n\n[…contenido truncado por límite de prompt…]`;
}

function buildHifiPrompt(
    specMarkdown: string,
    low: { title: string; description: string; html: string }
): string {
    return `Sos el paso final de un flujo de producto (kickoff → spec → wireframe baja → esta pantalla en alta fidelidad).

## Instrucciones
- Generá UNA interfaz principal alineada al spec, en español donde haya copy de usuario.
- El HTML de baja fidelidad es solo referencia de flujo, jerarquía e información: mejorá fuerte la presentación (Tailwind, espaciado, tipografía).
- No inventes funcionalidades que no estén en el spec.

## Spec de producto

${truncate(specMarkdown, 14_000)}

---

## Wireframe de baja fidelidad elegido

**Título:** ${low.title || '(sin título)'}
**Descripción:** ${low.description || '(sin descripción)'}

**HTML de referencia:**

${truncate(low.html, 10_000)}
`;
}

async function readLatestDesignHtml(outDir: string): Promise<string> {
    const latestPath = join(outDir, 'latest.json');
    try {
        const raw = await readFile(latestPath, 'utf-8');
        const j = JSON.parse(raw) as { run_id?: string };
        if (j.run_id) {
            const p = join(outDir, 'runs', j.run_id, 'design.html');
            return await readFile(p, 'utf-8');
        }
    } catch {
        /* seguir */
    }

    const runsDir = join(outDir, 'runs');
    const entries = await readdir(runsDir, { withFileTypes: true }).catch(() => []);
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse();
    for (const d of dirs) {
        try {
            return await readFile(join(runsDir, d, 'design.html'), 'utf-8');
        } catch {
            continue;
        }
    }

    throw new Error('No se encontró design.html en .aidesigner/runs tras ejecutar el CLI.');
}

function runGenerateCli(prompt: string, outDir: string): Promise<{ code: number; stderr: string }> {
    const env: NodeJS.ProcessEnv = { ...process.env, AIDESIGNER_BASE_URL: config.AIDESIGNER_BASE_URL };
    if (config.AIDESIGNER_API_KEY) {
        env.AIDESIGNER_API_KEY = config.AIDESIGNER_API_KEY;
    }
    if (config.AIDESIGNER_MCP_ACCESS_TOKEN) {
        env.AIDESIGNER_MCP_ACCESS_TOKEN = config.AIDESIGNER_MCP_ACCESS_TOKEN;
    }

    const args = [
        '-y',
        '@aidesigner/agent-skills',
        'generate',
        '--prompt',
        prompt,
        '--viewport',
        config.HIFI_VIEWPORT,
        '--cwd',
        REPO_ROOT,
        '--out-dir',
        outDir,
    ];

    return new Promise((resolve, reject) => {
        const child = spawn('npx', args, {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
        });

        let stderr = '';
        child.stderr?.on('data', (c: Buffer) => {
            stderr += c.toString();
        });
        child.stdout?.on('data', () => {
            /* opcional: log */
        });

        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(
                new Error(
                    `AIDesigner: el CLI superó ${config.HIFI_AIDESIGNER_TIMEOUT_MS}ms. Revisá red, cuota o aumentá HIFI_AIDESIGNER_TIMEOUT_MS.`
                )
            );
        }, config.HIFI_AIDESIGNER_TIMEOUT_MS);

        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code: code ?? 1, stderr });
        });
    });
}

/**
 * Alta fidelidad vía [AIDesigner](https://www.aidesigner.ai/docs/mcp): mismo servicio que el MCP (`generate_design`),
 * invocado con el CLI (`generate`) desde el backend (Cursor MCP no es llamable desde Express).
 */
export async function generateHifiWireframeViaAIDesigner(
    specMarkdown: string,
    low: { title: string; description: string; html: string }
): Promise<WireframeOptionParsed[]> {
    if (!config.AIDESIGNER_API_KEY && !config.AIDESIGNER_MCP_ACCESS_TOKEN) {
        throw new Error(
            'HIFI_PROVIDER=aidesigner requiere AIDESIGNER_API_KEY o AIDESIGNER_MCP_ACCESS_TOKEN en backend/.env (ver documentación de AIDesigner).'
        );
    }

    const outDir = config.AIDESIGNER_OUT_DIR || join(REPO_ROOT, '.aidesigner');
    const prompt = buildHifiPrompt(specMarkdown, low);

    const { code, stderr } = await runGenerateCli(prompt, outDir);

    if (code !== 0) {
        const hint = stderr.trim() || '(sin stderr)';
        throw new Error(
            `AIDesigner CLI falló (código ${code}). ${hint.slice(0, 2000)}${hint.length > 2000 ? '…' : ''}`
        );
    }

    const html = (await readLatestDesignHtml(outDir)).trim();
    if (!html) {
        throw new Error('AIDesigner devolvió design.html vacío.');
    }

    return [
        {
            optionIndex: 1,
            title: 'Alta fidelidad (AIDesigner)',
            description: 'Generado con AIDesigner CLI (equivalente al tool generate_design del MCP).',
            html,
        },
    ];
}
