/**
 * Fábricas de datos para las pruebas.
 *
 * Existen para que cada prueba diga solo lo que le importa: si una
 * prueba sobre el tipo de una categoría tuviera que rellenar
 * `creado_en`, `actualizado_en` y `eliminado_en`, el detalle que se está
 * probando quedaría enterrado.
 */

import type {
  Categoria,
  Cuenta,
  Etiqueta,
  TipoCuenta,
  Transaccion,
} from '../dominio/tipos.ts'

export const USUARIO = '00000000-0000-4000-8000-000000000001'

const INSTANTE = '2026-09-02T14:00:00.000Z'

let contador = 0
/** Ids estables y legibles: cuando una prueba falla, se lee cuál es. */
export function id(prefijo = 'x'): string {
  contador += 1
  return `${prefijo}-${String(contador).padStart(4, '0')}`
}

export function cuenta(parcial: Partial<Cuenta> = {}): Cuenta {
  return {
    id: id('cta'),
    id_usuario: USUARIO,
    nombre: 'Efectivo',
    tipo: 'EFECTIVO' as TipoCuenta,
    saldo_inicial: 0,
    moneda: 'USD',
    archivada: false,
    creado_en: INSTANTE,
    actualizado_en: INSTANTE,
    eliminado_en: null,
    ...parcial,
  }
}

export function categoria(parcial: Partial<Categoria> = {}): Categoria {
  return {
    id: id('cat'),
    id_usuario: USUARIO,
    nombre: 'Comida',
    tipo: 'GASTO',
    id_padre: null,
    creado_en: INSTANTE,
    actualizado_en: INSTANTE,
    eliminado_en: null,
    ...parcial,
  }
}

export function etiqueta(parcial: Partial<Etiqueta> = {}): Etiqueta {
  return {
    id: id('etq'),
    id_usuario: USUARIO,
    nombre: 'Viaje',
    creado_en: INSTANTE,
    actualizado_en: INSTANTE,
    eliminado_en: null,
    ...parcial,
  }
}

export function transaccion(parcial: Partial<Transaccion> = {}): Transaccion {
  return {
    id: id('trx'),
    id_usuario: USUARIO,
    id_cuenta: 'cta-0001',
    id_cuenta_destino: null,
    id_categoria: 'cat-0001',
    tipo: 'GASTO',
    monto: 450,
    fecha: '2026-09-02',
    descripcion: null,
    creado_en: INSTANTE,
    actualizado_en: INSTANTE,
    eliminado_en: null,
    ...parcial,
  }
}
