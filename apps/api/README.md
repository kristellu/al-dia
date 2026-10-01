# @al-dia/api — Backend

Cloudflare Pages Functions + D1. Este directorio es la **raíz del proyecto Pages**: aquí viven `wrangler.toml` y `functions/`. Los estáticos del frontend se copian de `../web/public` a `dist/` con `npm run build` (Cloudflare exige que la salida esté dentro de `apps/api`); `npm run deploy` lo hace automáticamente.

Ejecuta los comandos desde la raíz del monorepo (`npm run dev`, `npm run db:migrate`, `npm run user:create -- …`). Se delegan a este workspace, así que wrangler corre con `apps/api` como directorio actual.

## Contenido

| Ruta | Qué es |
|---|---|
| `wrangler.toml` | Proyecto Pages `al-dia`, binding `DB` → D1 `al-dia`, `migrations_dir`. |
| `functions/api/_middleware.js` | Antes de cada `/api/*`: anti-CSRF (`X-Requested-With: al-dia`), sesión, cambio de clave obligatorio y rol admin. |
| `functions/api/auth/` | `login`, `logout`, `me`, `password`. |
| `functions/api/state.js` | `GET /api/state`: todo el estado del usuario dentro de su ventana de retención (y purga lo antiguo). |
| `functions/api/sync.js` | `POST /api/sync`: aplica upserts y deletes por tabla, una sentencia por tipo (`json_each`). |
| `functions/api/admin/users/` | Administración de usuarios (`index.js`: listar y crear; `[id].js`: editar y eliminar). |
| `src/lib/` | `http` (respuestas JSON), `session` (cookies y tokens), `password` (PBKDF2), `sql`, `time` (retención), `validate`. |
| `migrations/` | Esquema D1 versionado. |
| `scripts/create-user.mjs` | Crea o restablece un usuario directamente en D1 (`--local` para la base de desarrollo). |

## Convenciones

- Para cambiar el esquema, crea `migrations/000N_descripcion.sql`. **Nunca** edites una migración ya aplicada.
- Toda tabla de negocio lleva `user_id` en la llave primaria y cada consulta filtra por el usuario de la sesión.
- La base local de desarrollo vive en `apps/api/.wrangler/` (ignorada por git). Los secretos locales, si se usan, van en `apps/api/.dev.vars`.
