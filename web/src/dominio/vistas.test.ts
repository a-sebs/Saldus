import { describe, expect, it } from 'vitest'
import {
  agruparPorDia,
  delMes,
  esDeuda,
  movimientos,
  resumenMensual,
  saldoTotal,
  saldos,
  totalesDelMes,
} from './vistas.ts'
import * as f from '../pruebas/fabricas.ts'

const efectivo = f.cuenta({ id: 'cta-efectivo', nombre: 'Efectivo', saldo_inicial: 5000 })
const banco = f.cuenta({
  id: 'cta-banco',
  nombre: 'Pichincha',
  tipo: 'DEBITO',
  saldo_inicial: 100000,
})
const visa = f.cuenta({ id: 'cta-visa', nombre: 'Visa', tipo: 'CREDITO', saldo_inicial: 0 })

const comida = f.categoria({ id: 'cat-comida', nombre: 'Comida' })
const almuerzo = f.categoria({
  id: 'cat-almuerzo',
  nombre: 'Almuerzo',
  id_padre: 'cat-comida',
})
const transporte = f.categoria({ id: 'cat-transporte', nombre: 'Transporte' })
const salario = f.categoria({ id: 'cat-salario', nombre: 'Salario', tipo: 'INGRESO' })

const cuentas = [efectivo, banco, visa]
const categorias = [comida, almuerzo, transporte, salario]

describe('movimientos — espejo de v_movimientos', () => {
  it('parte la transferencia en dos movimientos con signo', () => {
    const t = f.transaccion({
      tipo: 'TRANSFERENCIA',
      id_cuenta: 'cta-banco',
      id_cuenta_destino: 'cta-efectivo',
      id_categoria: null,
      monto: 20000,
    })

    const m = movimientos([t])
    expect(m).toHaveLength(2)
    expect(m.find((x) => x.id_cuenta === 'cta-banco')?.efecto).toBe(-20000)
    expect(m.find((x) => x.id_cuenta === 'cta-efectivo')?.efecto).toBe(20000)
    // Las dos filas comparten el id de la transacción: sigue siendo una
    // sola unidad de sincronización.
    expect(new Set(m.map((x) => x.id_transaccion)).size).toBe(1)
  })

  it('da signo negativo al gasto y positivo al ingreso', () => {
    const gasto = f.transaccion({ tipo: 'GASTO', monto: 450 })
    const ingreso = f.transaccion({
      tipo: 'INGRESO',
      monto: 120000,
      id_categoria: 'cat-salario',
    })
    expect(movimientos([gasto])[0]?.efecto).toBe(-450)
    expect(movimientos([ingreso])[0]?.efecto).toBe(120000)
  })

  it('ignora las filas borradas suavemente', () => {
    const borrada = f.transaccion({ eliminado_en: '2026-09-02T15:00:00.000Z' })
    expect(movimientos([borrada])).toHaveLength(0)
  })
})

describe('saldos — espejo de v_saldos', () => {
  it('recalcula el saldo desde el inicial más los movimientos', () => {
    const t = [
      f.transaccion({ id_cuenta: 'cta-efectivo', tipo: 'GASTO', monto: 450 }),
      f.transaccion({
        id_cuenta: 'cta-banco',
        tipo: 'INGRESO',
        monto: 120000,
        id_categoria: 'cat-salario',
      }),
    ]

    const s = saldos(cuentas, t)
    expect(s.find((x) => x.id_cuenta === 'cta-efectivo')?.saldo_actual).toBe(4550)
    expect(s.find((x) => x.id_cuenta === 'cta-banco')?.saldo_actual).toBe(220000)
  })

  it('una transferencia mueve los dos saldos y no cambia el total', () => {
    const t = [
      f.transaccion({
        tipo: 'TRANSFERENCIA',
        id_cuenta: 'cta-banco',
        id_cuenta_destino: 'cta-efectivo',
        id_categoria: null,
        monto: 20000,
      }),
    ]

    const s = saldos(cuentas, t)
    expect(s.find((x) => x.id_cuenta === 'cta-banco')?.saldo_actual).toBe(80000)
    expect(s.find((x) => x.id_cuenta === 'cta-efectivo')?.saldo_actual).toBe(25000)
    expect(saldoTotal(s)).toBe(saldoTotal(saldos(cuentas, [])))
  })

  it('una tarjeta de crédito con consumo resta sola del total', () => {
    const t = [f.transaccion({ id_cuenta: 'cta-visa', tipo: 'GASTO', monto: 24050 })]
    const s = saldos(cuentas, t)
    const tarjeta = s.find((x) => x.id_cuenta === 'cta-visa')

    expect(tarjeta?.saldo_actual).toBe(-24050)
    expect(esDeuda(tarjeta!)).toBe(true)
    expect(saldoTotal(s)).toBe(5000 + 100000 - 24050)
  })

  it('acepta una fecha de corte', () => {
    const t = [
      f.transaccion({ id_cuenta: 'cta-efectivo', monto: 450, fecha: '2026-09-01' }),
      f.transaccion({ id_cuenta: 'cta-efectivo', monto: 1000, fecha: '2026-09-15' }),
    ]
    const s = saldos(cuentas, t, '2026-09-10')
    expect(s.find((x) => x.id_cuenta === 'cta-efectivo')?.saldo_actual).toBe(4550)
  })

  it('no lista cuentas borradas', () => {
    const borrada = f.cuenta({ id: 'cta-vieja', eliminado_en: '2026-01-01T00:00:00.000Z' })
    expect(saldos([...cuentas, borrada], []).map((s) => s.id_cuenta)).not.toContain(
      'cta-vieja',
    )
  })
})

