# Entrega Framework UX — checklist post-código

Este archivo lista lo que **no está automatizado en el repo**: credenciales, despliegue y verificaciones humanas. El código del tablero, API, UI y CI ya está listo para usarse en local o en producción una vez completás estos pasos.

## 1. Entorno local (primera vez)

1. **Node.js** 20 LTS (recomendado; mínimo 18).
2. En **`backend/`**: `npm ci` (o `npm install`).
3. En **`frontend/`**: `npm ci` (o `npm install`).
4. Copiá **`.env.example`** → **`backend/.env`** y **`frontend/.env`** (si usás URL de API distinta).
5. Completá variables (ver README):
   - `GEMINI_API_KEY` (Google AI Studio).
   - `TURSO_DATABASE_URL` y, si aplica, `TURSO_AUTH_TOKEN` (o `file:local.db` para SQLite local sin token).
   - `FRONTEND_URL` = URL exacta del front (en local suele ser `http://localhost:5173`); CORS y cookies de sesión dependen de que coincida con lo que abrís en el navegador.
   - **Auth:** `JWT_SECRET` (mín. 16 caracteres en prod), `GOOGLE_CLIENT_ID` (OAuth cliente Web), y `ALLOWED_EMAILS` o `ALLOWED_EMAIL_DOMAIN` si querés restringir cuentas. En el front: `VITE_GOOGLE_CLIENT_ID` igual al del backend. Para probar sin Google en local: `AUTH_DISABLED=1` en el backend y opcional `VITE_AUTH_DISABLED=1` en el front.
6. Arrancá backend: `cd backend && npm run dev`.
7. Arrancá frontend: `cd frontend && npm run dev`.
8. **Smoke test manual**: abrí el tablero, creá una tarjeta con transcripción de prueba, abrí el detalle y comprobá que `/health` en el backend responde `ok`.

## 2. Calidad de código (opcional pero recomendado)

En cada paquete:

```bash
cd backend && npm run typecheck && npm run build
cd frontend && npm run typecheck && npm run build
```

La **CI de GitHub Actions** (`.github/workflows/ci.yml`) hace typecheck + build en push/PR a `main` o `master`.

## 3. Producción (vos elegís el proveedor)

No hay despliegue fijado en el repo. Patrón habitual:

| Pieza | Qué configurar |
|--------|----------------|
| **Backend** | Servicio Node (Fly.io, Railway, Render, VPS, etc.). `npm run build` + `npm start` en `backend/`. Variable `PORT` si el host la inyecta. |
| **Base** | Misma `TURSO_DATABASE_URL` / token que en local, o instancia Turso dedicada a prod. Las tablas se crean al **primer arranque** del backend (`initDatabase`). |
| **Frontend** | Build estático: `cd frontend && npm run build` → servir `frontend/dist` (Vercel, Netlify, S3+CloudFront, nginx). |
| **`VITE_API_URL`** | En build del front, la URL **pública HTTPS** del API (ej. `https://api.tudominio.com`). Sin barra final. |
| **`FRONTEND_URL`** | En el backend, la URL **exacta** del front (origen CORS **y** cookies `SameSite`), ej. `https://app.tudominio.com`. |
| **Auth** | `JWT_SECRET`, `GOOGLE_CLIENT_ID`, allowlist (`ALLOWED_EMAILS` o `ALLOWED_EMAIL_DOMAIN`). En build del front: `VITE_GOOGLE_CLIENT_ID`. `NODE_ENV=production` valida esto al arrancar y **no** permite `AUTH_DISABLED`. |
| **Proxy** | Si el cliente ve otro host que el que ve Node, poné `TRUST_PROXY=1` en el backend. |
| **HTTPS** | Obligatorio en prod para clipboard, cookies futuras y buenas prácticas. |

Después del deploy: probá crear tarjeta, generar spec (consume cuota Gemini) y revisar gates.

## 4. Costos y cuotas

- **Gemini**: revisá límites y facturación en Google AI / Vertex según uses.
- **Turso**: plan y límites según tu cuenta.

## 5. Seguridad

- Las rutas **`/api/cards`** exigen sesión (cookie JWT tras login con Google, o sesión fija si usás **`AUTH_DISABLED`** solo en desarrollo). **`/health`** y **`/api/auth/*`** (login, logout, me) son las excepciones públicas necesarias.
- En producción configurá **HTTPS** para que la cookie `fx_session` vaya con `Secure`.
- Rotá `GEMINI_API_KEY`, `JWT_SECRET` y tokens si se filtran.
- El rate limit del API es **por IP en memoria** (un solo proceso; default 600 solicitudes / 15 min). Ajustalo con **`RATE_LIMIT_MAX`** y **`RATE_LIMIT_WINDOW_MS`** en `backend/.env`. En múltiples réplicas cada instancia cuenta aparte.

## 6. Mantenimiento que te puede tocar

- Actualizar **`GEMINI_MODEL`** si Google depreca un modelo.
- Subir versiones en `backend/package.json` y `frontend/package.json` cuando hagas releases (el pie del front y `/health` leen versión del backend desde su `package.json`).
- Revisar logs del backend ante fallos de generación LLM.

---

**Resumen:** el código asume que vos proveés `.env` (incluida auth en prod), base Turso/local, key de Gemini y el hosting del front + API. Cuando eso esté hecho, el flujo kanban → spec → wireframes → gates funciona end-to-end.
