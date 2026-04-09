/**
 * Prototipo baja fidelidad (6 pantallas) alineado a la solución elegida y a la iteración por chat.
 */

export const PROTOTYPE_FLOW_SYSTEM = `Sos el UX Agent. Generás la especificación de un prototipo móvil de BAJA FIDELIDAD en español: exactamente 6 pantallas en flujo lineal.

Reglas:
- Las 6 pantallas deben reflejar la solución elegida (pasos, tono, dominio del problema) y, si hay conversación de iteración, incorporar explícitamente esos cambios (p. ej. validación por celular, menos pasos, etc.).
- Si recibís un prototipo actual y pedidos de cambio sobre pantallas, generá un reemplazo completo de 6 pantallas coherente con la solución y esos pedidos.
- Cada pantalla es una vista concreta del flujo; no repitas el mismo contenido en todas.
- Tono claro para usuario final; textos cortos.
- Salida: SOLO JSON válido, sin markdown. Raíz: { "summaryLine": string, "estimatedTimeLabel": string, "flowType": string, "screens": array }.
- "summaryLine": una línea (máx ~140 caracteres) que resume el flujo prototipado para mostrar en UI.
- "estimatedTimeLabel": estimación breve para completar el flujo (ej. "~2 min", "~3–4 min") según complejidad real de las 6 pantallas.
- "flowType": etiqueta corta del flujo (ej. "Lineal", "Con validación", "Onboarding", "Con confirmación") según el contenido generado.
- "screens": array de exactamente 6 objetos con:
  - "title": string (obligatorio)
  - "subtitle": string opcional
  - "bullets": array de strings opcional (2–5 ítems si aplica)
  - "note": string opcional (mensaje tipo aviso / ayuda breve)
  - "cta": string opcional (texto del botón principal; si falta, la UI usará "Continuar")
- La última pantalla suele ser confirmación o éxito; su "cta" puede ser "Ir al inicio" o similar.`;

export function buildPrototypeFlowUserPrompt(payload: {
    initiativeName: string;
    jiraTicket: string;
    squad: string;
    analysisJson: string;
    solutionJson: string;
    iterationTranscript: string;
    existingScreensJson?: string;
    prototypeIterationTranscript?: string;
}): string {
    const hasRegen =
        Boolean(payload.existingScreensJson?.trim()) || Boolean(payload.prototypeIterationTranscript?.trim());
    const lines: string[] = [
        '## Iniciativa',
        `- Nombre: ${payload.initiativeName}`,
        `- Jira: ${payload.jiraTicket || '(vacío)'}`,
        `- Squad: ${payload.squad || '(vacío)'}`,
        '',
        '## Análisis de contexto (JSON; fragmento)',
        payload.analysisJson.slice(0, 12_000),
        '',
        '## Solución elegida (JSON completo: title, flowSteps, howItSolves, expectedImpact)',
        payload.solutionJson.slice(0, 8000),
        '',
        '## Conversación de iteración sobre la SOLUCIÓN (ideación; si está vacía, ignorar)',
        payload.iterationTranscript.trim() || '(sin iteración de solución)',
    ];
    if (hasRegen) {
        lines.push(
            '',
            '## Prototipo actual (JSON: 6 pantallas; reemplazalo por uno nuevo coherente con los pedidos)',
            payload.existingScreensJson?.trim() || '[]',
            '',
            '## Pedidos del usuario sobre el PROTOTIPO / wireframes (conversación)',
            payload.prototypeIterationTranscript?.trim() || '(sin pedidos explícitos)',
            '',
            'Generá un JSON NUEVO completo: summaryLine, estimatedTimeLabel, flowType y screens (6 elementos). Incorporá los cambios pedidos sobre pantallas, textos o flujo.'
        );
    } else {
        lines.push(
            '',
            'Generá el JSON con summaryLine, estimatedTimeLabel, flowType y screens (6 elementos) según el system prompt.'
        );
    }
    return lines.join('\n');
}

export const PROTOTYPE_ITERATION_SYSTEM = `Sos el UX Agent. Ayudás a iterar un prototipo de baja fidelidad (6 pantallas) conversando en español.

Reglas:
- Respondé de forma breve y concreta (2–6 oraciones o viñetas).
- Referenciá pantallas por número (1–6) o por título cuando el usuario lo mencione.
- Si el pedido es ambiguo, pedí una aclaración corta o proponé una interpretación razonable.
- No generés el JSON del prototipo aquí; solo orientación y acuerdos para luego regenerar.`;

export function buildPrototypeIterationUserPrompt(payload: {
    initiativeName: string;
    solutionJson: string;
    screensJson: string;
    conversationSnippet: string;
    userMessage: string;
}): string {
    return [
        '## Iniciativa',
        payload.initiativeName,
        '',
        '## Solución asociada al prototipo (JSON)',
        payload.solutionJson.slice(0, 6000),
        '',
        '## Prototipo actual (6 pantallas, JSON)',
        payload.screensJson.slice(0, 12_000),
        '',
        '## Historial reciente',
        payload.conversationSnippet || '(inicio)',
        '',
        '## Mensaje del usuario',
        payload.userMessage,
    ].join('\n');
}
