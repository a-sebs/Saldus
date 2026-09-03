/**
 * Dinero — enteros de centavos, siempre.
 *
 * En JavaScript `0.1 + 0.2 === 0.30000000000000004`. Una app de finanzas
 * que sume decimales acaba mostrando `$0.30000000000000004` o, peor,
 * cuadrando mal un saldo por un centavo que nadie encuentra. Aquí el
 * dinero es un entero y solo se convierte a texto para mostrarlo.
 *
 * Nada de este módulo usa `parseFloat`, `toFixed` ni división por 100.
 * Todo es aritmética entera y manipulación de strings.
 */

import type { Centavos } from './tipos.ts'

/**
 * Tope de NUMERIC(12,2): 10 dígitos enteros y 2 decimales.
 * 9,999,999,999.99 → 999999999999 centavos, muy por debajo de
 * Number.MAX_SAFE_INTEGER (9.007e15), así que la aritmética es exacta.
 */
export const LIMITE_CENTAVOS = 999_999_999_999

/** Separador decimal y de miles de es-EC: `1,234.56`. */
const SEPARADOR_MILES = ','
const SEPARADOR_DECIMAL = '.'

/**
 * Convierte texto escrito por una persona a centavos.
 *
 * Acepta `"12.50"`, `"12,50"`, `"12"`, `"$12.50"`, `"1,234.56"`,
 * `"1.234,56"` y `"-4.50"`. Devuelve `null` si no es un monto válido:
 * quien llama decide si eso es un error de formulario o una fila
 * rechazada del CSV.
 *
 * Devuelve el valor **con signo**. Que un monto tenga que ser positivo
 * es una regla de dominio y se comprueba en `reglas.ts`; el importador
 * de CSV necesita leer el `-` para deducir que la fila es un gasto.
 *
 * `1.500` es ambiguo en abstracto: mil quinientos o uno con medio. Se
 * resuelve con el locale de la app, es-EC, donde el decimal es el punto
 * y el separador de miles es la coma (`1,234.56`):
 *
 * - Si aparecen los dos separadores, el **último** es el decimal y el
 *   otro es de miles (`1.234,56` y `1,234.56` dan lo mismo). Así se leen
 *   también los extractos con formato europeo.
 * - Si aparece uno solo, repetido, es de miles (`1.234.567`).
 * - Si aparece una sola vez: es de miles solo cuando es **coma seguida
 *   de exactamente tres dígitos** (`1,500` → 1500). En cualquier otro
 *   caso es decimal, así que `1.500` es uno con cincuenta.
 * - Con más de dos decimales se redondea a dos, medio hacia arriba.
 */
export function parseMonto(texto: string): Centavos | null {
  if (typeof texto !== 'string') return null

  // Fuera espacios (incluido el no separable que meten los extractos),
  // símbolo de moneda y código de divisa.
  let t = texto.replace(/[\s ]/g, '')
  t = t.replace(/^(usd|us\$|\$)/i, '')
  t = t.replace(/(usd)$/i, '')
  if (t === '') return null

  let negativo = false
  if (t.startsWith('-') || t.startsWith('−')) {
    negativo = true
    t = t.slice(1)
  } else if (t.startsWith('+')) {
    t = t.slice(1)
  }
  // Los extractos marcan el negativo entre paréntesis: (4.50)
  if (t.startsWith('(') && t.endsWith(')')) {
    negativo = true
    t = t.slice(1, -1)
  }
  if (t === '') return null

  if (!/^[0-9.,]+$/.test(t)) return null

  const posiciones: number[] = []
  const distintos = new Set<string>()
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '.' || c === ',') {
      posiciones.push(i)
      distintos.add(c)
    }
  }

  let parteEntera: string
  let parteDecimal: string

  if (posiciones.length === 0) {
    parteEntera = t
    parteDecimal = ''
  } else {
    const ultima = posiciones[posiciones.length - 1] as number
    const cola = t.slice(ultima + 1)
    if (cola.length === 0) return null // "12." no es un monto

    const colaEsDecimal =
      distintos.size === 2 // hay decimal y hay miles: el último manda
        ? true
        : posiciones.length > 1 // un solo carácter repetido: son miles
          ? false
          : !(t[ultima] === ',' && cola.length === 3) // coma + 3 = miles

    const corte = colaEsDecimal ? ultima : t.length

    // Los separadores que quedan a la izquierda del corte tienen que ser
    // agrupaciones de miles bien formadas, o el texto está mal escrito.
    const izquierda = t.slice(0, corte)
    const grupos = izquierda.split(/[.,]/)
    if (grupos.length > 1) {
      if (grupos[0] === '' || (grupos[0] as string).length > 3) return null
      for (let i = 1; i < grupos.length; i++) {
        if (!/^[0-9]{3}$/.test(grupos[i] as string)) return null
      }
    }

    parteEntera = grupos.join('')
    parteDecimal = colaEsDecimal ? cola : ''
  }

  if (!/^[0-9]*$/.test(parteEntera)) return null
  if (!/^[0-9]*$/.test(parteDecimal)) return null
  if (parteEntera === '' && parteDecimal === '') return null

  const entero = parteEntera === '' ? 0 : Number(parteEntera)
  if (!Number.isSafeInteger(entero)) return null

  // Redondeo a 2 decimales, medio hacia arriba, sin coma flotante.
  let centavos: number
  if (parteDecimal.length <= 2) {
    centavos = entero * 100 + Number(parteDecimal.padEnd(2, '0') || '0')
  } else {
    const dos = Number(parteDecimal.slice(0, 2))
    const siguiente = Number(parteDecimal[2])
    centavos = entero * 100 + dos + (siguiente >= 5 ? 1 : 0)
  }

  if (!Number.isSafeInteger(centavos)) return null
  if (centavos > LIMITE_CENTAVOS) return null

  return negativo ? -centavos : centavos
}

