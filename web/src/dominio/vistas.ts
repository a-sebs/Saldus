/**
 * Vistas — equivalentes en TypeScript de las vistas de lectura del
 * esquema. Mismos nombres a propósito, para que el mapeo con el SQL sea
 * obvio cuando en la Fase 2 haya que comparar un saldo del servidor con
 * uno del teléfono.
 *
 * Todo se recalcula en memoria a cada lectura. Con ~2.000 filas al año
 * eso es instantáneo, y a cambio **un saldo nunca se desincroniza**: no
 * existe ningún `saldo_actual` guardado que pueda quedar mal.
 */

import type {
  Categoria,
  Centavos,
  Cuenta,
  FechaContable,
  FilaResumenMensual,
  Movimiento,
  SaldoCuenta,
  Transaccion,
  UUID,
} from './tipos.ts'
import { primerDiaDelMes } from './fechas.ts'

/** ¿La fila está viva? Equivale al `WHERE eliminado_en IS NULL` del SQL. */
export function viva<T extends { eliminado_en: string | null }>(fila: T): boolean {
  return fila.eliminado_en === null
}

export function vivas<T extends { eliminado_en: string | null }>(
  filas: readonly T[],
): T[] {
  return filas.filter(viva)
}

/**
 * Espejo de `v_movimientos`.
 *
 * Convierte cada transacción en uno o dos movimientos con signo, para
 * que sumar saldos sea agrupar y ya. Una transferencia genera dos filas:
 * negativa en el origen y positiva en el destino. Es lo que permite
 * guardar la transferencia como **una sola fila** —una unidad atómica de
 * sincronización— sin complicar las consultas de saldo.
 */
export function movimientos(
  transacciones: readonly Transaccion[],
): Movimiento[] {
  const salida: Movimiento[] = []

  for (const t of transacciones) {
    if (!viva(t)) continue

    if (t.tipo === 'INGRESO' || t.tipo === 'GASTO') {
      salida.push({
        id_transaccion: t.id,
        id_usuario: t.id_usuario,
        id_cuenta: t.id_cuenta,
        fecha: t.fecha,
        efecto: t.tipo === 'INGRESO' ? t.monto : -t.monto,
      })
      continue
    }

    // TRANSFERENCIA: sale de una cuenta y entra en otra.
    salida.push({
      id_transaccion: t.id,
      id_usuario: t.id_usuario,
      id_cuenta: t.id_cuenta,
      fecha: t.fecha,
      efecto: -t.monto,
    })
    if (t.id_cuenta_destino !== null) {
      salida.push({
        id_transaccion: t.id,
        id_usuario: t.id_usuario,
        id_cuenta: t.id_cuenta_destino,
        fecha: t.fecha,
        efecto: t.monto,
      })
    }
  }

  return salida
}

/**
 * Espejo de `v_saldos`: `saldo_inicial + Σ efecto`.
 *
 * `hasta` permite el saldo a una fecha de corte; sin él, el saldo vivo.
 */
export function saldos(
  cuentas: readonly Cuenta[],
  transacciones: readonly Transaccion[],
  hasta?: FechaContable,
): SaldoCuenta[] {
  const efectos = new Map<UUID, Centavos>()

  for (const m of movimientos(transacciones)) {
    if (hasta !== undefined && m.fecha > hasta) continue
    efectos.set(m.id_cuenta, (efectos.get(m.id_cuenta) ?? 0) + m.efecto)
  }

  return vivas(cuentas).map((c) => ({
    id_cuenta: c.id,
    id_usuario: c.id_usuario,
    nombre: c.nombre,
    tipo: c.tipo,
    moneda: c.moneda,
    saldo_actual: c.saldo_inicial + (efectos.get(c.id) ?? 0),
  }))
}

/**
 * Saldo total sumando todas las cuentas vivas.
 *
 * Una tarjeta de crédito con consumo tiene saldo negativo, así que resta
 * sola: no hace falta ningún caso especial por tipo de cuenta. Lo que sí
 * cambia por tipo es **cómo se presenta** (ver `esDeuda`).
 */
export function saldoTotal(saldosCuenta: readonly SaldoCuenta[]): Centavos {
  let total = 0
  for (const s of saldosCuenta) total += s.saldo_actual
  return total
}

/**
 * Una tarjeta de crédito en negativo no es "tienes -240.50", es "debes
 * 240.50". El signo crudo es correcto para sumar y confuso para leer.
 */
export function esDeuda(saldo: SaldoCuenta): boolean {
  return saldo.tipo === 'CREDITO' && saldo.saldo_actual < 0
}

