/**
 * Exportador de CSV.
 *
 * Existe por un hueco concreto de la Fase 1: los datos viven solo en el
 * navegador del dispositivo y no hay copia en ninguna parte. Los
 * respaldos que pide CLAUDE.md §13 son de la Fase 2 y dependen de Neon,
 * así que hasta entonces este archivo es la única red de seguridad.
 *
 * El formato se elige para que el importador de `csv.ts` vuelva a leer
 * el archivo sin configurar nada: los nombres de columna están entre las
 * pistas de `sugerirMapeo`, el monto sale como decimal plano que
 * `parseMonto` entiende, y la fecha ya es ISO.
 *
 * Limitación conocida: las transferencias se exportan completas, pero el
 * importador no sabe reconstruirlas —no tiene forma de expresar la
 * cuenta de destino— y las rechazará al releerlas. Se exportan igual:
 * un respaldo que omite movimientos no es un respaldo.
 */

import { centavosADecimalSQL } from './dinero.ts'
import type {
  Categoria,
  Cuenta,
  Etiqueta,
  FechaContable,
  Transaccion,
  TransaccionEtiqueta,
} from './tipos.ts'

/**
 * Orden y nombres pensados para que `sugerirMapeo` los reconozca solo.
 * `cuenta` va antes que `cuenta_destino` a propósito: el mapeo reclama
 * la primera coincidencia, así que la columna de origen se queda con el
 * campo y la de destino cae en "ignorar", que es lo correcto.
 */
export const CABECERAS = [
  'fecha',
  'tipo',
  'monto',
  'categoria',
  'cuenta',
  'cuenta_destino',
  'descripcion',
  'etiquetas',
] as const

export interface OpcionesExportacion {
  transacciones: readonly Transaccion[]
  cuentas: readonly Cuenta[]
  categorias: readonly Categoria[]
  etiquetas: readonly Etiqueta[]
  enlacesEtiqueta: readonly TransaccionEtiqueta[]
}

/** Nombre con la fecha dentro, para que dos respaldos no se pisen. */
export function nombreArchivo(hoy: FechaContable): string {
  return `saldus-${hoy}.csv`
}

export function aCSV(op: OpcionesExportacion): string {
  const nombreCuenta = new Map(op.cuentas.map((c) => [c.id, c.nombre]))
  const nombreCategoria = new Map(op.categorias.map((c) => [c.id, c.nombre]))
  const nombreEtiqueta = new Map(op.etiquetas.map((e) => [e.id, e.nombre]))

  const etiquetasDe = new Map<string, string[]>()
  for (const enlace of op.enlacesEtiqueta) {
    const nombre = nombreEtiqueta.get(enlace.id_etiqueta)
    if (nombre === undefined) continue
    const lista = etiquetasDe.get(enlace.id_transaccion)
    if (lista) lista.push(nombre)
    else etiquetasDe.set(enlace.id_transaccion, [nombre])
  }

  const filas = op.transacciones
    .filter((t) => t.eliminado_en === null)
    .slice()
    // Orden estable: dos exportaciones de los mismos datos dan archivos
    // idénticos, así que un diff entre respaldos se puede leer.
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.creado_en.localeCompare(b.creado_en) ||
        a.id.localeCompare(b.id),
    )
    .map((t) => [
      fechaCSV(t.fecha),
      t.tipo,
      centavosADecimalSQL(t.monto),
      t.id_categoria ? (nombreCategoria.get(t.id_categoria) ?? '') : '',
      nombreCuenta.get(t.id_cuenta) ?? '',
      t.id_cuenta_destino ? (nombreCuenta.get(t.id_cuenta_destino) ?? '') : '',
      t.descripcion ?? '',
      (etiquetasDe.get(t.id) ?? []).slice().sort().join('; '),
    ])

  const lineas = [CABECERAS as readonly string[], ...filas].map((fila) =>
    fila.map(celda).join(','),
  )

  // BOM: sin él Excel abre el archivo en la codificación del sistema y
  // convierte las tildes en basura. `parsearCSV` lo descarta al releer.
  // CRLF es lo que dicta RFC 4180; el lector ignora el \r.
  return '\uFEFF' + lineas.join('\r\n') + '\r\n'
}

/**
 * Fecha en dd/mm/aaaa.
 *
 * El archivo llevaba ISO, que es inequívoco, pero Excel lo reinterpreta
 * según el idioma del sistema y acaba enseñando mes/día/año, que aquí no
 * se lee así. Se escribe ya en el orden en que se espera leerlo.
 *
 * No rompe la vuelta: `normalizarFecha` prueba dd/mm/aaaa y **se niega a
 * adivinar mm/dd/aaaa** a propósito, porque 03/04 sería ambiguo y meter
 * un movimiento en el mes equivocado sin avisar es peor que rechazar la
 * fila. El orden de las filas se sigue calculando sobre la fecha ISO,
 * antes de formatear.
 */
function fechaCSV(fecha: FechaContable): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

/**
 * Entrecomilla ante cualquier carácter que pudiera partir el campo.
 * Se incluyen `;`, tabulador y `|` porque son candidatos a separador en
 * `detectarSeparador`, y los espacios en los bordes porque sin comillas
 * se perderían al releer.
 */
function celda(valor: string): string {
  if (/[",;\t\n\r|]/.test(valor) || valor !== valor.trim()) {
    return '"' + valor.replace(/"/g, '""') + '"'
  }
  return valor
}
