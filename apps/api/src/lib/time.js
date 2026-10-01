// Ventana de meses que se conservan. Se calcula en hora de Colombia (UTC−5).
const OFFSET_HOURS = -5;
export const MAX_MONTHS_AHEAD = 12;

export function currentMonth(now = new Date()) {
  const d = new Date(now.getTime() + OFFSET_HOURS * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(key, n) {
  let [y, m] = key.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// retention = 4 → mes actual y los 3 anteriores
export function retentionWindow(retentionMonths) {
  const current = currentMonth();
  return {
    retention: retentionMonths,
    current,
    cutoff: addMonths(current, -(retentionMonths - 1)),
    max: addMonths(current, MAX_MONTHS_AHEAD),
  };
}

export async function purgeOutsideWindow(db, userId, cutoff) {
  await db.batch([
    db.prepare('DELETE FROM movements WHERE user_id = ?1 AND month < ?2').bind(userId, cutoff),
    db.prepare('DELETE FROM debt_balances WHERE user_id = ?1 AND month < ?2').bind(userId, cutoff),
    db.prepare('DELETE FROM months WHERE user_id = ?1 AND month < ?2').bind(userId, cutoff),
  ]);
}
