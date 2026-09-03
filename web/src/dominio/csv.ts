/**
 * Importador de CSV.
 *
 * Va temprano en el proyecto a propósito: sin historial, los resúmenes
 * no dicen nada el primer mes, y una app de finanzas que empieza vacía
 * tarda medio año en volverse útil.
 *
 * Dos decisiones que marcan el diseño:
 *
 * 1. **Vista previa en seco antes de escribir nada.** Se cuentan las
 *    filas que entran, las que se rechazan y por qué, y las que parecen
 *    repetidas. Importar mal 800 movimientos y descubrirlo después es
 *    mucho peor que no importar.
 * 2. **Los duplicados se marcan, no se eliminan solos.** Deduplicar
 *    automáticamente exigiría una huella del origen que el esquema no
 *    tiene, y confundir dos almuerzos idénticos del mismo día con un
 *    duplicado real sería borrar un gasto de verdad.
 */

import { parseMonto } from './dinero.ts'
import { esFechaValida } from './fechas.ts'
import type {
  Categoria,
  Centavos,
  Cuenta,
  FechaContable,
  TipoTransaccion,
  Transaccion,
  UUID,
} from './tipos.ts'

/* =====================================================================
   Lectura del archivo
   ===================================================================== */

/**
 * Parte un CSV en celdas, respetando comillas y saltos de línea dentro
 * de un campo entrecomillado (RFC 4180). No se usa una librería porque
 * el formato cabe en cuarenta líneas y una dependencia más en una app
 * offline es peso muerto.
 */
export function parsearCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '') // BOM de Excel
  const separador = detectarSeparador(limpio)

  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]

    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"'
          i++
        } else {
          entreComillas = false
        }
      } else {
        celda += c
      }
      continue
    }

    if (c === '"') {
      entreComillas = true
    } else if (c === separador) {
      fila.push(celda)
      celda = ''
    } else if (c === '\n') {
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ''
    } else if (c === '\r') {
      /* se ignora: el salto lo marca el \n */
    } else {
      celda += c
    }
  }

  if (celda !== '' || fila.length > 0) {
    fila.push(celda)
    filas.push(fila)
  }

  return filas.filter((f) => f.some((x) => x.trim() !== ''))
}

function detectarSeparador(texto: string): string {
  const primera = texto.slice(0, texto.indexOf('\n') + 1 || texto.length)
  const candidatos = [',', ';', '\t', '|']
  let mejor = ','
  let mas = 0
  for (const c of candidatos) {
    const n = primera.split(c).length - 1
    if (n > mas) {
      mas = n
      mejor = c
    }
  }
  return mejor
}

/* =====================================================================
   Mapeo de columnas
   ===================================================================== */

export type CampoDestino =
  | 'fecha'
  | 'monto'
  | 'descripcion'
  | 'categoria'
  | 'cuenta'
  | 'tipo'
  | 'ignorar'

export type Mapeo = Record<number, CampoDestino>

const PISTAS: Record<Exclude<CampoDestino, 'ignorar'>, string[]> = {
  fecha: ['fecha', 'date', 'dia', 'día', 'fecha contable', 'fecha operacion'],
  monto: ['monto', 'valor', 'importe', 'amount', 'cantidad', 'debito', 'credito'],
  descripcion: ['descripcion', 'descripción', 'detalle', 'concepto', 'nota', 'memo'],
  categoria: ['categoria', 'categoría', 'category', 'rubro'],
  cuenta: ['cuenta', 'account', 'banco', 'medio'],
  tipo: ['tipo', 'type', 'movimiento'],
}

/** Adivina el mapeo mirando la fila de cabeceras. */
export function sugerirMapeo(cabeceras: readonly string[]): Mapeo {
  const mapeo: Mapeo = {}
  const usados = new Set<CampoDestino>()

  cabeceras.forEach((cabecera, i) => {
    const limpia = cabecera.trim().toLocaleLowerCase('es')
    mapeo[i] = 'ignorar'

    for (const [campo, pistas] of Object.entries(PISTAS)) {
      if (usados.has(campo as CampoDestino)) continue
      if (pistas.some((p) => limpia === p || limpia.includes(p))) {
        mapeo[i] = campo as CampoDestino
        usados.add(campo as CampoDestino)
        break
      }
    }
  })

  return mapeo
}

/* =====================================================================
   Conversión de filas
   ===================================================================== */

export interface FilaImportada {
  /** Índice en el archivo, para poder señalar la fila al usuario. */
  linea: number
  fecha: FechaContable
  monto: Centavos
  tipo: TipoTransaccion
  id_cuenta: UUID
  id_categoria: UUID | null
  descripcion: string | null
  /** Coincide con un movimiento que ya existe. Se marca, no se descarta. */
  probableDuplicado: boolean
}

export interface FilaRechazada {
  linea: number
  motivo: string
  contenido: string
}

export interface ResultadoLectura {
  validas: FilaImportada[]
  rechazadas: FilaRechazada[]
}

export interface OpcionesLectura {
  mapeo: Mapeo
  /** Si la primera fila del archivo son cabeceras. */
  conCabecera: boolean
  cuentas: readonly Cuenta[]
  categorias: readonly Categoria[]
  /** Cuenta para las filas sin columna de cuenta o con una desconocida. */
  cuentaPorDefecto: UUID
  /** Manda las categorías desconocidas a "Otros" en vez de rechazarlas. */
  categoriaDeReserva?: UUID | null
  /** Movimientos que ya existen, para detectar repetidos. */
  existentes: readonly Transaccion[]
}

