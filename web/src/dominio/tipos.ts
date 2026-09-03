/**
 * Tipos del dominio — espejo campo por campo de V1__esquema_inicial.sql.
 *
 * Se mantienen los nombres del SQL (snake_case, español) a propósito: en
 * la Fase 2 el JSON de sincronización tiene que mapear directo contra las
 * entidades JPA. Renombrar aquí a camelCase obligaría a una capa de
 * traducción que no aporta nada.
 *
 * Única diferencia deliberada con el SQL: el dinero. En Postgres es
 * NUMERIC(12,2); aquí son **enteros de centavos**, porque en JavaScript
 * 0.1 + 0.2 no es 0.3. La conversión vive en `dinero.ts`.
 */

/** UUID v4 generado en el cliente (`crypto.randomUUID()`). */
export type UUID = string

/**
 * Día contable en formato `'YYYY-MM-DD'`.
 *
 * String y no `Date` por tres razones: ordena lexicográficamente igual
 * que cronológicamente, no arrastra zona horaria, y es exactamente lo
 * que espera una columna DATE de Postgres.
 */
export type FechaContable = string

/** Instante ISO 8601 en UTC (`2026-09-02T19:50:36.000Z`). TIMESTAMPTZ. */
export type Instante = string

/** Dinero como entero de centavos. 1250 = $12.50. Nunca un decimal. */
export type Centavos = number

export type TipoCuenta = 'DEBITO' | 'CREDITO' | 'EFECTIVO'
export type TipoCategoria = 'INGRESO' | 'GASTO'
export type TipoTransaccion = 'INGRESO' | 'GASTO' | 'TRANSFERENCIA'

export const TIPOS_CUENTA: readonly TipoCuenta[] = [
  'DEBITO',
  'CREDITO',
  'EFECTIVO',
]
export const TIPOS_CATEGORIA: readonly TipoCategoria[] = ['INGRESO', 'GASTO']
export const TIPOS_TRANSACCION: readonly TipoTransaccion[] = [
  'INGRESO',
  'GASTO',
  'TRANSFERENCIA',
]

/** Campos que llevan todas las tablas sincronizables. */
interface Sincronizable {
  creado_en: Instante
  actualizado_en: Instante
  /** Borrado suave. Con sync offline un DELETE duro es irrecuperable. */
  eliminado_en: Instante | null
}

export interface Usuario {
  id: UUID
  email: string
  nombre: string | null
  es_demo: boolean
  creado_en: Instante
  actualizado_en: Instante
}

export interface Cuenta extends Sincronizable {
  id: UUID
  id_usuario: UUID
  nombre: string
  tipo: TipoCuenta
  /** NUMERIC(12,2) en Postgres, centavos aquí. */
  saldo_inicial: Centavos
  moneda: 'USD'
  archivada: boolean
}

export interface Categoria extends Sincronizable {
  id: UUID
  id_usuario: UUID
  nombre: string
  tipo: TipoCategoria
  /**
   * Padre en el árbol. La FK compuesta `(id_padre, tipo)` del esquema
   * obliga a que una subcategoría herede el tipo del padre: no puedes
   * colgar "Uber" (GASTO) de "Salario" (INGRESO).
   */
  id_padre: UUID | null
}

export interface Transaccion extends Sincronizable {
  id: UUID
  id_usuario: UUID
  /** Cuenta de origen. En un ingreso, la que recibe. */
  id_cuenta: UUID
  /** Solo en TRANSFERENCIA. En ingreso y gasto es null. */
  id_cuenta_destino: UUID | null
  /** Solo en INGRESO y GASTO. En transferencia es null. */
  id_categoria: UUID | null
  tipo: TipoTransaccion
  /** Siempre positivo. El signo lo determina `tipo`, no el monto. */
  monto: Centavos
  /** El día contable del movimiento: el almuerzo de ayer va con ayer. */
  fecha: FechaContable
  descripcion: string | null
}

export interface Etiqueta extends Sincronizable {
  id: UUID
  id_usuario: UUID
  nombre: string
}

export interface TransaccionEtiqueta {
  id_transaccion: UUID
  id_etiqueta: UUID
}

/* =====================================================================
   Cola de salida (outbox)

   Se crea ya en la Fase 1 aunque todavía nadie la drene: son unas pocas
   líneas ahora, contra recorrer cada sitio de escritura después. En la
   Fase 2 esto es exactamente lo que consume `POST /sync/push`.
   ===================================================================== */

export type EntidadSync =
  | 'cuentas'
  | 'categorias'
  | 'transacciones'
  | 'etiquetas'
  | 'transaccion_etiqueta'

export interface OperacionPendiente {
  /** Autoincremental de Dexie: conserva el orden de las escrituras. */
  seq?: number
  entidad: EntidadSync
  /** Id de la fila afectada. Compuesto en transaccion_etiqueta. */
  id: string
  /**
   * Siempre 'upsert': el borrado es suave, así que borrar es escribir
   * `eliminado_en`. No existe una operación de borrado real.
   */
  op: 'upsert'
  encolado_en: Instante
  intentos: number
}

/** Clave/valor local: `ultimo_sync_en`, `ultima_cuenta_usada`, etc. */
export interface Meta {
  clave: string
  valor: unknown
}

/* =====================================================================
   Filas de las vistas de lectura (equivalentes TS de las vistas SQL)
   ===================================================================== */

/** Espejo de `v_movimientos`: una transferencia se parte en dos filas. */
export interface Movimiento {
  id_transaccion: UUID
  id_usuario: UUID
  id_cuenta: UUID
  fecha: FechaContable
  /** Con signo: negativo si sale de la cuenta, positivo si entra. */
  efecto: Centavos
}

/** Espejo de `v_saldos`. `saldo_actual` se recalcula, nunca se guarda. */
export interface SaldoCuenta {
  id_cuenta: UUID
  id_usuario: UUID
  nombre: string
  tipo: TipoCuenta
  moneda: 'USD'
  saldo_actual: Centavos
}

/** Espejo de `v_resumen_mensual`: sube las subcategorías a su raíz. */
export interface FilaResumenMensual {
  id_usuario: UUID
  /** Primer día del mes, `'YYYY-MM-01'`. */
  mes: FechaContable
  tipo: TipoCategoria
  id_categoria_raiz: UUID
  categoria_raiz: string
  total: Centavos
  movimientos: number
}
