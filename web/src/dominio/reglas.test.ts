import { describe, expect, it } from 'vitest'
import {
  problemasPorCampo,
  validarCategoria,
  validarCuenta,
  validarEtiqueta,
  validarTransaccion,
} from './reglas.ts'
import type { Referencias } from './reglas.ts'
import * as f from '../pruebas/fabricas.ts'

/**
 * Cada prueba de este archivo corresponde a una restricción concreta de
 * V1__esquema_inicial.sql. Si una cae, significa que el cliente podría
 * escribir en IndexedDB una fila que Postgres rechazaría, y esa fila
 * atascaría la cola de sincronización en la Fase 2.
 */

const efectivo = f.cuenta({ id: 'cta-efectivo', nombre: 'Efectivo' })
const banco = f.cuenta({ id: 'cta-banco', nombre: 'Pichincha', tipo: 'DEBITO' })

const comida = f.categoria({ id: 'cat-comida', nombre: 'Comida', tipo: 'GASTO' })
const almuerzo = f.categoria({
  id: 'cat-almuerzo',
  nombre: 'Almuerzo',
  tipo: 'GASTO',
  id_padre: 'cat-comida',
})
const salario = f.categoria({
  id: 'cat-salario',
  nombre: 'Salario',
  tipo: 'INGRESO',
})

const refs: Referencias = {
  cuentas: [efectivo, banco],
  categorias: [comida, almuerzo, salario],
  etiquetas: [f.etiqueta({ id: 'etq-viaje', nombre: 'Viaje2026' })],
}

function campos(r: ReturnType<typeof validarTransaccion>) {
  return Object.keys(problemasPorCampo(r))
}