describe('totalesDelMes', () => {
  it('no cuenta las transferencias como gasto', () => {
    // Este es el error clásico que hace mentir a una app de finanzas:
    // pasar plata del banco al efectivo no es gastarla.
    const t = [
      f.transaccion({ tipo: 'GASTO', monto: 450, fecha: '2026-09-02' }),
      f.transaccion({
        tipo: 'INGRESO',
        monto: 120000,
        fecha: '2026-09-01',
        id_categoria: 'cat-salario',
      }),
      f.transaccion({
        tipo: 'TRANSFERENCIA',
        monto: 50000,
        fecha: '2026-09-03',
        id_cuenta_destino: 'cta-efectivo',
        id_categoria: null,
      }),
    ]

    const r = totalesDelMes(t, '2026-09-15')
    expect(r.gastos).toBe(450)
    expect(r.ingresos).toBe(120000)
    expect(r.balance).toBe(119550)
    expect(r.movimientos).toBe(2)
  })

  it('solo cuenta el mes pedido', () => {
    const t = [
      f.transaccion({ monto: 450, fecha: '2026-09-30' }),
      f.transaccion({ monto: 999, fecha: '2026-10-01' }),
    ]
    expect(totalesDelMes(t, '2026-09-01').gastos).toBe(450)
    expect(delMes(t, '2026-10-01')).toHaveLength(1)
  })
})

describe('resumenMensual — espejo de v_resumen_mensual', () => {
  it('sube las subcategorías a su categoría raíz', () => {
    const t = [
      f.transaccion({ id_categoria: 'cat-almuerzo', monto: 450 }),
      f.transaccion({ id_categoria: 'cat-comida', monto: 1000 }),
      f.transaccion({ id_categoria: 'cat-transporte', monto: 35 }),
    ]

    const r = resumenMensual(t, categorias)
    const fila = r.find((x) => x.id_categoria_raiz === 'cat-comida')
    expect(fila?.total).toBe(1450)
    expect(fila?.movimientos).toBe(2)
    expect(fila?.categoria_raiz).toBe('Comida')
    // Ordenado de mayor a menor, que es como se lee.
    expect(r[0]?.id_categoria_raiz).toBe('cat-comida')
  })

  it('deja fuera las transferencias', () => {
    const t = [
      f.transaccion({
        tipo: 'TRANSFERENCIA',
        id_categoria: null,
        id_cuenta_destino: 'cta-efectivo',
        monto: 50000,
      }),
    ]
    expect(resumenMensual(t, categorias)).toHaveLength(0)
  })

  it('separa ingreso de gasto aunque compartan mes', () => {
    const t = [
      f.transaccion({ tipo: 'GASTO', id_categoria: 'cat-comida', monto: 450 }),
      f.transaccion({ tipo: 'INGRESO', id_categoria: 'cat-salario', monto: 120000 }),
    ]
    const r = resumenMensual(t, categorias)
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.tipo).sort()).toEqual(['GASTO', 'INGRESO'])
  })
})

describe('agruparPorDia', () => {
  it('agrupa por día contable con subtotal, del más reciente al más viejo', () => {
    const t = [
      f.transaccion({ monto: 450, fecha: '2026-09-01' }),
      f.transaccion({ monto: 1000, fecha: '2026-09-02' }),
      f.transaccion({
        tipo: 'INGRESO',
        monto: 5000,
        fecha: '2026-09-02',
        id_categoria: 'cat-salario',
      }),
    ]

    const g = agruparPorDia(t)
    expect(g.map((x) => x.fecha)).toEqual(['2026-09-02', '2026-09-01'])
    expect(g[0]?.subtotal).toBe(4000) // 5000 de ingreso − 1000 de gasto
    expect(g[1]?.subtotal).toBe(-450)
  })

  it('no mete las transferencias en el subtotal del día', () => {
    const t = [
      f.transaccion({
        tipo: 'TRANSFERENCIA',
        monto: 50000,
        id_categoria: null,
        id_cuenta_destino: 'cta-efectivo',
        fecha: '2026-09-02',
      }),
    ]
    expect(agruparPorDia(t)[0]?.subtotal).toBe(0)
  })
})
