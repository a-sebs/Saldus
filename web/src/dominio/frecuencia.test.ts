import { describe, expect, it } from 'vitest'
import {
  cuentaMasUsada,
  hijaMasUsada,
  hijasPorFrecuencia,
  montosFrecuentes,
  ordenarPorFrecuencia,
  puntajesDeUso,
  raicesPorFrecuencia,
} from './frecuencia.ts'
import * as f from '../pruebas/fabricas.ts'

/** 2026-09-02, 14:30 en Ecuador. */
const AHORA = Date.UTC(2026, 8, 2, 19, 30)

const comida = f.categoria({ id: 'cat-comida', nombre: 'Comida' })
const almuerzo = f.categoria({
  id: 'cat-almuerzo',
  nombre: 'Almuerzo',
  id_padre: 'cat-comida',
})
const transporte = f.categoria({ id: 'cat-transporte', nombre: 'Transporte' })
const vivienda = f.categoria({ id: 'cat-vivienda', nombre: 'Vivienda' })
const salario = f.categoria({ id: 'cat-salario', nombre: 'Salario', tipo: 'INGRESO' })

const categorias = [comida, almuerzo, transporte, vivienda, salario]

describe('puntajesDeUso', () => {
  it('pesa un movimiento de hoy más que uno de hace un mes', () => {
    const p = puntajesDeUso(
      [
        f.transaccion({ id_categoria: 'cat-comida', fecha: '2026-09-02' }),
        f.transaccion({ id_categoria: 'cat-transporte', fecha: '2026-08-03' }),
      ],
      AHORA,
    )

    expect(p.get('cat-comida')).toBeCloseTo(1, 5)
    // 30 días atrás es exactamente media vida.
    expect(p.get('cat-transporte')).toBeCloseTo(0.5, 5)
  })

  it('descarta lo que quedó fuera de la ventana de 60 días', () => {
    const p = puntajesDeUso(
      [f.transaccion({ id_categoria: 'cat-comida', fecha: '2026-06-01' })],
      AHORA,
    )
    expect(p.get('cat-comida')).toBeUndefined()
  })

  it('cuenta como de hoy un movimiento con fecha futura', () => {
    // Registrar por adelantado el sueldo del día 30 es normal.
    const p = puntajesDeUso(
      [f.transaccion({ id_categoria: 'cat-salario', fecha: '2026-09-30' })],
      AHORA,
    )
    expect(p.get('cat-salario')).toBeCloseTo(1, 5)
  })

  it('no cuenta transferencias ni filas borradas', () => {
    const p = puntajesDeUso(
      [
        f.transaccion({ id_categoria: null, tipo: 'TRANSFERENCIA' }),
        f.transaccion({
          id_categoria: 'cat-comida',
          eliminado_en: '2026-09-02T15:00:00.000Z',
        }),
      ],
      AHORA,
    )
    expect(p.size).toBe(0)
  })
})

describe('ordenarPorFrecuencia', () => {
  it('pone arriba lo más usado hace poco, no lo alfabético', () => {
    const t = [
      f.transaccion({ id_categoria: 'cat-transporte', fecha: '2026-09-02' }),
      f.transaccion({ id_categoria: 'cat-transporte', fecha: '2026-09-01' }),
      f.transaccion({ id_categoria: 'cat-vivienda', fecha: '2026-08-05' }),
    ]

    const orden = ordenarPorFrecuencia(categorias, t, 'GASTO', AHORA).map((c) => c.nombre)
    expect(orden[0]).toBe('Transporte')
    // Alfabéticamente "Almuerzo" y "Comida" irían antes que "Transporte".
    expect(orden.indexOf('Transporte')).toBeLessThan(orden.indexOf('Comida'))
  })

  it('la lista plana mide el uso propio, no el de las hijas', () => {
    // La opción directa se asigna tal cual, así que "Comida" no puede
    // colarse arriba por lo que se registró en "Almuerzo": empujaría
    // fuera de pantalla justo a la que sí se usa.
    const t = [
      f.transaccion({ id_categoria: 'cat-almuerzo', fecha: '2026-09-02' }),
      f.transaccion({ id_categoria: 'cat-almuerzo', fecha: '2026-09-01' }),
      f.transaccion({ id_categoria: 'cat-transporte', fecha: '2026-09-02' }),
    ]

    const orden = ordenarPorFrecuencia(categorias, t, 'GASTO', AHORA).map((c) => c.nombre)
    expect(orden[0]).toBe('Almuerzo')
    expect(orden.indexOf('Comida')).toBeGreaterThan(orden.indexOf('Transporte'))
  })

  it('sin historial respeta el orden de la semilla', () => {
    const orden = ordenarPorFrecuencia(categorias, [], 'GASTO', AHORA).map((c) => c.nombre)
    expect(orden).toEqual(['Comida', 'Almuerzo', 'Transporte', 'Vivienda'])
  })

  it('filtra por tipo: en un gasto no aparecen categorías de ingreso', () => {
    const orden = ordenarPorFrecuencia(categorias, [], 'GASTO', AHORA)
    expect(orden.map((c) => c.nombre)).not.toContain('Salario')
    expect(ordenarPorFrecuencia(categorias, [], 'INGRESO', AHORA)).toHaveLength(1)
  })

  it('desempata alfabéticamente cuando el puntaje coincide', () => {
    const t = [
      f.transaccion({ id_categoria: 'cat-vivienda', fecha: '2026-09-02' }),
      f.transaccion({ id_categoria: 'cat-transporte', fecha: '2026-09-02' }),
    ]
    const orden = ordenarPorFrecuencia(categorias, t, 'GASTO', AHORA).map((c) => c.nombre)
    expect(orden.slice(0, 2)).toEqual(['Transporte', 'Vivienda'])
  })
})

