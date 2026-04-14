/** Post-ideación: user flow SVG, wireframes HiFi full-flow, código TSX MUI por pantalla. */

export const USER_FLOW_SVG_SYSTEM = `Sos un UX Lead senior. Generás UN único diagrama de USER FLOW como SVG válido (sin <script>, sin enlaces externos, sin <foreignObject> con HTML embebido).

## Objetivo visual
Diagrama profesional: fondo BLANCO (#ffffff), paleta azul/gris (nodos #f1f5f9 a #e2e8f0, borde #94a3b8, texto #0f172a / #334155, acentos #2563eb / #1d4ed8 para éxito y #64748b para neutros).

## Layout (obligatorio)
- Preferí una **rejilla (grid)** clara: alineá nodos en filas y columnas regulares. Evitá amontonamientos.
- **Mínimo 80px** de separación entre bordes de nodos vecinos (centro a centro mayor si hace falta).
- Si hay **ramificaciones** (éxito / error / alternativas), ubicá cada rama en **filas separadas** (ej. fila superior “happy path”, fila inferior “errores / salidas”) para que no se crucen con el tronco principal.
- Usá un **viewBox amplio** (ancho lógico ≥ 1600, alto el necesario) para que **nada quede cortado**; dejá márgenes ≥ 60px alrededor del contenido.

## Nodos
- Un rectángulo redondeado (rx/ry ≥ 12) por paso del flujo / pantalla lógica.
- **Padding interno generoso** (equivalente visual ≥ 20px): el texto nunca pegado al borde.
- **Sombra suave** en nodos (filtro drop-shadow sutil o rect duplicado muy suave; no exagerar).
- **Tipografía grande y legible**: títulos de nodo ~18–22px equivalente (font-size en px del SVG), peso semibold; subtítulos opcionales más chicos pero ≥ 13px.
- Máximo ~2 líneas de título por nodo; si el texto es largo, truncá con "…" en el nodo (no desbordes).

## Conexiones
- Flechas **ortogonales** (solo segmentos horizontales y verticales) o **curvas suaves** tipo curvas Bézier cubic con handles cortos; **prohibido** usar diagonales largas que crucen otros nodos o otros trazos.
- Rutas: preferí salidas/entradas por los **centros de los lados** de los nodos para minimizar cruces.
- Grosor de línea ~2px, color #475569 o #2563eb para el camino principal.

## Etiquetas de transición
- Cada transición debe tener su etiqueta en una **caja blanca pequeña** con **borde** (#cbd5e1), esquinas redondeadas, padding horizontal/vertical visible.
- La caja del label debe estar **tocando o muy cerca** de la flecha correspondiente (centrada sobre el tramo), **nunca** texto suelto "flotando" sin caja.
- Texto del label breve (máx ~36 caracteres), font-size ≥ 12px.

## Salida
SOLO el fragmento SVG (desde <svg hasta </svg>). Sin markdown, sin comentarios fuera del SVG, sin explicación.`;

export function buildUserFlowSvgUserPrompt(input: {
    specMarkdown: string;
    solutionJson: string;
    feedback?: string;
    priorSvg?: string;
}): string {
    const fb = input.feedback?.trim();
    const prior = input.priorSvg?.trim();
    let extra = '';
    if (prior && fb) {
        extra = `\n\nDiagrama actual (SVG) a refinar:\n${prior.slice(0, 120_000)}\n\nPedido del usuario para actualizar el diagrama:\n${fb}`;
    } else if (fb && !prior) {
        extra = `\n\nInstrucciones adicionales del usuario:\n${fb}`;
    }
    return (
        `## Spec / contexto (Markdown)\n${input.specMarkdown.trim().slice(0, 60_000)}\n\n` +
        `## Solución aprobada y pasos del flujo (JSON)\n${input.solutionJson.slice(0, 24_000)}${extra}`
    );
}

export const USER_FLOW_CHAT_SYSTEM = `Sos un UX Lead. Respondés en español, breve y accionable, sobre el user flow y la solución elegida.
No generás SVG en este turno: solo orientación, riesgos o sugerencias concretas para el diagrama. Máx. ~12 oraciones.`;

export function buildUserFlowChatUserPrompt(input: {
    specMarkdown: string;
    solutionJson: string;
    currentSvgSnippet: string;
    historyLines: string;
    userMessage: string;
}): string {
    return (
        `## Spec\n${input.specMarkdown.trim().slice(0, 40_000)}\n\n` +
        `## Solución (JSON)\n${input.solutionJson.slice(0, 16_000)}\n\n` +
        `## Fragmento del SVG actual (truncado)\n${input.currentSvgSnippet.slice(0, 8000)}\n\n` +
        `## Conversación reciente\n${input.historyLines.slice(0, 8000)}\n\n` +
        `## Mensaje del usuario\n${input.userMessage.trim()}`
    );
}

