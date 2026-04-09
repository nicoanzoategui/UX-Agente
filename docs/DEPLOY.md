# Despliegue: Vercel (frontend) + Railway (backend)

## Resumen

| Servicio  | Carpeta   | Rol                          |
|----------|-----------|------------------------------|
| **Vercel**  | `frontend/` | Build estático Vite (`dist`) |
| **Railway** | `backend/`  | Node: `npm run build` → `npm run start` |

La sesión usa cookie **httpOnly** con **SameSite=None** y **Secure** en producción para que el navegador la envíe desde el dominio de Vercel hacia la API en Railway.

## 1. Base de datos (producción)

En Railway el filesystem del contenedor no es persistente para datos locales. Creá una base **Turso** (u otra LibSQL) y definí:

- `TURSO_DATABASE_URL` = URL `libsql://…`
- `TURSO_AUTH_TOKEN` = token

Sin esto, el healthcheck puede pasar al inicio pero los datos no se conservan entre despliegues.

## 2. Railway (backend)

1. Nuevo proyecto → **Deploy from GitHub** (mismo repo).
2. **Root Directory**: `backend`.
3. **Variables** (mínimo):

| Variable | Ejemplo / notas |
|----------|------------------|
| `NODE_ENV` | `production` |
| `PORT` | Railway suele inyectarla; el código ya usa `process.env.PORT`. |
| `FRONTEND_URL` | URL pública del front, ej. `https://tu-app.vercel.app` (varias URLs separadas por coma). |
| `GEMINI_API_KEY` | API key de Google AI. |
| `JWT_SECRET` | ≥16 caracteres aleatorios. |
| `GOOGLE_CLIENT_ID` | Mismo Client ID OAuth Web que en Google Cloud. |
| `TURSO_DATABASE_URL` | `libsql://…` |
| `TURSO_AUTH_TOKEN` | Token Turso |

Opcional: `GEMINI_MODEL`, `ALLOWED_EMAILS`, `ALLOWED_EMAIL_DOMAIN`, `TRUST_PROXY=1` (si hace falta en otro hosting; con Railway suele bastar `RAILWAY_ENVIRONMENT` para trust proxy).

4. Tras el deploy, copiá la URL pública del servicio (ej. `https://tu-api.up.railway.app`).

`backend/railway.toml` define build (`npm install && npm run build`) y start (`npm run start`), y healthcheck en `/health`.

## 3. Vercel (frontend)

1. Importar el repo en Vercel.
2. **Root Directory**: `frontend`.
3. **Framework Preset**: Vite (o “Other” con build `npm run build`, output `dist`).
4. **Variables**:

| Variable | Valor |
|----------|--------|
| `VITE_API_URL` | URL HTTPS del backend en Railway (sin barra final). |
| `VITE_GOOGLE_CLIENT_ID` | Igual que `GOOGLE_CLIENT_ID` del backend. |

`frontend/vercel.json` incluye rewrites SPA para React Router.

## 4. Google OAuth

En [Google Cloud Console](https://console.cloud.google.com/) → Credenciales → cliente OAuth **Web**:

- **Orígenes de JavaScript autorizados**: `https://tu-dominio.vercel.app` (y previews si las usás).
- El flujo usa el botón de Google en el front; el backend valida el ID token con `GOOGLE_CLIENT_ID`.

## 5. Comprobar

- Backend: `GET https://tu-api/health` → `status: ok`, `database: ok`.
- Front: abrir la app, login con Google, navegar el flujo; en DevTools → Network, las llamadas a la API deben llevar `credentials` y la cookie `fx_session` en dominio del API.

## 6. GitHub Actions y workflows

Si al hacer `git push` falla por falta de permiso `workflow` en el token, o bien activá ese scope en el PAT, o subí el workflow después con SSH/credenciales con permiso.
