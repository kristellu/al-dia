# Al día — finanzas personales por quincena

Aplicación web para saber tres cosas sin llevar contabilidad: **cuánto tengo disponible**, **qué tengo que pagar** y **si mis finanzas están mejorando**.

Funciona completa dentro del **plan gratuito de Cloudflare**: Pages (sitio), Pages Functions (API) y D1 (base de datos SQLite).

## Arquitectura

```
Navegador ──HTTPS──► Cloudflare Pages (un solo proyecto "al-dia")
  apps/web/public  (HTML, CSS, módulos JS)   └─ apps/api/functions/api/*  (Pages Functions)
  Lectura local de PDF (pdf.js)                      └─ D1 "db-aldia" (SQLite)
```

Es un monorepo con **npm workspaces** y dos aplicaciones que se despliegan juntas: `apps/api` contiene el `wrangler.toml` y las Functions, y publica como estáticos la carpeta `apps/web/public`.

| Aspecto | Decisión |
|---|---|
| Frontend | `apps/web`. HTML + CSS + módulos ES nativos, sin framework ni build. Lee PDF en el navegador; los archivos nunca se suben. |
| API | `apps/api`. Pages Functions en `functions/api`. Librerías compartidas en `src/lib`. |
| Base de datos | D1, esquema versionado en `apps/api/migrations/`. |
| Autenticación | Usuario y contraseña. Hash PBKDF2-SHA256 con sal; sesión en cookie `HttpOnly; Secure; SameSite=Strict`; en la base solo se guarda el hash del token. |
| Protección | Bloqueo de 15 min tras 5 intentos fallidos; cabecera anti-CSRF obligatoria; CSP estricta (`apps/web/public/_headers`); cambio de contraseña obligatorio para claves temporales. |
| Retención | Por usuario (`users.retention_months`, por defecto **4**: mes actual y 3 anteriores). Lo más antiguo se borra automáticamente al cargar los datos y la API rechaza escrituras fuera de la ventana. |
| Sincronización | El navegador envía solo las filas que cambiaron. Cada tipo de dato se escribe con **una** sentencia (`json_each`), así que una sincronización usa ≈10 consultas (el plan gratuito permite 50 por invocación). |

## Estructura del repositorio

```
al-dia/
├── apps/
│   ├── web/                       Frontend (@al-dia/web)
│   │   └── public/                Lo que se publica: index.html, styles.css, _headers, vendor/, js/
│   │       └── js/                main.js (entrada) + core/ state/ services/ domain/ ui/ views/ forms/ documents/
│   └── api/                       Backend (@al-dia/api)
│       ├── wrangler.toml          Proyecto Pages + binding D1 (publica dist/, copia de ../web/public)
│       ├── functions/api/         Rutas de la API (Pages Functions)
│       ├── src/lib/               Librerías del servidor (HTTP, sesión, contraseñas, SQL, validación)
│       ├── migrations/            Esquema D1 versionado
│       └── scripts/               create-user.mjs
├── scripts/check.mjs              Sintaxis + importaciones del frontend
├── eslint.config.js               Detección de identificadores no definidos
└── package.json                   Workspaces y comandos (delegan en cada app)
```

Todos los comandos se ejecutan desde la **raíz**; internamente se delegan al workspace que corresponde. Cada app tiene su propio README con el detalle: [apps/web](apps/web/README.md) · [apps/api](apps/api/README.md).

## Modelo de datos

```
users ─┬─< sessions
       ├─< categories            (nombre, orden, presupuesto)
       ├─< months ──< movements  (ingresos y gastos)
       └─< debts  ──< debt_balances (saldo por mes)
```

| Tabla | Llave | Contenido |
|---|---|---|
| `users` | `id` | Usuario, nombre, hash, **rol** (`admin`/`user`), **activo**, **meses de retención**, cambio de clave obligatorio, intentos fallidos, bloqueo, último ingreso. |
| `sessions` | `token_hash` | Sesiones activas (14 días, renovación automática). |
| `categories` | `user_id + name` | Categorías de gasto, orden y presupuesto mensual opcional. |
| `months` | `user_id + month` | Mes financiero (`YYYY-MM`), si está cerrado y la fotografía del cierre. |
| `movements` | `user_id + id` | Ingresos (`kind='ingreso'`) y gastos (`kind='gasto'`): valor, categoría, día, quincena, estado, recurrente, observación. En nómina guarda devengado y deducciones como dato informativo. |
| `debts` | `user_id + id` | Tarjetas y créditos. **Solo últimos 4 dígitos** (restricción en la base). |
| `debt_balances` | `user_id + debt_id + month` | Saldo, pago mínimo y total, fecha límite, tasa E.A., cupo. |

Convenciones: montos en pesos como `INTEGER`; meses `YYYY-MM`; fechas ISO; todas las tablas de negocio incluyen `user_id` en la llave, de modo que un usuario no puede tocar filas de otro.

Para cambiar el esquema, agrega un archivo nuevo (`apps/api/migrations/0002_lo-que-cambia.sql`) y nunca edites uno ya aplicado.

## Puesta en marcha

Requisitos: Node 20+ y una cuenta gratuita de Cloudflare.

```bash
npm install
npx wrangler login
```

### 1. Crear la base de datos