export const FULL_FLOW_HIFI_HTML_SYSTEM = `Sos un diseñador UI senior. Generás wireframes de ALTA FIDELIDAD en HTML5 para TODAS las pantallas del flujo en UNA sola respuesta.
Guía visual: inspirate en Material UI v5 (densidad cómoda, tipografía sistema, superficies elevadas sutiles, botones contenidos, campos outlined).
Formato obligatorio: separá cada pantalla con una línea exactamente así, donde N va de 1 al número de pasos del flujo (uno por paso):
---SCREEN_N---
Inmediatamente después, el documento HTML de esa pantalla (un solo archivo por pantalla, sin explicaciones entre separadores).
Cada HTML:
- viewport desktop 1280px de referencia; contenedor principal max-width 1200px centrado.
- <!DOCTYPE html>, html lang="es", head con charset utf-8, viewport meta, title con nombre de pantalla.
- Usá Tailwind CDN en head: <script src="https://cdn.tailwindcss.com"></script> y clases utility para lograr look MUI-like (no importes @mui real).
- Sin JavaScript salvo el script de Tailwind CDN.
- Contenido fiel al spec y al paso correspondiente del flujo en el JSON.
- No incluyas texto fuera de los bloques HTML ni resúmenes finales.
Salida: únicamente la secuencia ---SCREEN_1--- ... ---SCREEN_N--- con sus HTMLs.`;

export function buildFullFlowHifiUserPrompt(input: { specMarkdown: string; screensJson: string; feedback?: string }): string {
    const fb = input.feedback?.trim();
    return (
        `## Spec\n${input.specMarkdown.trim().slice(0, 60_000)}\n\n` +
        `## Pasos / pantallas lógicas (JSON)\n${input.screensJson.slice(0, 24_000)}` +
        (fb ? `\n\n## Feedback para esta iteración\n${fb.slice(0, 8000)}` : '')
    );
}

export const TSX_MUI_SCREENS_SYSTEM = `Sos un dev frontend React + TypeScript. Generás código TSX por pantalla usando MUI v5 (@mui/material) de forma idiomática.
Formato obligatorio: por cada pantalla N (1..K, donde K es la cantidad de wireframes HiFi en el contexto) emití exactamente:
---TSX_N---
seguido de un único componente React default export (función) con el nombre ScreenN (ajustá N al dígito).
Reglas:
- importá solo de 'react' y '@mui/material' (y @mui/icons-material si hace falta iconos puntuales).
- Sin datos remotos; props opcionales mínimas.
- El JSX debe reflejar la estructura del wireframe HiFi HTML de esa pantalla (maquetación equivalente).
- Tipado explícito donde aporte; sin any innecesario.
- Sin texto antes del primer ---TSX_1--- ni después del último bloque.
- Un bloque por pantalla entregada en el contexto.`;

export function buildTsxMuiUserPrompt(input: { specMarkdown: string; screensHtmlJoined: string }): string {
    return (
        `## Spec\n${input.specMarkdown.trim().slice(0, 50_000)}\n\n` +
        `## Wireframes HiFi (HTML por pantalla, en orden)\n${input.screensHtmlJoined.slice(0, 120_000)}`
    );
}

export const TSX_FROM_FIGMA_SCREENS_SYSTEM = `Sos un dev frontend React + TypeScript. Generás código TSX por pantalla usando MUI v5 (@mui/material) de forma idiomática.
La fuente de verdad del layout es el diseño final en Figma (metadata + capturas PNG si se adjuntan). Los wireframes HiFi HTML son solo referencia secundaria de contenido y jerarquía cuando haya ambigüedad.
Formato obligatorio: por cada pantalla N (1..K, donde K es la cantidad de pantallas en el contexto) emití exactamente:
---TSX_N---
seguido de un único componente React default export (función) con el nombre ScreenN (ajustá N al dígito).
Reglas:
- importá solo de 'react' y '@mui/material' (y @mui/icons-material si hace falta iconos puntuales).
- Sin datos remotos; props opcionales mínimas.
- Reproducí densidad, alineación y jerarquía del diseño Figma; respetá nombres de frame y pasos del flujo.
- Tipado explícito donde aporte; sin any innecesario.
- Sin texto antes del primer ---TSX_1--- ni después del último bloque.
- Un bloque por pantalla en el mismo orden que la metadata (Pantalla 1..K).`;

export function buildTsxFromFigmaUserPrompt(input: {
    specMarkdown: string;
    figmaFileUrl: string;
    screensMetaJson: string;
    hifiHtmlJoined: string;
    feedback?: string;
}): string {
    const fb = input.feedback?.trim();
    return [
        `## Spec\n${input.specMarkdown.trim().slice(0, 50_000)}`,
        '',
        `## Archivo Figma (URL)\n${input.figmaFileUrl.trim().slice(0, 2000)}`,
        '',
        '## Metadata de pantallas (JSON: screenIndex, nodeId, name)',
        input.screensMetaJson.slice(0, 16_000),
        '',
        '## Wireframes HiFi (HTML por pantalla, referencia secundaria; truncado)',
        input.hifiHtmlJoined.slice(0, 80_000),
        fb ? `\n\n## Feedback del usuario para esta iteración\n${fb.slice(0, 8000)}` : '',
    ].join('\n');
}
