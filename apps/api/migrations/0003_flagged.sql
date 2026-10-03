-- =====================================================================
-- Bandera roja en gastos
--   * flagged: el usuario marca un gasto para prestarle especial atención.
--     Se conserva al preparar el mes siguiente si el gasto es recurrente.
-- =====================================================================
ALTER TABLE movements ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0,1));
