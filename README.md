# Framework UX

**Checklist manual** (credenciales, deploy, smoke en prod): ver [ENTREGA.md](ENTREGA.md). **Vercel + Railway:** [docs/DEPLOY.md](docs/DEPLOY.md).

Tablero kanban propio (**To Do → WIP → Revisión → Hecho**) para llevar un kickoff desde la **transcripción de una reunión** hasta **tres wireframes HTML** de baja fidelidad, con gates de revisión en la misma aplicación. Sin integración con Jira.

La **transcripción** se obtiene **fuera** de esta app (Meet, Zoom, Fireflies, export de tu herramienta, etc.): copiás y pegás el texto o subís un archivo. **No hay grabación ni transcripción de audio** dentro de Framework UX.

## Flujo

1. **Transcripción (obligatoria al crear):** exportá o copiá el texto desde donde grabaste o transcribiste la conversación; **pegá el texto** o **subí** un `.txt` / `.md` / `.srt` / `.vtt` (multipart al crear, hasta 20 MB). No se puede crear una tarjeta solo con título. Podés seguir editando en el detalle. **Arrastrá** la tarjeta entre **To Do** y **WIP** mientras está en paso transcripción.
2. **Generar spec** (Gemini): pasa a columna Revisión — **Gate 1**: podés **editar el spec a mano** y guardar; al aprobar se persiste la última versión antes de generar wireframes. En Gate 1 podés usar **Editar**, **Vista previa** (Markdown) o **Dividido** (dos columnas en pantallas anchas). Si la generación falla y el flujo vuelve atrás, el **último error** queda guardado en la tarjeta y se muestra en el detalle (se limpia al tener una generación exitosa o al completar el flujo). En **cualquier paso después de transcripción** el detalle incluye **Ver transcripción original** (solo lectura y copiar al portapapeles).
3. Tras aprobar el spec: se generan **3 opciones** de wireframe — **Gate 2**.
4. Tras aprobar wireframes: **Gate 3** (stakeholders); al aprobar, la tarjeta va a **Hecho**.

## Requisitos

