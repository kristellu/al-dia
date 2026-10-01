# @al-dia/web — Frontend

Sitio estático sin framework ni paso de build. Todo lo que hay en `public/` se publica tal cual: Cloudflare lo toma desde `apps/api/wrangler.toml` (`pages_build_output_dir = "../web/public"`). Para levantarlo en local, usa `npm run dev` desde la raíz del monorepo.

## Contenido de `public/`

| Ruta | Qué es |
|---|---|
| `index.html` | Esqueleto de la página. Carga `pdf.min.js` como script clásico (global `pdfjsLib`) y `js/main.js` como módulo. |
| `styles.css` | Todos los estilos. |
| `_headers` | CSP y cabeceras de seguridad y caché (Cloudflare Pages). |
| `vendor/pdfjs/` | pdf.js y su worker (Apache 2.0). No se edita. |
| `js/` | Código de la aplicación en módulos ES. |

## Módulos (`public/js/`)

```
main.js            Punto de entrada: delegación de eventos (data-act, data-view, data-toggle…), pie de página y boot()
core/              constants.js · utils.js ($, esc, fmt…) · dates.js (meses YYYY-MM, hoy)
state/store.js     `state` (S, view, cur, movFilter, selCat, USERS, ME, WIN, synced) + blank, normalize, M, ensure
services/          api.js (fetch + anti-CSRF) · sync.js (diferencias por fila) · session.js (login, carga) · backup.js
domain/            calc.js (totales, quincenas, observaciones) · actions.js (preparar/cerrar mes) · demo.js
ui/                render.js · modal.js · toast.js · components.js · charts.js
views/             inicio · movimientos · calendario · deudas · analisis · usuarios · empty-month
forms/             movements · budgets · debts · account · users
documents/         parsers.js (nómina y extractos, funciones puras) · pdf.js (pdf.js → texto) · upload.js
```

## Convenciones

- **Sin build:** las importaciones son relativas y llevan extensión `.js`, porque el navegador las resuelve directamente.
- **Estado mutable solo en `state`:** un `let` importado no se puede reasignar desde otro módulo. Por eso se escribe `state.cur = …` o `state.S.debts`, nunca variables globales.
- **Solo `main.js` tiene efectos al cargar** (listeners, pie de página, arranque). Los demás módulos solo declaran funciones y constantes. Así los ciclos de importación entre módulos son seguros.
- **CSP estricta (`script-src 'self'`):** no uses `onclick="…"` ni `<script>` en línea. Las acciones se declaran con `data-act="…"` y se atienden en el `switch` de `main.js`.
- Un archivo nuevo en `js/` hereda `Cache-Control: no-cache` por la regla `/js/*` de `_headers`.

## Verificación

Desde la raíz: `npm run check` (sintaxis y que cada `import` exista y esté exportado) y `npm run lint`.
