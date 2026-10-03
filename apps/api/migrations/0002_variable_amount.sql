-- =====================================================================
-- Gastos recurrentes con valor variable
--   * variable_amount: el gasto se repite cada mes con los mismos datos, pero
--     su valor cambia (p. ej. el pago de una tarjeta o un servicio). Solo gastos.
--   * amount_pending: al preparar un mes, el gasto variable se copia en $0 y
--     queda "por confirmar" hasta que se registre el valor o el extracto.
-- =====================================================================
ALTER TABLE movements ADD COLUMN variable_amount INTEGER NOT NULL DEFAULT 0 CHECK (variable_amount IN (0,1));
ALTER TABLE movements ADD COLUMN amount_pending  INTEGER NOT NULL DEFAULT 0 CHECK (amount_pending IN (0,1));
