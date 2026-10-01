// Recibe solo los cambios (altas, actualizaciones y borrados) y los aplica en una transacción.
import { json, error, readJson } from '../../src/lib/http.js';
import { retentionWindow } from '../../src/lib/time.js';
import { UPSERT, DELETE, chunkBySize } from '../../src/lib/sql.js';
import {
  cleanCategory, cleanMonth, cleanDebt, cleanMovement, cleanBalance, validId, validMonth, cleanText,
} from '../../src/lib/validate.js';

const MAX_ROWS_PER_TYPE = 3_000;
const MAX_STATEMENTS = 45; // margen bajo el límite de 50 consultas por invocación del plan gratuito

export async function onRequestPost({ request, env, data }) {
  const body = await readJson(request, 1_500_000);
  if (!body || typeof body !== 'object') return error(400, 'Los datos enviados no son válidos.');

  const userId = data.user.id;
  const win = retentionWindow(data.user.retention_months);
  const inWindow = (m) => m >= win.cutoff && m <= win.max;
  const report = { upserted: 0, deleted: 0, skipped: 0 };

  const list = (v) => (Array.isArray(v) ? v.slice(0, MAX_ROWS_PER_TYPE) : []);
  const clean = (rows, fn) =>
    list(rows).reduce((acc, r) => {
      const c = fn(r);
      if (c && (!c.month || inWindow(c.month))) acc.push(c);
      else report.skipped++;
      return acc;
    }, []);

  const up = body.upserts || {};
  const del = body.deletes || {};
  const upserts = {
    categories: clean(up.categories, cleanCategory),
    months: clean(up.months, cleanMonth),
    debts: clean(up.debts, cleanDebt),
    movements: clean(up.movements, cleanMovement),
    balances: clean(up.balances, cleanBalance),
  };
  const balanceKey = (k) => {
    const [d, m] = String(k).split('|');
    return validId(d) && validMonth(m) ? `${d}|${m}` : null;
  };
  const deletes = {
    movements: list(del.movements).map(validId).filter(Boolean),
    balances: list(del.balances).map(balanceKey).filter(Boolean),
    debts: list(del.debts).map(validId).filter(Boolean),
    months: list(del.months).map(validMonth).filter(Boolean),
    categories: list(del.categories).map((n) => cleanText(n, 60)).filter(Boolean),
  };

  const db = env.DB;
  const statements = [];
  const add = (sql, rows) => {
    for (const chunk of chunkBySize(rows)) statements.push(db.prepare(sql).bind(userId, JSON.stringify(chunk)));
  };
  // Orden que respeta las llaves foráneas: primero borrar hijos, luego padres; al insertar, al revés.
  for (const t of ['movements', 'balances', 'debts', 'months', 'categories']) {
    add(DELETE[t], deletes[t]);
    report.deleted += deletes[t].length;
  }
  for (const t of ['categories', 'months', 'debts', 'movements', 'balances']) {
    add(UPSERT[t], upserts[t]);
    report.upserted += upserts[t].length;
  }

  if (statements.length > MAX_STATEMENTS) return error(413, 'Demasiados cambios a la vez. Recarga la página.');
  if (statements.length) {
    try {
      await db.batch(statements);
    } catch (e) {
      console.error('sync batch failed', e?.message || e);
      return error(409, 'No se pudieron guardar los cambios porque no coinciden con lo guardado');
    }
  }
  return json({ ok: true, ...report, window: win });
}