describe('validarTransaccion — transacciones_monto_chk', () => {
  it('exige monto mayor que cero: el signo lo da el tipo', () => {
    const r = validarTransaccion(
      { ...base(), monto: 0 },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('monto')

    expect(validarTransaccion({ ...base(), monto: -450 }, refs).ok).toBe(false)
    expect(validarTransaccion({ ...base(), monto: 1 }, refs).ok).toBe(true)
  })

  it('rechaza montos que no son enteros de centavos', () => {
    expect(validarTransaccion({ ...base(), monto: 4.5 }, refs).ok).toBe(false)
    expect(validarTransaccion({ ...base(), monto: NaN }, refs).ok).toBe(false)
  })
})

describe('validarTransaccion — transacciones_categoria_fk', () => {
  it('impide guardar un GASTO con categoría de INGRESO', () => {
    // Esta es la restricción que la FK compuesta (id_categoria, tipo)
    // garantiza en Postgres. Aquí falla antes, en la interfaz.
    const r = validarTransaccion(
      { ...base(), tipo: 'GASTO', id_categoria: 'cat-salario' },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_categoria')
  })

  it('acepta la combinación correcta', () => {
    expect(
      validarTransaccion(
        { ...base(), tipo: 'INGRESO', id_categoria: 'cat-salario' },
        refs,
      ).ok,
    ).toBe(true)
  })

  it('rechaza una categoría que no existe', () => {
    expect(
      validarTransaccion({ ...base(), id_categoria: 'cat-fantasma' }, refs).ok,
    ).toBe(false)
  })
})

describe('validarTransaccion — transacciones_forma_chk', () => {
  it('una transferencia lleva destino distinto del origen y sin categoría', () => {
    const ok = validarTransaccion(
      {
        ...base(),
        tipo: 'TRANSFERENCIA',
        id_cuenta: 'cta-efectivo',
        id_cuenta_destino: 'cta-banco',
        id_categoria: null,
      },
      refs,
    )
    expect(ok.ok).toBe(true)
  })

  it('rechaza una transferencia a la misma cuenta', () => {
    const r = validarTransaccion(
      {
        ...base(),
        tipo: 'TRANSFERENCIA',
        id_cuenta: 'cta-efectivo',
        id_cuenta_destino: 'cta-efectivo',
        id_categoria: null,
      },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_cuenta_destino')
  })

  it('rechaza una transferencia con categoría', () => {
    const r = validarTransaccion(
      {
        ...base(),
        tipo: 'TRANSFERENCIA',
        id_cuenta_destino: 'cta-banco',
        id_categoria: 'cat-comida',
      },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_categoria')
  })

  it('rechaza una transferencia sin destino', () => {
    const r = validarTransaccion(
      { ...base(), tipo: 'TRANSFERENCIA', id_categoria: null },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_cuenta_destino')
  })

  it('rechaza un gasto con cuenta de destino', () => {
    const r = validarTransaccion(
      { ...base(), id_cuenta_destino: 'cta-banco' },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_cuenta_destino')
  })

  it('rechaza un gasto sin categoría', () => {
    const r = validarTransaccion({ ...base(), id_categoria: null }, refs)
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_categoria')
  })
})

describe('validarTransaccion — resto', () => {
  it('exige una cuenta que exista', () => {
    const r = validarTransaccion({ ...base(), id_cuenta: 'cta-fantasma' }, refs)
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('id_cuenta')
  })

  it('exige una fecha contable válida', () => {
    expect(validarTransaccion({ ...base(), fecha: '2026-02-30' }, refs).ok).toBe(
      false,
    )
    expect(validarTransaccion({ ...base(), fecha: '02/09/2026' }, refs).ok).toBe(
      false,
    )
  })

  it('acepta una subcategoría cuyo tipo coincide', () => {
    expect(
      validarTransaccion({ ...base(), id_categoria: 'cat-almuerzo' }, refs).ok,
    ).toBe(true)
  })

  it('corta la descripción en el largo de la columna', () => {
    const r = validarTransaccion(
      { ...base(), descripcion: 'x'.repeat(256) },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(campos(r)).toContain('descripcion')
  })
})

describe('validarCategoria — categorias_padre_fk', () => {
  it('obliga a la subcategoría a heredar el tipo del padre', () => {
    const r = validarCategoria(
      { id: 'nueva', nombre: 'Uber', tipo: 'GASTO', id_padre: 'cat-salario' },
      refs,
    )
    expect(r.ok).toBe(false)
    expect(Object.keys(problemasPorCampo(r))).toContain('id_padre')
  })

  it('acepta una subcategoría del mismo tipo', () => {
    expect(
      validarCategoria(
        { id: 'nueva', nombre: 'Cena', tipo: 'GASTO', id_padre: 'cat-comida' },
        refs,
      ).ok,
    ).toBe(true)
  })

  it('impide un tercer nivel: el árbol es de dos', () => {
    const r = validarCategoria(
      { id: 'nueva', nombre: 'Menú', tipo: 'GASTO', id_padre: 'cat-almuerzo' },
      refs,
    )
    expect(r.ok).toBe(false)
  })

  it('impide que una categoría sea su propio padre', () => {
    const r = validarCategoria(
      { id: 'cat-comida', nombre: 'Comida', tipo: 'GASTO', id_padre: 'cat-comida' },
      refs,
    )
    expect(r.ok).toBe(false)
  })

  it('aplica el único por nombre solo dentro del mismo padre', () => {
    // Ya existe "Comida" en la raíz.
    expect(
      validarCategoria(
        { id: 'nueva', nombre: 'comida', tipo: 'GASTO', id_padre: null },
        refs,
      ).ok,
    ).toBe(false)
    // Pero "Comida" colgando de otro padre sí se puede.
    expect(
      validarCategoria(
        { id: 'nueva', nombre: 'Comida', tipo: 'GASTO', id_padre: 'cat-comida' },
        refs,
      ).ok,
    ).toBe(true)
    // Y una categoría de ingreso con el mismo nombre, también.
    expect(
      validarCategoria(
        { id: 'nueva', nombre: 'Comida', tipo: 'INGRESO', id_padre: null },
        refs,
      ).ok,
    ).toBe(true)
  })
})

describe('validarCuenta — cuentas_nombre_uk', () => {
  it('no distingue mayúsculas al comparar nombres', () => {
    const r = validarCuenta(
      { id: 'nueva', nombre: 'EFECTIVO', tipo: 'DEBITO', saldo_inicial: 0, moneda: 'USD' },
      refs,
    )
    expect(r.ok).toBe(false)
  })

  it('deja renombrarse a sí misma', () => {
    expect(
      validarCuenta(
        {
          id: 'cta-efectivo',
          nombre: 'Efectivo',
          tipo: 'EFECTIVO',
          saldo_inicial: 0,
          moneda: 'USD',
        },
        refs,
      ).ok,
    ).toBe(true)
  })

  it('acepta saldo inicial negativo: una tarjeta puede nacer con deuda', () => {
    expect(
      validarCuenta(
        {
          id: 'nueva',
          nombre: 'Visa',
          tipo: 'CREDITO',
          saldo_inicial: -24050,
          moneda: 'USD',
        },
        refs,
      ).ok,
    ).toBe(true)
  })

  it('exige nombre y tipo válidos', () => {
    expect(
      validarCuenta(
        { id: 'nueva', nombre: '   ', tipo: 'DEBITO', saldo_inicial: 0, moneda: 'USD' },
        refs,
      ).ok,
    ).toBe(false)
  })
})

describe('validarEtiqueta', () => {
  it('no admite dos etiquetas con el mismo nombre', () => {
    expect(
      validarEtiqueta({ id: 'nueva', nombre: 'viaje2026' }, refs).ok,
    ).toBe(false)
    expect(validarEtiqueta({ id: 'nueva', nombre: 'Comida' }, refs).ok).toBe(true)
  })
})

function base() {
  return {
    id: 'trx-1',
    id_cuenta: 'cta-efectivo',
    id_cuenta_destino: null,
    id_categoria: 'cat-comida',
    tipo: 'GASTO' as const,
    monto: 450,
    fecha: '2026-09-02',
    descripcion: null,
  }
}
