-- =====================================================================
-- Al día · Modelo de datos (Cloudflare D1 / SQLite)
-- Convenciones:
--   * Montos en pesos colombianos como INTEGER (sin decimales).
--   * Meses como texto 'YYYY-MM'; fechas como texto ISO 'YYYY-MM-DD'.
--   * Toda tabla de negocio lleva user_id en la llave primaria: un usuario
--     nunca puede leer ni sobrescribir filas de otro.
--   * La retención (últimos N meses) se configura por usuario en users.
-- =====================================================================

-- Usuarios y configuración por usuario
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,
  username              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name          TEXT NOT NULL,
  password_hash         TEXT NOT NULL,                 -- pbkdf2-sha256$iter$salt$hash
  role                  TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  active                INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  retention_months      INTEGER NOT NULL DEFAULT 4 CHECK (retention_months BETWEEN 1 AND 24),
  must_change_password  INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
  failed_attempts       INTEGER NOT NULL DEFAULT 0,
  locked_until          TEXT,
  last_login_at         TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Sesiones (se guarda solo el hash SHA-256 del token de la cookie)
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Categorías de gasto y su presupuesto mensual opcional
CREATE TABLE categories (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  budget      INTEGER CHECK (budget IS NULL OR budget >= 0),
  PRIMARY KEY (user_id, name)
);

-- Mes financiero (existe cuando se prepara; guarda el cierre)
CREATE TABLE months (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month          TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  closed         INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0,1)),
  closed_at      TEXT,
  snapshot_json  TEXT,                                 -- fotografía al cerrar el mes
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, month)
);

-- Movimientos: ingresos y gastos en una sola tabla
CREATE TABLE movements (
  user_id      TEXT NOT NULL,
  id           TEXT NOT NULL,
  month        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('ingreso','gasto')),
  name         TEXT NOT NULL,
  amount       INTEGER NOT NULL CHECK (amount >= 0),
  category     TEXT,
  day          INTEGER CHECK (day IS NULL OR day BETWEEN 1 AND 31),
  quincena     INTEGER NOT NULL CHECK (quincena IN (1,2)),
  status       TEXT NOT NULL CHECK (status IN ('pendiente','pagado','recibido')),
  paid_on      TEXT,
  recurring    INTEGER NOT NULL DEFAULT 0 CHECK (recurring IN (0,1)),
  note         TEXT,
  income_type  TEXT CHECK (income_type IS NULL OR income_type IN ('salario','extra')),
  gross        INTEGER,                                -- devengado (solo nómina, informativo)
  deductions   INTEGER,                                -- deducciones (solo nómina, informativo)
  debt_id      TEXT,                                   -- pago asociado a una deuda (referencia blanda)
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, month) REFERENCES months(user_id, month) ON DELETE CASCADE
);
CREATE INDEX idx_movements_user_month ON movements(user_id, month);

-- Productos de deuda (tarjetas y créditos). Solo últimos 4 dígitos.
CREATE TABLE debts (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL,
  bank        TEXT,
  last4       TEXT CHECK (last4 IS NULL OR (length(last4) BETWEEN 1 AND 4 AND last4 NOT GLOB '*[^0-9]*')),
  kind        TEXT NOT NULL DEFAULT 'tarjeta' CHECK (kind IN ('tarjeta','credito')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id)
);

-- Saldo de cada deuda por mes (extracto)
CREATE TABLE debt_balances (
  user_id          TEXT NOT NULL,
  debt_id          TEXT NOT NULL,
  month            TEXT NOT NULL,
  saldo            INTEGER NOT NULL CHECK (saldo >= 0),
  minimo           INTEGER,
  total            INTEGER,
  fecha_limite     TEXT,
  tasa_ea          REAL,
  cupo             INTEGER,
  cupo_disponible  INTEGER,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, debt_id, month),
  FOREIGN KEY (user_id, debt_id) REFERENCES debts(user_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_balances_user_month ON debt_balances(user_id, month);
