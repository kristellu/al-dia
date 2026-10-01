// Administración de usuarios: listar y crear
import { json, error, readJson } from '../../../../src/lib/http.js';
import { hashPassword, passwordProblem } from '../../../../src/lib/password.js';
import { USERNAME, cleanText, cleanInt } from '../../../../src/lib/validate.js';

export const USER_COLUMNS = `id, username, display_name, role, active, retention_months, must_change_password,
  failed_attempts, locked_until, last_login_at, created_at, updated_at`;

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY username`).all();
  return json({ users: results });
}

export async function onRequestPost({ request, env }) {
  const b = await readJson(request, 4_000);
  const username = String(b?.username || '').trim().toLowerCase();
  const displayName = cleanText(b?.display_name, 80);
  const role = b?.role === 'admin' ? 'admin' : 'user';
  const retention = cleanInt(b?.retention_months, 1, 24) ?? 4;
  if (!USERNAME.test(username)) return error(400, 'El usuario debe tener de 3 a 40 caracteres: letras minúsculas, números, punto, guion o guion bajo.');
  if (!displayName) return error(400, 'Escribe el nombre de la persona.');
  const problem = passwordProblem(b?.password);
  if (problem) return error(400, problem);

  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?1').bind(username).first();
  if (exists) return error(409, 'Ya existe un usuario con ese nombre.');

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, role, retention_months, must_change_password)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)`
  ).bind(id, username, displayName, await hashPassword(b.password), role, retention).run();

  const user = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`).bind(id).first();
  return json({ user }, 201);
}