/**
 * Espejo de `v_resumen_mensual`: totales por mes y **categoría raíz**,
 * subiendo cada subcategoría a su padre. Es lo que alimenta el resumen.
 */
export function resumenMensual(
  transacciones: readonly Transaccion[],
  categorias: readonly Categoria[],
): FilaResumenMensual[] {
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const acumulado = new Map<string, FilaResumenMensual>()

  for (const t of transacciones) {
    if (!viva(t)) continue
    // Las transferencias no entran: no son ni ingreso ni gasto.
    if (t.tipo === 'TRANSFERENCIA') continue
    if (t.id_categoria === null) continue

    const categoria = porId.get(t.id_categoria)
    if (!categoria) continue

    const raiz =
      categoria.id_padre !== null
        ? (porId.get(categoria.id_padre) ?? categoria)
        : categoria

    const mes = primerDiaDelMes(t.fecha)
    const clave = `${mes}|${t.tipo}|${raiz.id}`

    const fila = acumulado.get(clave)
    if (fila) {
      fila.total += t.monto
      fila.movimientos += 1
    } else {
      acumulado.set(clave, {
        id_usuario: t.id_usuario,
        mes,
        tipo: t.tipo,
        id_categoria_raiz: raiz.id,
        categoria_raiz: raiz.nombre,
        total: t.monto,
        movimientos: 1,
      })
    }
  }

  return [...acumulado.values()].sort((a, b) => b.total - a.total)
}

/* =====================================================================
   Agregados que usan las pantallas
   ===================================================================== */

export interface TotalesDelMes {
  mes: FechaContable
  ingresos: Centavos
  gastos: Centavos
  /** ingresos − gastos. Las transferencias no cuentan. */
  balance: Centavos
  movimientos: number
}

/**
 * Total del mes. **Las transferencias no suman al gasto**: mover dinero
 * de la cuenta al efectivo no es gastarlo, y contarlo como gasto es el
 * error clásico que hace que una app de finanzas mienta.
 */
export function totalesDelMes(
  transacciones: readonly Transaccion[],
  mes: FechaContable,
): TotalesDelMes {
  const primerDia = primerDiaDelMes(mes)
  let ingresos = 0
  let gastos = 0
  let n = 0

  for (const t of transacciones) {
    if (!viva(t)) continue
    if (primerDiaDelMes(t.fecha) !== primerDia) continue
    if (t.tipo === 'INGRESO') ingresos += t.monto
    else if (t.tipo === 'GASTO') gastos += t.monto
    else continue // transferencia: ni ingreso ni gasto
    n += 1
  }

  return {
    mes: primerDia,
    ingresos,
    gastos,
    balance: ingresos - gastos,
    movimientos: n,
  }
}

/** Transacciones de un mes, ordenadas de la más reciente a la más antigua. */
export function delMes(
  transacciones: readonly Transaccion[],
  mes: FechaContable,
): Transaccion[] {
  const primerDia = primerDiaDelMes(mes)
  return vivas(transacciones)
    .filter((t) => primerDiaDelMes(t.fecha) === primerDia)
    .sort(ordenLista)
}

/**
 * Orden de la lista: por día contable descendente y, dentro del mismo
 * día, por hora de registro descendente. Lo último que anotaste queda
 * arriba de su día, que es donde lo buscas.
 */
export function ordenLista(a: Transaccion, b: Transaccion): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  if (a.creado_en !== b.creado_en) return a.creado_en < b.creado_en ? 1 : -1
  return 0
}

export interface GrupoDia {
  fecha: FechaContable
  transacciones: Transaccion[]
  /** Ingresos − gastos del día. Las transferencias no entran. */
  subtotal: Centavos
}

/** Agrupa por día contable, que es como está rayado un libro mayor. */
export function agruparPorDia(transacciones: readonly Transaccion[]): GrupoDia[] {
  const grupos = new Map<FechaContable, Transaccion[]>()

  for (const t of [...transacciones].sort(ordenLista)) {
    const lista = grupos.get(t.fecha)
    if (lista) lista.push(t)
    else grupos.set(t.fecha, [t])
  }

  return [...grupos.entries()].map(([fecha, lista]) => {
    let subtotal = 0
    for (const t of lista) {
      if (t.tipo === 'INGRESO') subtotal += t.monto
      else if (t.tipo === 'GASTO') subtotal -= t.monto
    }
    return { fecha, transacciones: lista, subtotal }
  })
}
