// Devuelve los datos del usuario dentro de su ventana de retención y depura lo antiguo.
import { json } from '../../src/lib/http.js';
import { retentionWindow, purgeOutsideWindow } from '../../src/lib/time.js';
import { SELECT_STATE } from '../../src/lib/sql.js';
import { publicUser } from './auth/me.js';

export async function onRequestGet({ env, data }) {
  const db = env.DB;
  const u = data.user;
  const win = retentionWindow(u.retention_months);
  await purgeOutsideWindow(db, u.id, win.cutoff);

  const [categories, months, movements, debts, balances] = await db.batch([
    db.prepare(SELECT_STATE.categories).bind(u.id),
    db.prepare(SELECT_STATE.months).bind(u.id, win.cutoff),
    db.prepare(SELECT_STATE.movements).bind(u.id, win.cutoff),
    db.prepare(SELECT_STATE.debts).bind(u.id),
    db.prepare(SELECT_STATE.balances).bind(u.id, win.cutoff),
  ]);

  return json({
    user: publicUser(u),
    window: win,
    data: {
      categories: categories.results,
      months: months.results,
      movements: movements.results,
      debts: debts.results,
      balances: balances.results,
    },
  });
}
