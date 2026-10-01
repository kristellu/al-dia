import { json, error, readJson } from '../../../src/lib/http.js';
import { hashPassword, verifyPassword, passwordProblem } from '../../../src/lib/password.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request, 4_000);
  const current = String(body?.current || '');
  const next = String(body?.next || '');
  const problem = passwordProblem(next);
  if (problem) return error(400, problem);
  if (current === next) return error(400, 'La nueva contraseña debe ser distinta de la actual.');

  const db = env.DB;
  const row = await db.prepare('SELECT password_hash FROM users WHERE id = ?1').bind(data.user.id).first();
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return error(400, 'La contraseña actual no es correcta.');
  }
  const hash = await hashPassword(next);
  await db.batch([
    db.prepare(`UPDATE users SET password_hash = ?1, must_change_password = 0,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2`).bind(hash, data.user.id),
    // Cierra las demás sesiones abiertas
    db.prepare('DELETE FROM sessions WHERE user_id = ?1 AND token_hash <> ?2').bind(data.user.id, data.session.tokenHash),
  ]);
  return json({ ok: true });
}
