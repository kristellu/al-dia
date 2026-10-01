// Administración de usuarios: editar y eliminar
import { json, error, readJson } from '../../../../src/lib/http.js';
import { hashPassword, passwordProblem } from '../../../../src/lib/password.js';
import { cleanText, cleanInt } from '../../../../src/lib/validate.js';
import { USER_COLUMNS } from './index.js';

export async function onRequestPatch({ request, env, params, data }) {
  const id = String(params.id);
  const b = await readJson(request, 4_000);
  if (!b) return error(400, 'Los datos enviados no son válidos.');
  const db = env.DB;
  const target = await db.prepare('SELECT id, role, active FROM users WHERE id = ?1').bind(id).first();
  if (!target) return error(404, 'El usuario no existe.');
  const isSelf = id === data.user.id;

  const sets = [], args = [];
  const set = (col, val) => { args.push(val); sets.push(`${col} = ?${args.length}`); };

  if ('display_name' in b) {
    const v = cleanText(b.display_name, 80);
    if (!v) return error(400, 'El nombre no puede quedar vacío.');
    set('display_name', v);
  }
  if ('role' in b) {
    const v = b.role === 'admin' ? 'admin' : 'user';
    if (isSelf && v !== 'admin') return error(400, 'No puedes quitarte el rol de administrador.');
    set('role', v);
  }
  if ('active' in b) {
    const v = b.active ? 1 : 0;
    if (isSelf && !v) return error(400, 'No puedes desactivar tu propio usuario.');
    set('active', v);
  }
  if ('retention_months' in b) {
    const v = cleanInt(b.retention_months, 1, 24);
    if (v == null) return error(400, 'La retención debe estar entre 1 y 24 meses.');
    set('retention_months', v);
  }
  let resetPassword = false;
  if (b.password) {
    const problem = passwordProblem(b.password);
    if (problem) return error(400, problem);
    set('password_hash', await hashPassword(b.password));
    set('must_change_password', isSelf ? 0 : 1);
    resetPassword = true;
  }
  if (b.unlock || resetPassword) { set('failed_attempts', 0); set('locked_until', null); }
  if (!sets.length) return error(400, 'No hay cambios para guardar.');

  args.push(id);
  const statements = [
    db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                WHERE id = ?${args.length}`).bind(...args),
  ];
  // Al desactivar o restablecer contraseña de otro usuario, se cierran sus sesiones
  if (!isSelf && (resetPassword || b.active === false)) {
    statements.push(db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(id));
  }
  await db.batch(statements);
  const user = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`).bind(id).first();
  return json({ user });
}

export async function onRequestDelete({ env, params, data }) {
  const id = String(params.id);
  if (id === data.user.id) return error(400, 'No puedes eliminar tu propio usuario.');
  const db = env.DB;
  // Borrado explícito en orden para no depender de la cascada
  await db.batch([
    db.prepare('DELETE FROM movements WHERE user_id = ?1').bind(id),
    db.prepare('DELETE FROM debt_balances WHERE user_id = ?1').bind(id),
    db.prepare('DELETE FROM debts WHERE user_id = ?1').bind(id),
    db.prepare('DELETE FROM months WHERE user_id = ?1').bind(id),
    db.prepare('DELETE FROM categories WHERE user_id = ?1').bind(id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(id),
    db.prepare('DELETE FROM users WHERE id = ?1').bind(id),
  ]);
  return json({ ok: true });
}
