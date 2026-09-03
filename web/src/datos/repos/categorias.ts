/** Repositorio de categorías. Árbol de dos niveles. */

import type { BaseLocal } from '../db.ts'
import { ahora } from '../../dominio/fechas.ts'
import { nuevoId } from '../../dominio/ids.ts'
import { validarCategoria } from '../../dominio/reglas.ts'
import { vivas } from '../../dominio/vistas.ts'
import type { Categoria, TipoCategoria, UUID } from '../../dominio/tipos.ts'
import { encolar, marcasNuevas, referencias } from './comun.ts'
import type { Guardado } from './comun.ts'

export interface EntradaCategoria {
  id?: UUID
  nombre: string
  tipo: TipoCategoria
  id_padre: UUID | null
}

export async function listarCategorias(base: BaseLocal): Promise<Categoria[]> {
  return vivas(await base.categorias.toArray())
}

export interface NodoCategoria {
  categoria: Categoria
  hijas: Categoria[]
}

/** El árbol de dos niveles, ordenado alfabéticamente para administrar. */
export async function arbolCategorias(
  base: BaseLocal,
  tipo: TipoCategoria,
): Promise<NodoCategoria[]> {
  const todas = (await listarCategorias(base)).filter((c) => c.tipo === tipo)
  const porNombre = (a: Categoria, b: Categoria) =>
    a.nombre.localeCompare(b.nombre, 'es')

  return todas
    .filter((c) => c.id_padre === null)
    .sort(porNombre)
    .map((categoria) => ({
      categoria,
      hijas: todas.filter((c) => c.id_padre === categoria.id).sort(porNombre),
    }))
}

export async function guardarCategoria(
  base: BaseLocal,
  idUsuario: UUID,
  entrada: EntradaCategoria,
): Promise<Guardado> {
  const id = entrada.id ?? nuevoId()

  return base.transaction('rw', base.categorias, base.cuentas, base.etiquetas, base.outbox, async () => {
    const refs = await referencias(base)
    const previa = entrada.id ? await base.categorias.get(entrada.id) : undefined

    const candidata = {
      id,
      nombre: entrada.nombre.trim(),
      tipo: entrada.tipo,
      id_padre: entrada.id_padre,
    }

    const r = validarCategoria(candidata, refs)
    if (!r.ok) return { ok: false as const, problemas: r.problemas }

    // Cambiar el tipo de una categoría que ya tiene hijas rompería la FK
    // compuesta (id_padre, tipo) del esquema en cuanto se sincronizara.
    if (previa && previa.tipo !== candidata.tipo) {
      const hijas = refs.categorias.filter((c) => c.id_padre === id).length
      if (hijas > 0) {
        return {
          ok: false as const,
          problemas: [
            {
              campo: 'tipo',
              mensaje:
                'No se puede cambiar el tipo de una categoría con subcategorías: heredan el tipo del padre.',
            },
          ],
        }
      }
    }

    const fila: Categoria = previa
      ? { ...previa, ...candidata, actualizado_en: ahora() }
      : { ...candidata, id_usuario: idUsuario, ...marcasNuevas() }

    await base.categorias.put(fila)
    await encolar(base, 'categorias', id)
    return { ok: true as const, id }
  })
}

export interface UsoCategoria {
  movimientos: number
  hijas: number
  movimientosDeHijas: number
}

/**
 * Cuánto se usa una categoría. La pantalla lo muestra **antes** de
 * confirmar el archivado: archivar algo con 84 movimientos detrás no
 * puede ser una sorpresa.
 */
export async function usoDeCategoria(
  base: BaseLocal,
  id: UUID,
): Promise<UsoCategoria> {
  const [categorias, transacciones] = await Promise.all([
    listarCategorias(base),
    base.transacciones.toArray(),
  ])

  const hijas = categorias.filter((c) => c.id_padre === id)
  const idsHijas = new Set(hijas.map((h) => h.id))
  const vivasTrx = transacciones.filter((t) => t.eliminado_en === null)

  return {
    movimientos: vivasTrx.filter((t) => t.id_categoria === id).length,
    hijas: hijas.length,
    movimientosDeHijas: vivasTrx.filter(
      (t) => t.id_categoria !== null && idsHijas.has(t.id_categoria),
    ).length,
  }
}

/**
 * Archivar una categoría es su borrado suave: deja de ofrecerse al
 * registrar, pero los movimientos que ya la usan la siguen mostrando.
 * Sus subcategorías se archivan con ella, porque una subcategoría sin
 * padre visible no tiene dónde vivir en un árbol de dos niveles.
 */
export async function archivarCategoria(base: BaseLocal, id: UUID): Promise<void> {
  await base.transaction('rw', base.categorias, base.outbox, async () => {
    const t = ahora()
    const todas = await base.categorias.toArray()
    const objetivo = todas.filter(
      (c) => c.eliminado_en === null && (c.id === id || c.id_padre === id),
    )

    for (const c of objetivo) {
      await base.categorias.put({ ...c, eliminado_en: t, actualizado_en: t })
      await encolar(base, 'categorias', c.id)
    }
  })
}

export async function restaurarCategoria(base: BaseLocal, id: UUID): Promise<void> {
  await base.transaction('rw', base.categorias, base.outbox, async () => {
    const previa = await base.categorias.get(id)
    if (!previa) return
    await base.categorias.put({
      ...previa,
      eliminado_en: null,
      actualizado_en: ahora(),
    })
    await encolar(base, 'categorias', id)
  })
}
