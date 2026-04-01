// backend/src/prompts/knowledge-base.ts

export const KNOWLEDGE_BASE = `
# KNOWLEDGE BASE UX/UI

## 1. PRINCIPIOS FUNDAMENTALES DE UX

### 1.1 Las 10 Heurísticas de Nielsen

1. **Visibilidad del estado del sistema**
   - Siempre mostrar qué está pasando
   - Feedback inmediato en cada acción
   - Indicadores de progreso para operaciones largas
   - Estados claros: loading, success, error

2. **Coincidencia entre el sistema y el mundo real**
   - Usar lenguaje del usuario, no técnico
   - Metáforas familiares (carrito de compras, carpetas)
   - Orden lógico y natural de la información

3. **Control y libertad del usuario**
   - Siempre ofrecer "salida de emergencia"
   - Deshacer y rehacer acciones
   - Cancelar operaciones en progreso
   - No atrapar al usuario en flujos sin salida

4. **Consistencia y estándares**
   - Misma acción = mismo resultado
   - Patrones reconocibles de la industria
   - Terminología consistente en toda la app

5. **Prevención de errores**
   - Mejor prevenir que curar
   - Confirmación antes de acciones destructivas
   - Validación en tiempo real
   - Deshabilitar opciones no disponibles

6. **Reconocer antes que recordar**
   - Minimizar carga cognitiva
   - Opciones visibles, no ocultas
   - Contexto siempre presente
   - Historial de acciones recientes

7. **Flexibilidad y eficiencia**
   - Atajos para usuarios expertos
   - Personalización cuando tenga sentido
   - Acciones frecuentes accesibles

8. **Diseño estético y minimalista**
   - Solo información relevante
   - Cada elemento debe ganarse su lugar
   - Jerarquía visual clara
   - Espacio en blanco como herramienta

9. **Ayudar a reconocer y recuperarse de errores**
   - Mensajes de error en lenguaje claro
   - Indicar el problema específico
   - Sugerir solución concreta

10. **Ayuda y documentación**
    - Fácil de buscar
    - Enfocada en la tarea del usuario
    - Pasos concretos y breves


### 1.2 Leyes de UX

**Ley de Fitts**: Tiempo = distancia/tamaño. Botones importantes = más grandes.
**Ley de Hick**: Más opciones = más tiempo. Reducir opciones.
**Ley de Jakob**: Usuarios prefieren lo que ya conocen.
**Ley de Miller**: 7±2 items en memoria. Agrupar información.
**Proximidad (Gestalt)**: Elementos cercanos = relacionados.
**Similitud (Gestalt)**: Elementos similares = relacionados.


## 2. PRINCIPIOS DE UI

### 2.1 Jerarquía Visual

Nivel 1: Título principal (24-32px, bold)
Nivel 2: Subtítulo (18-20px, semibold)
Nivel 3: Labels (16px, medium)
Nivel 4: Body (14-16px, regular)
Nivel 5: Caption (12-14px, secondary color)


### 2.2 Sistema de Espaciado (8px grid)

4px  - Micro (elementos muy relacionados)
8px  - Pequeño (padding interno)
16px - Base (gaps estándar)
24px - Medio (entre secciones relacionadas)
32px - Grande (entre secciones distintas)
48px - Extra (bloques principales)


### 2.3 Tipografía

Display:  48px / line-height 56px
H1:       32px / 40px
H2:       24px / 32px
H3:       20px / 28px
Body:     16px / 24px (1.5)
Small:    14px / 20px
Caption:  12px / 16px

Pesos: Regular (400), Medium (500), Semibold (600), Bold (700)
Máximo 2 familias tipográficas
Longitud de línea: 45-75 caracteres


### 2.4 Color

Primary:   Acción principal, links, CTAs
Secondary: Acciones secundarias
Neutral:   Texto, fondos, bordes (grises)
Success:   Confirmaciones (verde)
Warning:   Alertas (amarillo/naranja)
Error:     Errores (rojo)
Info:      Información (azul)

Reglas:
- Primary solo para 1-2 acciones por pantalla
- Neutral para 80% de la UI
- Nunca solo color para comunicar


### 2.5 Accesibilidad

Contraste texto normal: ≥4.5:1
Contraste texto grande: ≥3:1
Touch targets: ≥44x44px mobile, ≥24x24px desktop
Espacio entre targets: ≥8px
Labels siempre visibles (no solo placeholder)
Focus visible siempre
No depender solo del color


## 3. COMPONENTES ESTÁNDAR

### 3.1 Navegación

**Header/Navbar**
- Logo izquierda (link a home)
- Nav principal centro o derecha
- Acciones usuario derecha
- Altura: 56-64px mobile, 64-80px desktop

**Bottom Navigation (Mobile)**
- Máximo 5 items
- Iconos + labels
- Altura: 56-64px

**Sidebar**
- Ancho: 240-280px
- Colapsable en mobile


### 3.2 Formularios

**Input de texto**
Estados: Default, Focus, Error, Disabled, Filled
- Label arriba (siempre visible)
- Placeholder como ayuda
- Helper text debajo
- Error message reemplaza helper

**Botones**
Jerarquía: Primary > Secondary > Tertiary > Ghost
Estados: Default, Hover, Active, Focus, Disabled, Loading
Tamaños: Small (32px), Medium (40px), Large (48px)

**Select/Dropdown**
- Búsqueda si >7 opciones
- Multi-select con chips
- Clear button si opcional

**Checkbox/Radio**
- Checkbox: múltiples opciones
- Radio: una sola opción
- Tamaño mínimo 20x20px
- Label clickeable


### 3.3 Feedback

**Toast/Snackbar**
- Mensajes temporales (3-5s)
- Posición consistente
- Dismissible

**Modal/Dialog**
- Decisiones importantes
- Overlay oscuro
- Cerrar con X, click fuera, ESC
- Botón primario derecha

**Empty State**
- Ilustración/icono
- Título explicativo
- CTA para resolver

**Loading**
- Skeleton para contenido
- Spinner para acciones
- Progress bar si hay progreso conocido

**Error State**
- Qué pasó
- Por qué
- Cómo resolverlo


### 3.4 Cards

- Container con borde o sombra
- Media arriba (opcional)
- Header: título + metadata
- Body: contenido
- Footer: acciones


## 4. PATRONES DE LAYOUT

### 4.1 Mobile First

Breakpoints:
- Mobile: 320-480px (diseñar primero)
- Tablet: 481-768px
- Desktop: 769-1024px
- Large: 1025-1440px

Contenido apilado en mobile, columnas en desktop


### 4.2 Contenedores

Max-widths:
- Texto: 680-720px
- Contenido: 1024-1200px
- Full con padding: 100% - 32px mobile, 100% - 64px desktop


### 4.3 Patrones de Página

**Landing Page**
1. Hero (propuesta + CTA)
2. Social proof
3. Features
4. How it works
5. Pricing
6. FAQ
7. Final CTA

**Dashboard**
1. Header
2. Sidebar (opcional)
3. Metrics/KPIs
4. Content

**Form/Wizard**
1. Progress indicator
2. Step title
3. Fields
4. Back + Next

**Lista/Catálogo**
1. Filters
2. Sort
3. Results count
4. Grid/List
5. Pagination


## 5. ESTADOS DE UI

Para CADA componente:
- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
- Success
- Empty
- Skeleton
- Selected
- Expanded/Collapsed


## 6. MICROCOPY

**Principios:**
- Claro sobre clever
- Breve y directo
- Voz activa
- Orientado a acción

**Ejemplos:**
Botones: "Crear cuenta" no "Submit"
Empty: "Todavía no tenés proyectos. Creá el primero."
Errores: "No pudimos guardar. Intentá de nuevo."
Loading: "Guardando cambios..." no "Cargando..."


## 7. DESIGN SYSTEMS DE REFERENCIA

### Material Design (Google)
- Elevation con sombras
- Motion principles
- Dense layouts para desktop

### Human Interface (Apple)
- Clarity, deference, depth
- SF Symbols
- Vibrancy y blur

### Fluent (Microsoft)
- Light, depth, motion
- Acrylic backgrounds

### Tailwind UI Patterns
- Utility-first
- Componentes pre-armados
- Dark mode built-in


## 8. PATRONES POR INDUSTRIA

### Fintech/Banca
- Confianza visual (azules, grises)
- Datos numéricos claros
- Seguridad visible (badges, locks)
- Confirmaciones dobles para transacciones

### E-commerce
- Imágenes grandes de producto
- Precio prominente
- CTA de compra siempre visible
- Trust badges
- Carrito accesible

### SaaS/Dashboards
- Data visualization
- Filtros y búsqueda
- Tables con acciones
- Empty states útiles





- Onboarding progresivo

### Healthcare
- Accesibilidad crítica
- Lenguaje claro
- Colores calmos
- Confirmaciones para acciones médicas

### Social/Content
- Feed infinito
- Engagement metrics
- Compose prominente
- Notificaciones


## 9. CHECKLIST PRE-DISEÑO

□ Objetivo claro del usuario
□ Criterios de aceptación
□ Flujo principal
□ Edge cases:
  □ ¿Vacío?
  □ ¿Error?
  □ ¿Demora?
  □ ¿Demasiados items?
  □ ¿Sin permisos?
□ Validaciones
□ Dependencias


## 10. CHECKLIST POST-DISEÑO

□ Jerarquía visual clara
□ Spacing consistente (múltiplos de 8)
□ Touch targets ≥44px
□ Contraste ≥4.5:1
□ Todos los estados
□ Empty state
□ Error state
□ Loading state
□ Mobile-first
□ Labels visibles
□ Acciones obvias
□ Forma de volver/cancelar
□ Feedback por acción
`;
