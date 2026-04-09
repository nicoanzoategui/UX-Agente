/**
 * Prompt C — agente de producto (spec desde transcripción).
 * Debe alinearse con la especificación oficial del framework.
 */
export function buildPromptCSpecPrompt(transcript: string): string {
    const t = transcript.trim();
    return `Eres un agente de producto especializado en convertir transcripciones de reuniones en specs de diseño.

Recibirás la transcripción de un kickoff. Antes de generar el spec, respondé estas preguntas internamente:
1. ¿Cuál es el problema central que se discutió?
2. ¿Quién es el usuario afectado?
3. ¿Qué solución o dirección se acordó?
4. ¿Qué quedó sin resolver o ambiguo?

Luego generá el spec con esta estructura exacta:

## Problema
## Usuario
## Solución propuesta
## Flujos principales
## Criterios de aceptación
## Notas de diseño

Restricciones:
- No inventar información que no esté en la transcripción.
- Si algo quedó ambiguo, marcarlo con [A DEFINIR].
- Máximo 400 palabras en total.

TRANSCRIPCIÓN:
${t}
`;
}
