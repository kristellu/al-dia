import { json, error, readJson } from '../../../src/lib/http.js';
import { verifyPassword, dummyHash } from '../../../src/lib/password.js';
import { createSession } from '../../../src/lib/session.js';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC = 'Usuario o contraseña incorrectos.';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request, 4_000);
  const username = String(body?.username || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!username || !password) return error(400, 'Ingresa tu usuario y tu contraseña.');

  const db = env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE username = ?1').bind(username).first();
  if (!user) {
    await verifyPassword(password, await dummyHash()); // mismo tiempo de respuesta que un usuario real
    return error(401, GENERIC);
  }

  const now = new Date();
  if (user.locked_until && Date.parse(user.locked_until) > now.getTime()) {
    return error(429, `Demasiados intentos fallidos. Intenta de nuevo en unos minutos.`);
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok || !user.active) {
    const attempts = user.failed_attempts + 1;
    const lock = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;
    await db
      .prepare('UPDATE users SET failed_attempts = ?1, locked_until = ?2 WHERE id = ?3')
      .bind(lock ? 0 : attempts, lock, user.id)
      .run();
    return error(401, GENERIC);
  }

  await db.batch([
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?1 WHERE id = ?2')
      .bind(now.toISOString(), user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?1 AND expires_at < ?2').bind(user.id, now.toISOString()),
  ]);
  const cookie = await createSession(db, user.id, request);
  return json({ ok: true, mustChangePassword: !!user.must_change_password }, 200, { 'Set-Cookie': cookie });
}
