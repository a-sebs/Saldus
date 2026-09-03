import { describe, expect, it } from 'vitest'
import {
  LIMITE_CENTAVOS,
  centavosADecimalSQL,
  formatMonto,
  formatMontoAgrupado,
  parseMonto,
  partirParaColumna,
  sumar,
} from './dinero.ts'

describe('parseMonto', () => {
  it('lee las formas que una persona teclea de verdad', () => {
    expect(parseMonto('12.50')).toBe(1250)
    expect(parseMonto('12,50')).toBe(1250)
    expect(parseMonto('12')).toBe(1200)
    expect(parseMonto('12.5')).toBe(1250)
    expect(parseMonto('0.35')).toBe(35)
    expect(parseMonto('.50')).toBe(50)
    expect(parseMonto('0')).toBe(0)
  })

  it('tolera lo que se pega desde un extracto bancario', () => {
    expect(parseMonto('$12.50')).toBe(1250)
    expect(parseMonto(' 12.50 ')).toBe(1250)
    expect(parseMonto('USD 12.50')).toBe(1250)
    expect(parseMonto('12.50 USD')).toBe(1250)
    expect(parseMonto('1,234.56')).toBe(123456)
    expect(parseMonto('1.234,56')).toBe(123456)
    expect(parseMonto('1,234,567.89')).toBe(123456789)
  })

  it('devuelve el signo para que el importador deduzca el tipo', () => {
    expect(parseMonto('-4.50')).toBe(-450)
    expect(parseMonto('−4.50')).toBe(-450) // signo menos U+2212
    expect(parseMonto('(4.50)')).toBe(-450) // negativo de extracto
    expect(parseMonto('+4.50')).toBe(450)
  })

  it('resuelve el separador ambiguo con el locale de Ecuador', () => {
    // es-EC escribe 1,234.56: la coma agrupa y el punto decimaliza.
    expect(parseMonto('1,500')).toBe(150000) // mil quinientos
    expect(parseMonto('1.500')).toBe(150) // uno con cincuenta
    expect(parseMonto('1.234.567')).toBe(123456700) // repetido: son miles
    expect(parseMonto('12.3456')).toBe(1235) // más de dos: redondea
  })

  it('redondea a dos decimales, medio hacia arriba', () => {
    expect(parseMonto('0.005')).toBe(1)
    expect(parseMonto('0.004')).toBe(0)
    expect(parseMonto('1.995')).toBe(200)
  })

  it('rechaza lo que no es un monto', () => {
    expect(parseMonto('')).toBeNull()
    expect(parseMonto('   ')).toBeNull()
    expect(parseMonto('abc')).toBeNull()
    expect(parseMonto('12.')).toBeNull()
    expect(parseMonto(',')).toBeNull()
    expect(parseMonto('1.23.456')).toBeNull() // agrupación mal formada
    expect(parseMonto('12,34,56')).toBeNull()
    expect(parseMonto('99999999999999')).toBeNull() // pasa NUMERIC(12,2)
  })

  it('acepta justo el límite de NUMERIC(12,2)', () => {
    expect(parseMonto('9999999999.99')).toBe(LIMITE_CENTAVOS)
    expect(parseMonto('10000000000.00')).toBeNull()
  })

  it('no pierde precisión donde la coma flotante la perdería', () => {
    // El caso que hace que las apps de finanzas muestren 0.30000000000004
    expect((parseMonto('0.10') as number) + (parseMonto('0.20') as number)).toBe(
      parseMonto('0.30'),
    )
    // 0.1 + 0.2 en coma flotante no es 0.3; en centavos sí es exacto.
    expect(0.1 + 0.2).not.toBe(0.3)
  })
})

describe('formatMonto', () => {
  it('reconstruye el decimal partiendo el entero, sin dividir', () => {
    expect(formatMonto(1250)).toBe('12.50')
    expect(formatMonto(5)).toBe('0.05')
    expect(formatMonto(50)).toBe('0.50')
    expect(formatMonto(0)).toBe('0.00')
    expect(formatMonto(-450)).toBe('-4.50')
    expect(formatMonto(100000)).toBe('1000.00')
  })

  it('sobrevive al monto de seis cifras que rompe maquetaciones', () => {
    expect(formatMontoAgrupado(12345678)).toBe('123,456.78')
    expect(formatMontoAgrupado(123456789)).toBe('1,234,567.89')
    expect(formatMontoAgrupado(-123456789)).toBe('-1,234,567.89')
    expect(formatMontoAgrupado(99)).toBe('0.99')
  })

  it('va y vuelve sin perder nada', () => {
    for (const c of [0, 1, 99, 100, 1250, 123456789, LIMITE_CENTAVOS]) {
      expect(parseMonto(formatMonto(c))).toBe(c)
      expect(parseMonto(formatMontoAgrupado(c))).toBe(c)
    }
  })
})

describe('partirParaColumna', () => {
  it('separa el signo para que la columna alinee', () => {
    // El gasto lleva el menos matemático U+2212, no el guion.
    expect(partirParaColumna(-450)).toEqual({ signo: '−', cifra: '4.50' })
    // La transferencia no lleva signo, y aun así ocupa la misma celda.
    expect(partirParaColumna(450, 'nunca')).toEqual({ signo: '', cifra: '4.50' })
    expect(partirParaColumna(450, 'siempre')).toEqual({ signo: '+', cifra: '4.50' })
    expect(partirParaColumna(0, 'siempre')).toEqual({ signo: '', cifra: '0.00' })
  })
})

describe('centavosADecimalSQL', () => {
  it('produce lo que espera NUMERIC(12,2)', () => {
    expect(centavosADecimalSQL(1250)).toBe('12.50')
    expect(centavosADecimalSQL(5)).toBe('0.05')
    expect(centavosADecimalSQL(0)).toBe('0.00')
  })
})

describe('sumar', () => {
  it('suma exacto sobre enteros', () => {
    expect(sumar([10, 20, 30])).toBe(60)
    expect(sumar([])).toBe(0)
  })
})
