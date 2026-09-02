-- =====================================================================
-- Finanzas personales — esquema inicial
-- Destino: src/main/resources/db/migration/V1__esquema_inicial.sql
-- Postgres 16+ (Neon). gen_random_uuid() es nativo desde PG 13.
--
-- Notas de diseño:
--  * Los UUID los genera el CLIENTE (para que el POST de sincronización
--    sea idempotente). El DEFAULT queda solo como red de seguridad.
--  * No hay saldo_actual: se guarda saldo_inicial y el saldo vivo sale
--    de la vista v_saldos. Así nunca se desincroniza.
--  * Borrado suave en todas partes (eliminado_en) porque con sync
--    offline un DELETE duro es irrecuperable.
--  * actualizado_en alimenta la sincronización delta ("dame todo lo
--    que cambió desde X"). Lo mantiene un trigger, no la aplicación.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Trigger compartido para actualizado_en
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    nombre          VARCHAR(100),
    es_demo         BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT usuarios_email_uk UNIQUE (email)
);

CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();


-- ---------------------------------------------------------------------
-- cuentas
-- ---------------------------------------------------------------------
CREATE TABLE cuentas (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario      UUID          NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre          VARCHAR(50)   NOT NULL,
    tipo            VARCHAR(20)   NOT NULL,
    saldo_inicial   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    moneda          CHAR(3)       NOT NULL DEFAULT 'USD',
    archivada       BOOLEAN       NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    eliminado_en    TIMESTAMPTZ,

    CONSTRAINT cuentas_tipo_chk CHECK (tipo IN ('DEBITO', 'CREDITO', 'EFECTIVO'))
);

-- Nombre único por usuario, pero solo entre las cuentas vivas.
CREATE UNIQUE INDEX cuentas_nombre_uk
    ON cuentas (id_usuario, lower(nombre))
    WHERE eliminado_en IS NULL;

CREATE INDEX cuentas_usuario_idx ON cuentas (id_usuario) WHERE eliminado_en IS NULL;
CREATE INDEX cuentas_sync_idx    ON cuentas (id_usuario, actualizado_en);

CREATE TRIGGER trg_cuentas_actualizado
    BEFORE UPDATE ON cuentas
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();


-- ---------------------------------------------------------------------
-- categorias (jerárquicas: id_padre apunta a la misma tabla)
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario      UUID         NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre          VARCHAR(50)  NOT NULL,
    tipo            VARCHAR(15)  NOT NULL,
    id_padre        UUID,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado_en    TIMESTAMPTZ,

    CONSTRAINT categorias_tipo_chk CHECK (tipo IN ('INGRESO', 'GASTO')),
    CONSTRAINT categorias_no_autopadre_chk CHECK (id_padre IS DISTINCT FROM id),

    -- Necesaria para que la FK compuesta de abajo pueda referenciarla.
    CONSTRAINT categorias_id_tipo_uk UNIQUE (id, tipo),

    -- Truco: una subcategoría hereda obligatoriamente el tipo del padre.
    -- No puedes colgar "Uber" (GASTO) de "Salario" (INGRESO).
    -- Con id_padre NULL la FK no se evalúa (MATCH SIMPLE).
    CONSTRAINT categorias_padre_fk FOREIGN KEY (id_padre, tipo)
        REFERENCES categorias (id, tipo)
);

