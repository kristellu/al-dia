// Sesiones con cookie HttpOnly. En la base solo se guarda el hash del token.
const COOKIE = 'al_dia_sesion';
const TTL_DAYS = 14;
const RENEW_BELOW_DAYS = 7;
const DAY = 86_400_000;

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export const sessionCookie = (token, maxAgeSec) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
export const clearedCookie = () => sessionCookie('', 0);

export async function createSession(db, userId, request) {
  const token = randomToken();
  const expires = new Date(Date.now() + TTL_DAYS * DAY).toISOString();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256hex(token), userId, expires, (request.headers.get('User-Agent') || '').slice(0, 200))
    .run();
  return sessionCookie(token, TTL_DAYS * 86_400);
}

export async function getSession(db, request) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const tokenHash = await sha256hex(token);
  const row = await db
    .prepare(
      `SELECT s.expires_at, u.id, u.username, u.display_name, u.role, u.active,
              u.retention_months, u.must_change_password
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?1`
    )
    .bind(tokenHash)
    .first();
  if (!row) return null;
  const now = Date.now();
  if (!row.active || Date.parse(row.expires_at) < now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
    return null;
  }
  let setCookie = null;
  if (Date.parse(row.expires_at) - now < RENEW_BELOW_DAYS * DAY) {
    const expires = new Date(now + TTL_DAYS * DAY).toISOString();
    await db.prepare('UPDATE sessions SET expires_at = ?1 WHERE token_hash = ?2').bind(expires, tokenHash).run();
    setCookie = sessionCookie(token, TTL_DAYS * 86_400);
  }
  return {
    tokenHash,
    setCookie,
    user: {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      role: row.role,
      retention_months: row.retention_months,
      must_change_password: !!row.must_change_password,
    },
  };
}

export async function destroySession(db, tokenHash) {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
}
