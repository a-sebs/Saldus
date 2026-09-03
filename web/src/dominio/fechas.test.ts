import { describe, expect, it } from 'vitest'
import {
  ayer,
  diasDelMes,
  diasEntre,
  esFechaValida,
  fechaCorta,
  fechaRelativa,
  hoy,
  mismoMes,
  nombreMes,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
  ultimoDiaDelMes,
} from './fechas.ts'

/** 2026-09-02 a las 19:30 UTC = 14:30 en Ecuador. */
const TARDE_EN_EC = Date.UTC(2026, 8, 2, 19, 30)
/** 2026-09-03 a las 02:00 UTC = 21:00 del día 2 en Ecuador. */
const NOCHE_EN_EC = Date.UTC(2026, 8, 3, 2, 0)

describe('hoy', () => {
  it('devuelve el día contable de Ecuador, no el del reloj UTC', () => {
    expect(hoy(TARDE_EN_EC)).toBe('2026-09-02')
    // Este es el caso que rompe las apps que usan la fecha UTC directa:
    // a las 21:00 en Ecuador ya es el día siguiente en UTC, pero el
    // almuerzo sigue siendo del día 2.
    expect(hoy(NOCHE_EN_EC)).toBe('2026-09-02')
  })

  it('ayer es el día anterior al día contable', () => {
    expect(ayer(NOCHE_EN_EC)).toBe('2026-09-01')
  })
})

describe('esFechaValida', () => {
  it('acepta fechas reales en formato YYYY-MM-DD', () => {
    expect(esFechaValida('2026-09-02')).toBe(true)
    expect(esFechaValida('2024-02-29')).toBe(true) // bisiesto
  })

  it('rechaza formatos y días que no existen', () => {
    expect(esFechaValida('2026-02-30')).toBe(false)
    expect(esFechaValida('2025-02-29')).toBe(false) // no bisiesto
    expect(esFechaValida('2026-13-01')).toBe(false)
    expect(esFechaValida('2026-9-2')).toBe(false)
    expect(esFechaValida('02/09/2026')).toBe(false)
    expect(esFechaValida('')).toBe(false)
    expect(esFechaValida(null)).toBe(false)
    expect(esFechaValida(new Date())).toBe(false)
  })
})

describe('aritmética de días', () => {
  it('cruza fin de mes y fin de año sin desviarse', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29')
    expect(sumarDias('2026-09-02', 0)).toBe('2026-09-02')
  })

  it('cuenta días completos entre dos fechas', () => {
    expect(diasEntre('2026-09-01', '2026-09-02')).toBe(1)
    expect(diasEntre('2026-09-02', '2026-09-01')).toBe(-1)
    expect(diasEntre('2026-09-02', '2026-09-02')).toBe(0)
    expect(diasEntre('2026-01-01', '2027-01-01')).toBe(365)
  })
})

describe('meses', () => {
  it('identifica el mes por su primer día, como date_trunc', () => {
    expect(primerDiaDelMes('2026-09-17')).toBe('2026-09-01')
    expect(ultimoDiaDelMes('2026-09-17')).toBe('2026-09-30')
    expect(ultimoDiaDelMes('2024-02-05')).toBe('2024-02-29')
    expect(diasDelMes('2026-09-17')).toBe(30)
  })

  it('suma y resta meses sin desbordar al siguiente', () => {
    expect(sumarMeses('2026-09-17', 1)).toBe('2026-10-01')
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-01')
    expect(sumarMeses('2026-12-01', 1)).toBe('2027-01-01')
  })

  it('compara meses', () => {
    expect(mismoMes('2026-09-01', '2026-09-30')).toBe(true)
    expect(mismoMes('2026-09-30', '2026-10-01')).toBe(false)
  })
})

describe('presentación', () => {
  it('formatea en español sin arrastrar la zona horaria del equipo', () => {
    // Si se construyera el Date sin UTC, en Ecuador saldría el día 1.
    expect(fechaCorta('2026-09-02')).toContain('2')
    expect(nombreMes('2026-09-02')).toContain('septiembre')
    expect(nombreMes('2026-09-02')).toContain('2026')
  })

  it('usa lenguaje llano para hoy y ayer', () => {
    expect(fechaRelativa('2026-09-02', TARDE_EN_EC)).toBe('Hoy')
    expect(fechaRelativa('2026-09-01', TARDE_EN_EC)).toBe('Ayer')
    expect(fechaRelativa('2026-08-30', TARDE_EN_EC)).not.toBe('Hoy')
  })
})
