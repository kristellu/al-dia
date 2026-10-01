import { json } from '../../../src/lib/http.js';
import { destroySession, clearedCookie } from '../../../src/lib/session.js';

export async function onRequestPost({ env, data }) {
  await destroySession(env.DB, data.session.tokenHash);
  return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie() });
}
