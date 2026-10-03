// Limpieza y validación de lo que envía el navegador. Una fila inválida se descarta.
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_AMOUNT = 1e13;

const text = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
};
const int = (v, min = 0, max = MAX_AMOUNT) => {
  if (v == null || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const real = (v, min, max) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const flag = (v) => (v ? 1 : 0);
const oneOf = (v, list) => (list.includes(v) ? v : null);
export const validId = (v) => (ID.test(String(v ?? '')) ? String(v) : null);
export const validMonth = (v) => (MONTH.test(String(v ?? '')) ? String(v) : null);
const date = (v) => (v && DATE.test(String(v)) ? String(v) : null);

export function cleanCategory(r) {
  const name = text(r?.name, 60);
  if (!name) return null;
  return { name, sort_order: int(r.sort_order, 0, 999) ?? 0, budget: int(r.budget) };
}

export function cleanMonth(r) {
  const month = validMonth(r?.month);
  if (!month) return null;
  let snapshot = null;
  if (r.snapshot && typeof r.snapshot === 'object') {
    const s = JSON.stringify(r.snapshot);
    if (s.length <= 20_000) snapshot = s;
  }
  return { month, closed: flag(r.closed), closed_at: date(r.closed_at), snapshot_json: snapshot };
}

export function cleanMovement(r) {
  const id = validId(r?.id), month = validMonth(r?.month);
  const kind = oneOf(r?.kind, ['ingreso', 'gasto']);
  const name = text(r?.name, 120), amount = int(r?.amount);
  const quincena = oneOf(Number(r?.quincena), [1, 2]);
  if (!id || !month || !kind || !name || amount == null || !quincena) return null;
  const status = kind === 'gasto'
    ? oneOf(r.status, ['pendiente', 'pagado'])
    : oneOf(r.status, ['pendiente', 'recibido']);
  if (!status) return null;
  const variable = kind === 'gasto' ? flag(r.variable_amount) : 0;
  return {
    id, month, kind, name, amount, quincena, status,
    category: text(r.category, 60),
    day: int(r.day, 1, 31),
    paid_on: status === 'pagado' ? date(r.paid_on) : null,
    recurring: flag(r.recurring),
    note: text(r.note, 500),
    income_type: kind === 'ingreso' ? oneOf(r.income_type, ['salario', 'extra']) ?? 'extra' : null,
    gross: kind === 'ingreso' ? int(r.gross) : null,
    deductions: kind === 'ingreso' ? int(r.deductions) : null,
    debt_id: kind === 'gasto' ? validId(r.debt_id) : null,
    variable_amount: variable,
    amount_pending: variable ? flag(r.amount_pending) : 0,
  };
}

export function cleanDebt(r) {
  const id = validId(r?.id), name = text(r?.name, 120);
  if (!id || !name) return null;
  const last4 = String(r.last4 ?? '').replace(/\D/g, '').slice(-4) || null;
  return { id, name, bank: text(r.bank, 80), last4, kind: oneOf(r.kind, ['tarjeta', 'credito']) ?? 'tarjeta' };
}

export function cleanBalance(r) {
  const debt_id = validId(r?.debt_id), month = validMonth(r?.month), saldo = int(r?.saldo);
  if (!debt_id || !month || saldo == null) return null;
  return {
    debt_id, month, saldo,
    minimo: int(r.minimo), total: int(r.total),
    fecha_limite: date(r.fecha_limite),
    tasa_ea: real(r.tasa_ea, 0, 1000),
    cupo: int(r.cupo), cupo_disponible: int(r.cupo_disponible),
  };
}

export const USERNAME = /^[a-z0-9._-]{3,40}$/;
export const cleanText = text;
export const cleanInt = int;
