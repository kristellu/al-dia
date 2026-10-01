// Se ejecuta antes de toda ruta /api/*: protección CSRF, sesión y rol.
import { error } from '../../src/lib/http.js';
import { getSession } from '../../src/lib/session.js';

const PUBLIC_ROUTES = new Set(['/api/auth/login']);
const ALLOWED_WHILE_MUST_CHANGE = new Set(['/api/auth/me', '/api/auth/password', '/api/auth/logout']);

export async function onRequest(context) {
  const { request, env, data, next } = context;
  const path = new URL(request.url).pathname;

  if (!env.DB) return error(500, 'Falta configurar la base de datos D1 (binding DB).');

  // Toda escritura debe venir de la propia app (cabecera que un formulario externo no puede enviar)
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('X-Requested-With') !== 'al-dia') {
    return error(403, 'Solicitud no permitida.');
  }

  try {
    let session = null;
    if (!PUBLIC_ROUTES.has(path)) {
      session = await getSession(env.DB, request);
      if (!session) return error(401, 'Tu sesión venció. Ingresa de nuevo.');
      if (session.user.must_change_password && !ALLOWED_WHILE_MUST_CHANGE.has(path)) {
        return error(403, 'Debes cambiar tu contraseña antes de continuar.');
      }
      if (path.startsWith('/api/admin/') && session.user.role !== 'admin') {
        return error(403, 'Esta sección es solo para administradores.');
      }
      data.session = session;
      data.user = session.user;
    }

    const response = await next();
    if (session?.setCookie) response.headers.append('Set-Cookie', session.setCookie);
    return response;
  } catch (e) {
    console.error('API error', path, e?.message || e);
    return error(500, 'Ocurrió un error en el servidor. Intenta de nuevo.');
  }
}