CREATE UNIQUE INDEX categorias_nombre_uk
    ON categorias (id_usuario, tipo, lower(nombre), COALESCE(id_padre, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE eliminado_en IS NULL;

CREATE INDEX categorias_usuario_idx ON categorias (id_usuario, tipo) WHERE eliminado_en IS NULL;
CREATE INDEX categorias_padre_idx   ON categorias (id_padre);
CREATE INDEX categorias_sync_idx    ON categorias (id_usuario, actualizado_en);

CREATE TRIGGER trg_categorias_actualizado
    BEFORE UPDATE ON categorias
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();


-- ---------------------------------------------------------------------
-- transacciones
--
-- Una transferencia es UNA sola fila con id_cuenta (origen) e
-- id_cuenta_destino. Se eligió esto sobre el patrón de dos filas para
-- que cada transacción sea una unidad atómica de sincronización: un
-- POST, un UUID, un reintento. La vista v_movimientos la "explota"
-- después para que las consultas de saldo sigan siendo simples.
-- ---------------------------------------------------------------------
CREATE TABLE transacciones (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario        UUID          NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    id_cuenta         UUID          NOT NULL REFERENCES cuentas (id) ON DELETE RESTRICT,
    id_cuenta_destino UUID          REFERENCES cuentas (id) ON DELETE RESTRICT,
    id_categoria      UUID,
    tipo              VARCHAR(15)   NOT NULL,
    monto             NUMERIC(12,2) NOT NULL,

    -- fecha  = el día contable del movimiento (el almuerzo de ayer).
    -- creado_en = cuándo lo registraste. No son lo mismo.
    fecha             DATE          NOT NULL,
    descripcion       VARCHAR(255),

    creado_en         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    eliminado_en      TIMESTAMPTZ,

    CONSTRAINT transacciones_tipo_chk
        CHECK (tipo IN ('INGRESO', 'GASTO', 'TRANSFERENCIA')),

    -- El signo lo determina el tipo, nunca el monto.
    CONSTRAINT transacciones_monto_chk CHECK (monto > 0),

    -- Una transferencia lleva destino y NO lleva categoría.
    -- Un ingreso/gasto lleva categoría y NO lleva destino.
    CONSTRAINT transacciones_forma_chk CHECK (
        (tipo = 'TRANSFERENCIA'
            AND id_cuenta_destino IS NOT NULL
            AND id_cuenta_destino <> id_cuenta
            AND id_categoria IS NULL)
        OR
        (tipo IN ('INGRESO', 'GASTO')
            AND id_cuenta_destino IS NULL
            AND id_categoria IS NOT NULL)
    ),

    -- El tipo de la categoría tiene que coincidir con el de la
    -- transacción. Con id_categoria NULL (transferencias) no aplica.
    CONSTRAINT transacciones_categoria_fk FOREIGN KEY (id_categoria, tipo)
        REFERENCES categorias (id, tipo) ON DELETE RESTRICT
);

-- Listado principal: últimos movimientos del usuario.
CREATE INDEX transacciones_feed_idx
    ON transacciones (id_usuario, fecha DESC)
    WHERE eliminado_en IS NULL;

-- Saldos y extractos por cuenta.
CREATE INDEX transacciones_cuenta_idx
    ON transacciones (id_usuario, id_cuenta, fecha)
    WHERE eliminado_en IS NULL;

CREATE INDEX transacciones_destino_idx
    ON transacciones (id_cuenta_destino)
    WHERE id_cuenta_destino IS NOT NULL AND eliminado_en IS NULL;

-- Agregados por categoría para los dashboards.
CREATE INDEX transacciones_categoria_idx
    ON transacciones (id_usuario, id_categoria, fecha)
    WHERE eliminado_en IS NULL;

-- Sincronización delta: incluye borradas a propósito (el cliente
-- necesita enterarse de los borrados).
CREATE INDEX transacciones_sync_idx
    ON transacciones (id_usuario, actualizado_en);

CREATE TRIGGER trg_transacciones_actualizado
    BEFORE UPDATE ON transacciones
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();


-- ---------------------------------------------------------------------
-- etiquetas (agrupación transversal: #Viaje2026)
-- ---------------------------------------------------------------------
CREATE TABLE etiquetas (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario      UUID         NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre          VARCHAR(50)  NOT NULL,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    eliminado_en    TIMESTAMPTZ
);

CREATE UNIQUE INDEX etiquetas_nombre_uk
    ON etiquetas (id_usuario, lower(nombre))
    WHERE eliminado_en IS NULL;

CREATE INDEX etiquetas_sync_idx ON etiquetas (id_usuario, actualizado_en);

CREATE TRIGGER trg_etiquetas_actualizado
    BEFORE UPDATE ON etiquetas
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();


CREATE TABLE transaccion_etiqueta (
    id_transaccion UUID NOT NULL REFERENCES transacciones (id) ON DELETE CASCADE,
    id_etiqueta    UUID NOT NULL REFERENCES etiquetas (id)     ON DELETE CASCADE,

    PRIMARY KEY (id_transaccion, id_etiqueta)
);

CREATE INDEX transaccion_etiqueta_inverso_idx
    ON transaccion_etiqueta (id_etiqueta, id_transaccion);


-- =====================================================================
-- Vistas de lectura
-- =====================================================================

-- Convierte cada transacción en uno o dos movimientos con signo, para
-- que sumar saldos sea un GROUP BY y ya. Las transferencias generan
-- dos filas: una negativa en el origen, otra positiva en el destino.
CREATE VIEW v_movimientos AS
    SELECT id AS id_transaccion,
           id_usuario,
           id_cuenta,
           fecha,
           CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END AS efecto
      FROM transacciones
     WHERE tipo IN ('INGRESO', 'GASTO')
       AND eliminado_en IS NULL

    UNION ALL

    SELECT id, id_usuario, id_cuenta, fecha, -monto
      FROM transacciones
     WHERE tipo = 'TRANSFERENCIA'
       AND eliminado_en IS NULL

    UNION ALL

    SELECT id, id_usuario, id_cuenta_destino, fecha, monto
      FROM transacciones
     WHERE tipo = 'TRANSFERENCIA'
       AND eliminado_en IS NULL;


-- Saldo vivo por cuenta. Nunca se desincroniza porque siempre se
-- recalcula. Con tu volumen (~2.000 filas al año) es instantáneo.
CREATE VIEW v_saldos AS
    SELECT c.id            AS id_cuenta,
           c.id_usuario,
           c.nombre,
           c.tipo,
           c.moneda,
           c.saldo_inicial + COALESCE(SUM(m.efecto), 0) AS saldo_actual
      FROM cuentas c
      LEFT JOIN v_movimientos m ON m.id_cuenta = c.id
     WHERE c.eliminado_en IS NULL
     GROUP BY c.id, c.id_usuario, c.nombre, c.tipo, c.moneda, c.saldo_inicial;


-- Gasto e ingreso por mes y categoría raíz, que es lo que alimenta
-- casi todos los gráficos. Sube las subcategorías a su padre.
CREATE VIEW v_resumen_mensual AS
    SELECT t.id_usuario,
           date_trunc('month', t.fecha)::date        AS mes,
           t.tipo,
           COALESCE(padre.id, cat.id)                AS id_categoria_raiz,
           COALESCE(padre.nombre, cat.nombre)        AS categoria_raiz,
           SUM(t.monto)                              AS total,
           COUNT(*)                                  AS movimientos
      FROM transacciones t
      JOIN categorias cat   ON cat.id = t.id_categoria
      LEFT JOIN categorias padre ON padre.id = cat.id_padre
     WHERE t.tipo IN ('INGRESO', 'GASTO')
       AND t.eliminado_en IS NULL
     GROUP BY t.id_usuario, mes, t.tipo,
              COALESCE(padre.id, cat.id),
              COALESCE(padre.nombre, cat.nombre);


-- =====================================================================
-- Pendiente para migraciones siguientes (no lo metas todavía):
--   V2 → tabla recurrentes + columna transacciones.id_recurrente
--   V3 → tabla presupuestos (id_usuario, id_categoria, mes, monto)
-- =====================================================================
