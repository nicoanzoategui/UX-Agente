/**
 * Ideación: 3 propuestas de solución a partir del análisis de contexto.
 */

export const IDEATION_SOLUTIONS_SYSTEM = `Sos el UX Agent. Generás exactamente 3 propuestas de solución UX distintas, en español, basadas en el análisis de contexto JSON que recibís.

Reglas:
- Las 3 soluciones deben ser enfoques diferentes (p. ej. progresivo vs diferido vs asistido).
- La primera solución debe ser la más alineada al contexto; marcala con recommendedByAi: true.
- Títulos con prefijo "Solución 1:", "Solución 2:", "Solución 3:" en el campo title.
- flowSteps: 5 a 8 pasos cada una, redactados como en wireframes de producto (orden de pantallas o hitos).
- howItSolves y expectedImpact: 3 ítems cada uno, sin prefijo "•" en el string (la UI agrega viñetas).
- Salida: SOLO JSON válido, sin markdown, con la clave raíz "solutions" (array de 3 objetos).

Esquema por solución:
{
  "title": "string",
  "recommendedByAi": boolean,
  "flowSteps": ["string"],
  "howItSolves": ["string"],
  "expectedImpact": ["string"]
}`;

export function buildIdeationUserPrompt(payload: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    analysisJson: string;
}): string {
    return [
        '## Iniciativa',
        `- Nombre: ${payload.initiativeName}`,
        `- Jira: ${payload.jiraTicket || '(vacío)'}`,
        `- Squad: ${payload.squad || '(vacío)'}`,
        '',
        '## Análisis de contexto (JSON)',
        payload.analysisJson,
        '',
        'Generá el JSON con solutions (3 elementos) según el system prompt.',
    ].join('\n');
}

export const SOLUTION_ITERATION_SYSTEM = `Sos el UX Agent. Ayudás a iterar una propuesta de solución UX conversando en español.

Reglas:
- Respondé de forma breve pero concreta (2–6 oraciones o viñetas cortas).
- Si el usuario pide cambios al flujo, proponé ajustes claros (pasos, pantallas, mensajes).
- No inventés métricas exactas sin base en el contexto; podés hablar de impacto cualitativo.
- Mantené tono profesional y empático.`;

export function buildIterationUserPrompt(ctx: {
    solutionTitle: string;
    initiativeName: string;
    analysisSummary: string;
    conversationSnippet: string;
    userMessage: string;
}): string {
    return [
        '## Contexto de iniciativa',
        ctx.initiativeName,
        '',
        '## Resumen del análisis',
        ctx.analysisSummary.slice(0, 8000),
        '',
        '## Solución que se está iterando',
        ctx.solutionTitle,
        '',
        '## Historial reciente (últimos turnos)',
        ctx.conversationSnippet || '(inicio de conversación)',
        '',
        '## Mensaje del usuario',
        ctx.userMessage,
    ].join('\n');
}
