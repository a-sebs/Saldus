/**
 * Frecuencia de uso — el orden de las categorías en la pantalla de
 * captura.
 *
 * "Ordenadas por frecuencia de uso reciente, no alfabéticamente" es una
 * buena intención hasta que alguien tiene que escribir el `sort`. Esta
 * es la regla concreta:
 *
 *   puntaje = Σ 0.5 ^ (díasAtrás / 30)   sobre los últimos 60 días
 *
 * Es una vida media de 30 días: un gasto de hoy vale 1, uno de hace un
 * mes vale 0.5, uno de hace dos vale 0.25 y ahí se corta. Con eso, la
 * categoría que usé ayer sube sola y la que usaba en enero baja sola,
 * sin que yo tenga que reordenar nada nunca.
 *
 * Empate: alfabético. Sin historial: el orden en que llegaron las
 * categorías (el de la semilla), que ya está pensado para que lo más
 * frecuente esté arriba el primer día.
 */

import { diasEntre, hoy } from './fechas.ts'
import { viva } from './vistas.ts'
import type {
  Categoria,
  Centavos,
  Transaccion,
  TipoCategoria,
  UUID,
} from './tipos.ts'

const VENTANA_DIAS = 60
const VIDA_MEDIA_DIAS = 30

/** Puntaje de uso reciente por id de categoría. */
export function puntajesDeUso(
  transacciones: readonly Transaccion[],
  ahoraMs: number = Date.now(),
): Map<UUID, number> {
  const hoyStr = hoy(ahoraMs)
  const puntajes = new Map<UUID, number>()

  for (const t of transacciones) {
    if (!viva(t)) continue
    if (t.id_categoria === null) continue

    const atras = diasEntre(t.fecha, hoyStr)
    // Un movimiento con fecha futura (se registra el sueldo del día 30
    // por adelantado) cuenta como de hoy, no se descarta.
    const dias = Math.max(0, atras)
    if (dias > VENTANA_DIAS) continue

    const peso = Math.pow(0.5, dias / VIDA_MEDIA_DIAS)
    puntajes.set(t.id_categoria, (puntajes.get(t.id_categoria) ?? 0) + peso)
  }

  return puntajes
}

function ordenar(
  candidatas: readonly Categoria[],
  puntajeDe: (c: Categoria) => number,
): Categoria[] {
  // El orden de llegada hace de desempate final: es el de la semilla,
  // que ya viene ordenada por lo que uno usa más el primer día.
  const orden = new Map(candidatas.map((c, i) => [c.id, i]))

  return [...candidatas].sort((a, b) => {
    const pa = puntajeDe(a)
    const pb = puntajeDe(b)
    if (pb !== pa) return pb - pa
    if (pa === 0) return (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0)
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

/**
 * Lista plana de categorías de un tipo, ordenada por uso **propio**.
 *
 * Es la que alimenta las opciones directas de la pantalla de captura:
 * cada opción se asigna tal cual a la transacción, así que el puntaje
 * tiene que medir las veces que se eligió *esa* categoría. Si el padre
 * heredara el puntaje de sus hijas, "Comida" subiría hasta arriba sin
 * que nadie la haya elegido nunca, empujando fuera de pantalla a la
 * subcategoría que sí se usa.
 */
export function ordenarPorFrecuencia(
  categorias: readonly Categoria[],
  transacciones: readonly Transaccion[],
  tipo: TipoCategoria,
  ahoraMs: number = Date.now(),
): Categoria[] {
  const puntajes = puntajesDeUso(transacciones, ahoraMs)
  const candidatas = categorias.filter((c) => viva(c) && c.tipo === tipo)
  return ordenar(candidatas, (c) => puntajes.get(c.id) ?? 0)
}

/**
 * Solo el primer nivel, con el puntaje de cada raíz **acumulando el de
 * sus hijas**.
 *
 * Es la que ordena el selector completo de dos niveles y la pantalla de
 * categorías: ahí la pregunta es "¿en qué gasto?", y si todo lo registro
 * en "Comida > Almuerzo", "Comida" tiene que salir arriba aunque nunca
 * la haya elegido directamente.
 */
export function raicesPorFrecuencia(
  categorias: readonly Categoria[],
  transacciones: readonly Transaccion[],
  tipo: TipoCategoria,
  ahoraMs: number = Date.now(),
): Categoria[] {
  const puntajes = puntajesDeUso(transacciones, ahoraMs)
  const delTipo = categorias.filter((c) => viva(c) && c.tipo === tipo)
  const raices = delTipo.filter((c) => c.id_padre === null)

  return ordenar(raices, (c) => {
    let p = puntajes.get(c.id) ?? 0
    for (const hija of delTipo) {
      if (hija.id_padre === c.id) p += puntajes.get(hija.id) ?? 0
    }
    return p
  })
}

/** Hijas vivas de una categoría, ordenadas por uso reciente. */
export function hijasPorFrecuencia(
  categorias: readonly Categoria[],
  transacciones: readonly Transaccion[],
  idPadre: UUID,
  ahoraMs: number = Date.now(),
): Categoria[] {
  const puntajes = puntajesDeUso(transacciones, ahoraMs)
  const hijas = categorias.filter((c) => viva(c) && c.id_padre === idPadre)
  return ordenar(hijas, (c) => puntajes.get(c.id) ?? 0)
}

/**
 * Montos sugeridos: los que más se repiten en los últimos 90 días.
 *
 * Sirve al objetivo de los dos toques. Si el pasaje del bus siempre
 * cuesta 0.35, que esté a un toque y no a cuatro dígitos tecleados.
 */
export function montosFrecuentes(
  transacciones: readonly Transaccion[],
  tipo: TipoCategoria,
  cuantos = 4,
  ahoraMs: number = Date.now(),
): Centavos[] {
  const hoyStr = hoy(ahoraMs)
  const conteo = new Map<Centavos, number>()

  for (const t of transacciones) {
    if (!viva(t) || t.tipo !== tipo) continue
    const dias = diasEntre(t.fecha, hoyStr)
    if (dias < 0 || dias > 90) continue
    conteo.set(t.monto, (conteo.get(t.monto) ?? 0) + 1)
  }

  return [...conteo.entries()]
    .filter(([, n]) => n >= 2) // sugerir algo usado una sola vez es ruido
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, cuantos)
    .map(([monto]) => monto)
}

/**
 * La subcategoría más usada dentro de una categoría, para preseleccionar
 * al elegir el padre sin obligar a un toque más.
 */
export function hijaMasUsada(
  categorias: readonly Categoria[],
  transacciones: readonly Transaccion[],
  idPadre: UUID,
  ahoraMs: number = Date.now(),
): Categoria | null {
  const puntajes = puntajesDeUso(transacciones, ahoraMs)
  const hijas = categorias.filter((c) => viva(c) && c.id_padre === idPadre)
  if (hijas.length === 0) return null

  let mejor = hijas[0] as Categoria
  let mejorPuntaje = puntajes.get(mejor.id) ?? 0
  for (const h of hijas.slice(1)) {
    const p = puntajes.get(h.id) ?? 0
    if (p > mejorPuntaje) {
      mejor = h
      mejorPuntaje = p
    }
  }
  return mejorPuntaje > 0 ? mejor : null
}