export function leerFilas(
  filas: readonly string[][],
  op: OpcionesLectura,
): ResultadoLectura {
  const validas: FilaImportada[] = []
  const rechazadas: FilaRechazada[] = []

  const porNombre = <T extends { nombre: string }>(xs: readonly T[]) =>
    new Map(xs.map((x) => [x.nombre.trim().toLocaleLowerCase('es'), x]))

  const cuentasPorNombre = porNombre(op.cuentas)
  const categoriasGasto = porNombre(op.categorias.filter((c) => c.tipo === 'GASTO'))
  const categoriasIngreso = porNombre(op.categorias.filter((c) => c.tipo === 'INGRESO'))

  const huellasExistentes = new Set(
    op.existentes
      .filter((t) => t.eliminado_en === null)
      .map((t) => huella(t.fecha, t.monto, t.tipo, t.descripcion)),
  )
  const huellasDelArchivo = new Set<string>()

  const inicio = op.conCabecera ? 1 : 0

  for (let i = inicio; i < filas.length; i++) {
    const fila = filas[i] as string[]
    const linea = i + 1
    const contenido = fila.join(' | ').slice(0, 120)
    const valor = (campo: CampoDestino): string => {
      for (const [indice, destino] of Object.entries(op.mapeo)) {
        if (destino === campo) return (fila[Number(indice)] ?? '').trim()
      }
      return ''
    }

    const fecha = normalizarFecha(valor('fecha'))
    if (!fecha) {
      rechazadas.push({ linea, contenido, motivo: 'La fecha no se entiende.' })
      continue
    }

    const centavos = parseMonto(valor('monto'))
    if (centavos === null || centavos === 0) {
      rechazadas.push({ linea, contenido, motivo: 'El monto no es válido.' })
      continue
    }

    // Sin columna de tipo, el signo del monto decide: es la convención
    // de todos los extractos bancarios.
    const tipoTexto = valor('tipo').toLocaleLowerCase('es')
    let tipo: TipoTransaccion
    if (tipoTexto.startsWith('ingres') || tipoTexto.startsWith('credit')) {
      tipo = 'INGRESO'
    } else if (tipoTexto.startsWith('gast') || tipoTexto.startsWith('debit')) {
      tipo = 'GASTO'
    } else {
      tipo = centavos < 0 ? 'GASTO' : 'INGRESO'
    }

    const nombreCuenta = valor('cuenta').toLocaleLowerCase('es')
    const cuenta = cuentasPorNombre.get(nombreCuenta)
    const idCuenta = cuenta?.id ?? op.cuentaPorDefecto

    const nombreCategoria = valor('categoria').toLocaleLowerCase('es')
    const catalogo = tipo === 'GASTO' ? categoriasGasto : categoriasIngreso
    const categoria = catalogo.get(nombreCategoria)

    let idCategoria: UUID | null = categoria?.id ?? null
    if (!idCategoria) {
      if (op.categoriaDeReserva) {
        idCategoria = op.categoriaDeReserva
      } else {
        rechazadas.push({
          linea,
          contenido,
          motivo: nombreCategoria
            ? `No tienes la categoría "${valor('categoria').trim()}" para ${
                tipo === 'GASTO' ? 'gastos' : 'ingresos'
              }.`
            : 'Falta la categoría.',
        })
        continue
      }
    }

    const descripcion = valor('descripcion').trim() || null
    const monto = Math.abs(centavos)
    const clave = huella(fecha, monto, tipo, descripcion)

    validas.push({
      linea,
      fecha,
      monto,
      tipo,
      id_cuenta: idCuenta,
      id_categoria: idCategoria,
      descripcion,
      probableDuplicado:
        huellasExistentes.has(clave) || huellasDelArchivo.has(clave),
    })
    huellasDelArchivo.add(clave)
  }

  return { validas, rechazadas }
}

function huella(
  fecha: string,
  monto: number,
  tipo: string,
  descripcion: string | null,
): string {
  return `${fecha}|${monto}|${tipo}|${(descripcion ?? '').trim().toLocaleLowerCase('es')}`
}

/**
 * Fechas de archivos reales: ISO, y día/mes/año que es lo que usa
 * Ecuador. El formato mes/día/año **no** se intenta adivinar: 03/04 sería
 * ambiguo y meter movimientos en el mes equivocado sin avisar es peor
 * que rechazar la fila.
 */
export function normalizarFecha(texto: string): FechaContable | null {
  const t = texto.trim()
  if (t === '') return null

  if (esFechaValida(t)) return t

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(t)
  if (iso) return armar(iso[1] as string, iso[2] as string, iso[3] as string)

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(t)
  if (dmy) {
    const anio = (dmy[3] as string).length === 2 ? `20${dmy[3]}` : (dmy[3] as string)
    return armar(anio, dmy[2] as string, dmy[1] as string)
  }

  return null
}

function armar(anio: string, mes: string, dia: string): FechaContable | null {
  const f = `${anio.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  return esFechaValida(f) ? f : null
}