describe('raicesPorFrecuencia', () => {
  it('sube a la raíz el uso de sus hijas', () => {
    // Todo se registra en "Comida > Almuerzo", así que en el selector de
    // primer nivel "Comida" tiene que salir arriba.
    const t = [
      f.transaccion({ id_categoria: 'cat-almuerzo', fecha: '2026-09-02' }),
      f.transaccion({ id_categoria: 'cat-almuerzo', fecha: '2026-09-01' }),
      f.transaccion({ id_categoria: 'cat-transporte', fecha: '2026-09-02' }),
    ]

    const raices = raicesPorFrecuencia(categorias, t, 'GASTO', AHORA)
    expect(raices.map((c) => c.nombre)).toEqual(['Comida', 'Transporte', 'Vivienda'])
    // Y una subcategoría nunca aparece en el primer nivel.
    expect(raices.map((c) => c.nombre)).not.toContain('Almuerzo')
  })
})

describe('hijasPorFrecuencia', () => {
  it('lista solo las hijas del padre pedido', () => {
    const cena = f.categoria({ id: 'cat-cena', nombre: 'Cena', id_padre: 'cat-comida' })
    const hijas = hijasPorFrecuencia([...categorias, cena], [], 'cat-comida', AHORA)
    expect(hijas.map((c) => c.nombre)).toEqual(['Almuerzo', 'Cena'])
  })
})

describe('montosFrecuentes', () => {
  it('sugiere lo que se repite, no lo que pasó una vez', () => {
    const t = [
      f.transaccion({ monto: 35, fecha: '2026-09-02' }),
      f.transaccion({ monto: 35, fecha: '2026-09-01' }),
      f.transaccion({ monto: 35, fecha: '2026-08-30' }),
      f.transaccion({ monto: 250, fecha: '2026-09-01' }),
      f.transaccion({ monto: 250, fecha: '2026-08-28' }),
      f.transaccion({ monto: 99999, fecha: '2026-09-01' }),
    ]

    expect(montosFrecuentes(t, 'GASTO', 4, AHORA)).toEqual([35, 250])
  })

  it('no sugiere nada sin historial', () => {
    expect(montosFrecuentes([], 'GASTO', 4, AHORA)).toEqual([])
  })
})

describe('cuentaMasUsada', () => {
  it('devuelve con la que más se ha movido dinero hace poco', () => {
    const t = [
      f.transaccion({ id_cuenta: 'cta-efectivo', fecha: '2026-09-02' }),
      f.transaccion({ id_cuenta: 'cta-efectivo', fecha: '2026-09-01' }),
      f.transaccion({ id_cuenta: 'cta-banco', fecha: '2026-08-10' }),
    ]
    expect(cuentaMasUsada(t, AHORA)).toBe('cta-efectivo')
  })

  it('no cuenta las transferencias: no dicen dónde se gasta', () => {
    const t = [
      f.transaccion({
        id_cuenta: 'cta-banco',
        tipo: 'TRANSFERENCIA',
        id_categoria: null,
        id_cuenta_destino: 'cta-efectivo',
        fecha: '2026-09-02',
      }),
    ]
    expect(cuentaMasUsada(t, AHORA)).toBeNull()
  })

  it('sin historial no inventa una preselección', () => {
    expect(cuentaMasUsada([], AHORA)).toBeNull()
  })
})

describe('hijaMasUsada', () => {
  it('devuelve la subcategoría con más uso reciente', () => {
    const cena = f.categoria({ id: 'cat-cena', nombre: 'Cena', id_padre: 'cat-comida' })
    const t = [
      f.transaccion({ id_categoria: 'cat-almuerzo', fecha: '2026-09-02' }),
      f.transaccion({ id_categoria: 'cat-almuerzo', fecha: '2026-09-01' }),
      f.transaccion({ id_categoria: 'cat-cena', fecha: '2026-08-20' }),
    ]

    expect(
      hijaMasUsada([...categorias, cena], t, 'cat-comida', AHORA)?.nombre,
    ).toBe('Almuerzo')
  })

  it('no inventa una preselección si no hay historial', () => {
    expect(hijaMasUsada(categorias, [], 'cat-comida', AHORA)).toBeNull()
  })
})