- Node.js 18+
- Cuenta [Turso](https://turso.tech/) (o `TURSO_DATABASE_URL=file:local.db` sin token para desarrollo local)
- API key [Google AI Studio](https://aistudio.google.com/) (Gemini)

Plantilla unificada: copiá `.env.example` en la raíz del repo a `backend/.env` y `frontend/.env` según corresponda (sin variables de Jira).

## Variables de entorno (`backend/.env`)

| Variable | Descripción |
|----------|-------------|
| `GEMINI_API_KEY` | Obligatoria |
| `GEMINI_MODEL` | Opcional (ej. `gemini-2.5-flash`) |
| `TURSO_DATABASE_URL` | URL LibSQL (ej. `file:local.db` o Turso) |
| `TURSO_AUTH_TOKEN` | Token Turso (vacío si usás solo `file:` local) |
| `PORT` | Backend (default `3001`) |
| `FRONTEND_URL` | Origen CORS (default `http://localhost:5173`) |
| `TRUST_PROXY` | `1` o `true` detrás de reverse proxy (IP real + rate limit) |
| `RATE_LIMIT_WINDOW_MS` | Ventana del rate limit en `/api` en ms (default `900000` = 15 min) |
| `RATE_LIMIT_MAX` | Máx. solicitudes por IP por ventana (default `600`) |
| `JWT_SECRET` | Firma del JWT de sesión (obligatorio en producción, mín. 16 caracteres) |
| `GOOGLE_CLIENT_ID` | Client ID OAuth Web de Google (verificación del ID token del front) |
| `ALLOWED_EMAILS` | Opcional: emails permitidos separados por comas (si no vacío, tienen prioridad sobre dominio) |
| `ALLOWED_EMAIL_DOMAIN` | Opcional: ej. `@empresa.com` — el email debe terminar así |
| `AUTH_DISABLED` | Solo desarrollo: `1` o `true` omite Google y usa sesión fija en el API (prohibido si `NODE_ENV=production`) |
| `JWT_EXPIRES_DAYS` | Opcional: validez de la cookie (1–30, default 7) |

Frontend (`frontend/.env` opcional):

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | Default `http://localhost:3001` |
| `VITE_GOOGLE_CLIENT_ID` | Mismo Client ID que `GOOGLE_CLIENT_ID` del backend (botón de inicio de sesión) |
| `VITE_AUTH_DISABLED` | Opcional: muestra entrada sin Google si el backend tiene `AUTH_DISABLED` |

## Cómo correr

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (otra terminal)
cd frontend && npm install && npm run dev
```

Abrir el front (típicamente `http://localhost:5173`).

Tipos TypeScript (opcional): `cd backend && npm run typecheck` y `cd frontend && npm run typecheck`.

En el tablero podés **filtrar por columna** (To Do, WIP, etc.; se guarda en la sesión del navegador junto con búsqueda y orden), **buscar por título o por texto de la transcripción**, usar **`/`** para enfocar la búsqueda y **limpiar filtros** de un clic. En tarjetas **completadas**, el detalle permite volver a ver las **tres opciones de wireframe** guardadas.

## API (resumen)

- **`/api/cards`** requiere **sesión** (cookie `fx_session`); el front debe usar `fetch` con `credentials: 'include'`. **`POST /api/auth/google`** (body JSON `{ credential }` con el ID token de Google, o `{}` si el backend tiene `AUTH_DISABLED`), **`POST /api/auth/logout`**, **`GET /api/auth/me`** son públicas.
- Las rutas bajo `/api` tienen **límite de frecuencia** por IP (por defecto 600 req / 15 min por proceso; configurable con `RATE_LIMIT_MAX` y `RATE_LIMIT_WINDOW_MS`); si se excede, `429` con JSON `{ error }` y cabecera `Retry-After`. Respuestas bajo `/api` pueden incluir `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (expuestas vía CORS). `/health` no cuenta.
- `POST /api/cards/:id/duplicate` — nueva tarjeta en transcripción con el mismo texto (título `… (copia)`)
- `POST /api/cards/:id/unlock-generation` — si `is_generating` quedó en 1, vuelve a `transcript` o `gate_spec` según el paso (solo `spec_generating` / `wireframes_generating`)
- `POST /api/cards/:id/clear-generation-error` — pone `last_generation_error` en `NULL` (la UI también puede ocultar el aviso solo en el navegador)
- `GET /health` — `200` si la base responde (`database: ok`); `503` si falla el ping SQL (`database: error`). Incluye `service`, `version` (desde `backend/package.json`) y `timestamp` ISO.
- `DELETE /api/cards/:id` — elimina tarjeta y wireframes (no si `is_generating`)
- `PATCH /api/cards/:id` — JSON `{ title }` (renombrar en cualquier paso)
- `POST /api/cards` — JSON `{ title, transcript }` (`transcript` con texto no vacío)
- `POST /api/cards/upload` — `multipart/form-data`: `title`, y transcripción vía `transcript` (texto) y/o `transcript_file` (al menos una con contenido)
- `GET /api/cards`, `GET /api/cards/:id`
- `GET /api/cards/:id/export` — descarga JSON (spec, wireframes, metadatos); `Content-Disposition` con nombre `framework-ux-{título-slug}-{id8}.json` (ASCII seguro)
- `PATCH /api/cards/:id/column` — `{ column: "todo" | "wip" }` (solo en paso `transcript`)
- `PATCH /api/cards/:id/transcript`
- `PATCH /api/cards/:id/transcript/file` — `multipart`, campo `transcript_file` (solo paso `transcript`)
- `PATCH /api/cards/:id/spec` — body `{ spec_markdown }` (solo en paso `gate_spec`)
- `POST /api/cards/:id/run-spec`
- `POST /api/cards/:id/gate-spec/approve` | `.../reject` + `{ comment }`
- `POST /api/cards/:id/gate-wireframes/approve` + `{ selected_option?, comment? }` | `.../reject` + `{ comment }`
- `POST /api/cards/:id/gate-stakeholder/approve` | `.../reject` + `{ comment, restart_from }`

## Scripts de desarrollo

Desde `backend/`: `npm run test-gemini`, `npm run db-dump`. Ver [backend/scripts/README.md](backend/scripts/README.md).

## CI (GitHub Actions)

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) ejecuta `npm run typecheck` y **`npm run build`** en **backend** y **frontend** en cada push/PR a `main` o `master`.

## Limitación MVP

El trabajo no se sincroniza con Jira ni Confluence; podés **exportar JSON** desde el detalle de la tarjeta o copiar el spec a mano. La entrada es **texto de transcripción** (pegado o archivo), no audio en la app.

## Nota sobre el pipeline MUI de 3 niveles

El código histórico de generación **wireframe → mid-fi SVG → TSX MUI** sigue en [backend/src/prompts/system-prompt.ts](backend/src/prompts/system-prompt.ts) y [backend/src/services/llm.service.ts](backend/src/services/llm.service.ts) (`generateDesign`), pero **no forma parte del flujo del tablero** actual.