```bash
npm run db:create
```

Copia el `database_id` que aparece y pégalo en `apps/api/wrangler.toml`.

```bash
npm run db:migrate
```

### 2. Crear tu usuario administrador

```bash
npm run user:create -- --username kristell --name "Kristell" --role admin
```

Te pedirá la contraseña (mínimo 10 caracteres, con letras y números) sin mostrarla en pantalla. El mismo comando sirve para restablecer la contraseña de cualquier usuario si alguna vez quedas por fuera.

### 3. Desplegar

**Opción A — Manual (recomendada).** `npm run deploy`. Despliega desde `apps/api` las Functions junto con los estáticos de `apps/web/public`. Antes, si hay migraciones nuevas, ejecuta `npm run db:migrate`.

**Opción B — GitHub Actions.** Pendiente: el workflow `.github/workflows/deploy.yml` aún no existe en el repositorio. Cuando se cree, debe ejecutar `npm ci`, `npm run db:migrate` y `npm run deploy` desde la raíz. Crea primero el proyecto con `npx wrangler pages project create al-dia --production-branch main` y configura los secretos `CLOUDFLARE_API_TOKEN` (permisos *Cloudflare Pages: Edit* y *D1: Edit*) y `CLOUDFLARE_ACCOUNT_ID`.

**Opción C — Integración Git del dashboard (no verificada con el monorepo).**
1. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
2. Framework: **None**. *Root directory*: **`apps/api`**. Build command: **`npm run build`**. Output directory: **`dist`** (estáticos de `apps/web/public` + Functions compiladas en `_worker.js`; Cloudflare no acepta rutas fuera del *Root directory* ni detecta `functions/` en esta configuración).
3. Cloudflare toma el binding `DB` desde `wrangler.toml`. Si no aparece, agrégalo en *Settings → Bindings → D1 database* con el nombre `DB`.
4. No combines esta opción con GitHub Actions para no desplegar dos veces.
5. Cuando agregues migraciones nuevas, aplícalas con `npm run db:migrate` antes de hacer push.

> Las vistas previas de ramas usan la misma base de datos que producción. Si vas a probar cambios de esquema, crea una base aparte para pruebas.


## Desarrollo local

```bash
npm run db:migrate:local
npm run user:create:local -- --username prueba --name "Prueba" --role admin
npm run dev            # http://localhost:8788
```

La base local vive en `apps/api/.wrangler/` y no afecta producción.

Antes de subir cambios:

```bash
npm run check          # sintaxis de todo el JS + importaciones entre módulos del frontend
npm run lint           # identificadores no definidos (error) o sin uso (advertencia)
```

## Administrar usuarios

**Desde la app.** Con rol administrador aparece la pestaña **Usuarios**. Ahí puedes:
- crear usuarios con una clave temporal (la persona debe cambiarla al entrar);
- cambiar nombre, rol y meses de retención (1 a 24);
- desactivar, desbloquear o restablecer la contraseña;
- eliminar un usuario con toda su información.

No puedes quitarte el rol de administrador ni desactivarte a ti misma.

**Desde la consola de D1** (Cloudflare → D1 → db-aldia → Console) o con `npx wrangler d1 execute db-aldia --remote --command "…"`:

```sql
-- Ver usuarios y su configuración
SELECT username, display_name, role, active, retention_months, last_login_at FROM users;

-- Cambiar la retención de una persona a 6 meses
UPDATE users SET retention_months = 6 WHERE username = 'kristell';

-- Desactivar un usuario y cerrar sus sesiones
UPDATE users SET active = 0 WHERE username = 'ana';
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = 'ana');

-- Desbloquear tras intentos fallidos
UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = 'ana';
```

Las contraseñas no se pueden escribir directamente en SQL porque se guardan con hash. Para restablecer una, usa la app o `npm run user:create`.

## Consumo frente al plan gratuito

| Recurso | Límite gratuito | Uso típico de una persona |
|---|---|---|
| Solicitudes a Functions | 100.000 / día | Decenas por día |
| Lecturas D1 | 5 millones de filas / día | Cientos por carga |
| Escrituras D1 | 100.000 filas / día | Unas pocas por cambio |
| Almacenamiento D1 | 5 GB | Unos KB por usuario (4 meses) |
| Consultas por invocación | 50 | ≈10 por sincronización |

El hash de contraseña usa 60.000 iteraciones para respetar el límite de CPU del plan gratuito. El número de iteraciones queda guardado en cada hash, así que se puede subir después sin migrar.

## Privacidad

- Los comprobantes y extractos se leen en el navegador. El archivo nunca se envía; solo se guardan los valores que confirmas.
- Del número de tarjeta o crédito solo se conservan los últimos 4 dígitos.
- Los respaldos JSON contienen información financiera; `.gitignore` evita subirlos.
- Para una capa adicional puedes poner la URL detrás de **Cloudflare Access**, también gratuito hasta 50 usuarios.

## Limitaciones

- Solo lee PDF con texto. Fotos y PDF escaneados se registran a mano.
- Si la misma persona edita a la vez en dos dispositivos, gana el último cambio guardado.

## Licencias

pdf.js: Apache License 2.0 (`apps/web/public/vendor/pdfjs/LICENSE`).