/**
 * Centavos a texto plano con dos decimales: `1250` → `"12.50"`.
 *
 * Se construye partiendo el string del entero, **no** dividiendo entre
 * 100: `1250 / 100` es un `number` decimal y ahí empieza el problema.
 */
export function formatMonto(centavos: Centavos): string {
  const n = Math.trunc(centavos)
  const negativo = n < 0
  const digitos = String(Math.abs(n)).padStart(3, '0')
  const entera = digitos.slice(0, -2)
  const decimal = digitos.slice(-2)
  return `${negativo ? '-' : ''}${entera}${SEPARADOR_DECIMAL}${decimal}`
}

/** Agrupa los miles para mostrar: `123456789` → `"1,234,567.89"`. */
export function formatMontoAgrupado(centavos: Centavos): string {
  const plano = formatMonto(centavos)
  const negativo = plano.startsWith('-')
  const cuerpo = negativo ? plano.slice(1) : plano
  const [entera = '0', decimal = '00'] = cuerpo.split(SEPARADOR_DECIMAL)

  let agrupada = ''
  for (let i = 0; i < entera.length; i++) {
    if (i > 0 && (entera.length - i) % 3 === 0) agrupada += SEPARADOR_MILES
    agrupada += entera[i] ?? ''
  }

  return `${negativo ? '-' : ''}${agrupada}${SEPARADOR_DECIMAL}${decimal}`
}

/**
 * Parte el monto en signo y cifra para pintarlo en la columna de dinero.
 *
 * El signo va en su propia celda de ancho fijo, de modo que una
 * transferencia (sin signo) alinee perfecto con un gasto (con signo).
 * Sin esto la columna se descuadra un carácter y toda la lista se ve mal.
 *
 * `menos` es U+2212 (signo menos matemático), no el guion del teclado:
 * el guion es más corto y estrecho, y rompe la alineación óptica.
 */
export function partirParaColumna(
  centavos: Centavos,
  signo: 'auto' | 'siempre' | 'nunca' = 'auto',
): { signo: string; cifra: string } {
  const abs = Math.abs(centavos)
  const cifra = formatMontoAgrupado(abs)

  if (signo === 'nunca') return { signo: '', cifra }
  if (centavos < 0) return { signo: '−', cifra }
  if (signo === 'siempre' && centavos > 0) return { signo: '+', cifra }
  return { signo: '', cifra }
}

/**
 * Centavos al decimal que espera NUMERIC(12,2) en el JSON de sync.
 * Es el mismo texto de `formatMonto`, con nombre propio para que en la
 * Fase 2 se vea de dónde sale cada valor que va al servidor.
 */
export function centavosADecimalSQL(centavos: Centavos): string {
  return formatMonto(centavos)
}

/** El camino de vuelta: lo que llega del servidor como `"12.50"`. */
export function decimalSQLACentavos(decimal: string): Centavos | null {
  return parseMonto(decimal)
}

/** Suma de una lista de montos. Trivial, pero evita repetir el reduce. */
export function sumar(montos: readonly Centavos[]): Centavos {
  let total = 0
  for (const m of montos) total += m
  return total
}
