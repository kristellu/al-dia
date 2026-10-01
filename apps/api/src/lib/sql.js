// Sentencias de escritura masiva. Cada una recibe ?1 = user_id y ?2 = arreglo JSON de filas,
// de modo que una sincronización usa pocas consultas (el plan gratuito permite 50 por invocación).
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const j = (f) => `json_extract(value,'$.${f}')`;

export const UPSERT = {
  categories: `
    INSERT INTO categories (user_id, name, sort_order, budget)
    SELECT ?1, ${j('name')}, ${j('sort_order')}, ${j('budget')} FROM json_each(?2) WHERE 1
    ON CONFLICT (user_id, name) DO UPDATE SET sort_order = excluded.sort_order, budget = excluded.budget`,
  months: `
    INSERT INTO months (user_id, month, closed, closed_at, snapshot_json, updated_at)
    SELECT ?1, ${j('month')}, ${j('closed')}, ${j('closed_at')}, ${j('snapshot_json')}, ${NOW} FROM json_each(?2) WHERE 1
    ON CONFLICT (user_id, month) DO UPDATE SET closed = excluded.closed, closed_at = excluded.closed_at,
      snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`,
  debts: `
    INSERT INTO debts (user_id, id, name, bank, last4, kind, updated_at)
    SELECT ?1, ${j('id')}, ${j('name')}, ${j('bank')}, ${j('last4')}, ${j('kind')}, ${NOW} FROM json_each(?2) WHERE 1
    ON CONFLICT (user_id, id) DO UPDATE SET name = excluded.name, bank = excluded.bank, last4 = excluded.last4,
      kind = excluded.kind, updated_at = excluded.updated_at`,
  movements: `
    INSERT INTO movements (user_id, id, month, kind, name, amount, category, day, quincena, status, paid_on,
                           recurring, note, income_type, gross, deductions, debt_id, updated_at)
    SELECT ?1, ${j('id')}, ${j('month')}, ${j('kind')}, ${j('name')}, ${j('amount')}, ${j('category')}, ${j('day')},
           ${j('quincena')}, ${j('status')}, ${j('paid_on')}, ${j('recurring')}, ${j('note')}, ${j('income_type')},
           ${j('gross')}, ${j('deductions')}, ${j('debt_id')}, ${NOW}
      FROM json_each(?2) WHERE 1
    ON CONFLICT (user_id, id) DO UPDATE SET month = excluded.month, kind = excluded.kind, name = excluded.name,
      amount = excluded.amount, category = excluded.category, day = excluded.day, quincena = excluded.quincena,
      status = excluded.status, paid_on = excluded.paid_on, recurring = excluded.recurring, note = excluded.note,
      income_type = excluded.income_type, gross = excluded.gross, deductions = excluded.deductions,
      debt_id = excluded.debt_id, updated_at = excluded.updated_at`,
  balances: `
    INSERT INTO debt_balances (user_id, debt_id, month, saldo, minimo, total, fecha_limite, tasa_ea, cupo, cupo_disponible, updated_at)
    SELECT ?1, ${j('debt_id')}, ${j('month')}, ${j('saldo')}, ${j('minimo')}, ${j('total')}, ${j('fecha_limite')},
           ${j('tasa_ea')}, ${j('cupo')}, ${j('cupo_disponible')}, ${NOW}
      FROM json_each(?2) WHERE 1
    ON CONFLICT (user_id, debt_id, month) DO UPDATE SET saldo = excluded.saldo, minimo = excluded.minimo,
      total = excluded.total, fecha_limite = excluded.fecha_limite, tasa_ea = excluded.tasa_ea,
      cupo = excluded.cupo, cupo_disponible = excluded.cupo_disponible, updated_at = excluded.updated_at`,
};

// ?2 = arreglo JSON de llaves a borrar
export const DELETE = {
  movements: 'DELETE FROM movements WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))',
  balances: "DELETE FROM debt_balances WHERE user_id = ?1 AND (debt_id || '|' || month) IN (SELECT value FROM json_each(?2))",
  debts: 'DELETE FROM debts WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))',
  months: 'DELETE FROM months WHERE user_id = ?1 AND month IN (SELECT value FROM json_each(?2))',
  categories: 'DELETE FROM categories WHERE user_id = ?1 AND name IN (SELECT value FROM json_each(?2))',
};

export const SELECT_STATE = {
  categories: 'SELECT name, sort_order, budget FROM categories WHERE user_id = ?1 ORDER BY sort_order, name',
  months: 'SELECT month, closed, closed_at, snapshot_json FROM months WHERE user_id = ?1 AND month >= ?2 ORDER BY month',
  movements: `SELECT id, month, kind, name, amount, category, day, quincena, status, paid_on, recurring, note,
                     income_type, gross, deductions, debt_id
                FROM movements WHERE user_id = ?1 AND month >= ?2 ORDER BY month, quincena, day`,
  debts: 'SELECT id, name, bank, last4, kind FROM debts WHERE user_id = ?1 ORDER BY created_at',
  balances: `SELECT debt_id, month, saldo, minimo, total, fecha_limite, tasa_ea, cupo, cupo_disponible
               FROM debt_balances WHERE user_id = ?1 AND month >= ?2 ORDER BY month`,
};

// Divide un arreglo en trozos cuyo JSON no supere maxBytes (límite de tamaño por sentencia en D1)
export function chunkBySize(rows, maxBytes = 80_000) {
  const out = [];
  let cur = [], size = 2;
  for (const r of rows) {
    const s = JSON.stringify(r).length + 1;
    if (cur.length && size + s > maxBytes) { out.push(cur); cur = []; size = 2; }
    cur.push(r); size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}
