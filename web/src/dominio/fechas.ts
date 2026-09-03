/**
 * Fechas — Ecuador, UTC-5 fijo, sin horario de verano.
 *
 * Dos conceptos que la app no debe confundir nunca:
 *
 * - `fecha` (FechaContable, `'YYYY-MM-DD'`) es el **día contable**: el
 *   día al que pertenece el movimiento. Registrar el almuerzo de ayer es
 *   el caso normal, no la excepción.
 * - `creado_en` / `actualizado_en` (Instante ISO) es **cuándo se
 *   registró**. Sirve para sincronizar, no para contabilizar.
 *
 * Todo el módulo trabaja sobre strings y `Date.UTC`. Nunca se construye
 * un `Date` a partir de `'2026-09-02'` sin más, porque el navegador lo
 * interpreta como medianoche UTC y en Ecuador eso es el día anterior a
 * las 19:00.
 */

import type { FechaContable, Instante } from './tipos.ts'

/** Ecuador continental: UTC-5 todo el año. */
export const DESFASE_EC_MINUTOS = -300

const MS_POR_DIA = 86_400_000

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/

/** ¿Es un `'YYYY-MM-DD'` que además existe en el calendario? */
export function esFechaValida(valor: unknown): valor is FechaContable {
  if (typeof valor !== 'string') return false
  const m = FORMATO.exec(valor)
  if (!m) return false
  const anio = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false
  // Rebote: el 31 de febrero se convertiría en el 2 o 3 de marzo.
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  )
}

/**
 * El día contable de hoy en Ecuador.
 *
 * Se resta el desfase al instante actual y se leen las partes UTC. Así
 * el día es el de Ecuador aunque el dispositivo esté configurado en otra
 * zona horaria, que es justo lo que pasa cuando uno viaja y sigue
 * anotando gastos.
 */
export function hoy(ahoraMs: number = Date.now()): FechaContable {
  const desplazado = new Date(ahoraMs + DESFASE_EC_MINUTOS * 60_000)
  return aFechaUTC(desplazado)
}

export function ayer(ahoraMs: number = Date.now()): FechaContable {
  return sumarDias(hoy(ahoraMs), -1)
}

/** Instante actual en ISO, para `creado_en` y `actualizado_en`. */
export function ahora(): Instante {
  return new Date().toISOString()
}

function aFechaUTC(d: Date): FechaContable {
  const a = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${a}-${m}-${dd}`
}

function aDate(fecha: FechaContable): Date {
  const m = FORMATO.exec(fecha)
  if (!m) throw new Error(`Fecha contable inválida: ${fecha}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function sumarDias(fecha: FechaContable, dias: number): FechaContable {
  return aFechaUTC(new Date(aDate(fecha).getTime() + dias * MS_POR_DIA))
}

/** Días completos de `desde` a `hasta`. Negativo si `hasta` es anterior. */
export function diasEntre(
  desde: FechaContable,
  hasta: FechaContable,
): number {
  return Math.round((aDate(hasta).getTime() - aDate(desde).getTime()) / MS_POR_DIA)
}

/* ---------------------------------------------------------------------
   Meses. Un mes se identifica por su primer día (`'2026-09-01'`), igual
   que hace `date_trunc('month', fecha)::date` en la vista SQL.
   --------------------------------------------------------------------- */

export function primerDiaDelMes(fecha: FechaContable): FechaContable {
  return `${fecha.slice(0, 7)}-01`
}

export function ultimoDiaDelMes(fecha: FechaContable): FechaContable {
  const d = aDate(primerDiaDelMes(fecha))
  return aFechaUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

export function sumarMeses(fecha: FechaContable, meses: number): FechaContable {
  const d = aDate(primerDiaDelMes(fecha))
  return aFechaUTC(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1)),
  )
}

export function mismoMes(a: FechaContable, b: FechaContable): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** Número de días del mes al que pertenece la fecha. */
export function diasDelMes(fecha: FechaContable): number {
  return Number(ultimoDiaDelMes(fecha).slice(8, 10))
}

/* ---------------------------------------------------------------------
   Presentación. Siempre en es-EC y forzando UTC en el formateador, para
   que no se cuele la zona horaria del dispositivo.
   --------------------------------------------------------------------- */

const LOCAL = 'es-EC'

function formatear(fecha: FechaContable, opciones: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCAL, { ...opciones, timeZone: 'UTC' }).format(
    aDate(fecha),
  )
}

/** `'2026-09-02'` → `"mar 2 sep"`. Cabecera de grupo de la lista. */
export function fechaCorta(fecha: FechaContable): string {
  return formatear(fecha, { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
}

/** `'2026-09-02'` → `"martes, 2 de septiembre"`. */
export function fechaLarga(fecha: FechaContable): string {
  return formatear(fecha, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** `'2026-09-02'` → `"septiembre 2026"`. Selector de mes. */
export function nombreMes(fecha: FechaContable): string {
  return formatear(fecha, { month: 'long', year: 'numeric' })
}

/** `'2026-09-02'` → `"septiembre"`. Cuando el año ya está en contexto. */
export function nombreMesCorto(fecha: FechaContable): string {
  return formatear(fecha, { month: 'long' })
}

/**
 * Cabecera de día con lenguaje llano cuando toca. "Hoy" y "Ayer" hacen
 * más por la lectura de una lista que la fecha exacta, que igual está
 * implícita en el orden.
 */
export function fechaRelativa(
  fecha: FechaContable,
  ahoraMs: number = Date.now(),
): string {
  const h = hoy(ahoraMs)
  if (fecha === h) return 'Hoy'
  if (fecha === sumarDias(h, -1)) return 'Ayer'
  return fechaCorta(fecha)
}
