/**
 * Resultado del análisis post–Entendimiento (pantalla "Análisis del UX Agent" en la demo HTML).
 */

export const UNDERSTANDING_ANALYSIS_JSON_SCHEMA = `{
  "executiveSummary": "string (2-5 oraciones)",
  "contextSynthesis": "string (un párrafo que integre iniciativa, stakeholders y documentación)",
  "businessObjectives": ["string (objetivos de negocio / producto inferidos o explícitos en el contexto)"],
  "keyInsights": ["string"],
  "userPainPoints": ["string"],
  "opportunities": ["string"],
  "risksAndConstraints": ["string"],
  "openQuestions": ["string"],
  "suggestedFocusForIdeation": "string (qué priorizar en la ideación UX)"
}`;

export const UNDERSTANDING_ANALYSIS_SYSTEM = `Sos un lead de UX/producto. Analizás el contexto de una iniciativa para preparar la fase de ideación.

Reglas:
- Respondé siempre en español, tono profesional y claro.
- Basá el análisis en lo que recibís (texto, nombres de archivos listados, documentos e imágenes adjuntos).
- Si falta información, indicá supuestos explícitos en "openQuestions" o "risksAndConstraints" sin inventar datos de negocio concretos.
- No repitas literal largos fragmentos de los documentos; sintetizá.
- La salida debe ser ÚNICAMENTE un objeto JSON válido (sin markdown, sin comentarios) con exactamente estas claves:

${UNDERSTANDING_ANALYSIS_JSON_SCHEMA}`;

export function buildUnderstandingAnalysisUserPrompt(meta: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    notes: string;
    /** Archivos referenciados sin binario (solo metadatos). */
    fileManifest: { name: string; tag: string; sizeBytes?: number }[];
}): string {
    const lines: string[] = [
        '## Datos del formulario',
        `- Nombre de la iniciativa: ${meta.initiativeName || '(vacío)'}`,
        `- Ticket Jira: ${meta.jiraTicket || '(vacío)'}`,
        `- Squad / Producto: ${meta.squad || '(vacío)'}`,
        '',
        '## Notas y aspectos adicionales',
        meta.notes?.trim() || '(sin notas)',
        '',
    ];
    if (meta.fileManifest.length > 0) {
        lines.push('## Archivos listados (metadatos; el contenido puede estar adjunto por separado)');
        for (const f of meta.fileManifest) {
            const sz =
                typeof f.sizeBytes === 'number' ? ` — ~${Math.max(1, Math.round(f.sizeBytes / 1024))} KB` : '';
            lines.push(`- ${f.name} [${f.tag}]${sz}`);
        }
        lines.push('');
    }
    lines.push(
        '## Instrucción',
        'Devolvé solo el JSON con el esquema indicado en el system prompt.',
        'Incluí referencias breves a documentos o capturas cuando aporten (ej. "según el spec adjunto…") sin citar páginas inventadas.'
    );
    return lines.join('\n');
}
