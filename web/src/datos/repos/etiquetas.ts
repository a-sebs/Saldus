/** Repositorio de etiquetas. Lista plana, sin jerarquía. */

import type { BaseLocal } from '../db.ts'
import { ahora } from '../../dominio/fechas.ts'
import { nuevoId } from '../../dominio/ids.ts'
import { validarEtiqueta } from '../../dominio/reglas.ts'
import { vivas } from '../../dominio/vistas.ts'
import type { Etiqueta, UUID } from '../../dominio/tipos.ts'
import { encolar, marcasNuevas, referencias } from './comun.ts'
import type { Guardado } from './comun.ts'

export async function listarEtiquetas(base: BaseLocal): Promise<Etiqueta[]> {
  return vivas(await base.etiquetas.toArray()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es'),
  )
}

export interface EtiquetaConUso extends Etiqueta {
  usos: number
}

export async function etiquetasConUso(base: BaseLocal): Promise<EtiquetaConUso[]> {
  const [etiquetas, enlaces, transacciones] = await Promise.all([
    listarEtiquetas(base),
    base.transaccion_etiqueta.toArray(),
    base.transacciones.toArray(),
  ])

  // Una etiqueta pegada a un movimiento borrado no cuenta como uso.
  const vivasTrx = new Set(
    transacciones.filter((t) => t.eliminado_en === null).map((t) => t.id),
  )
  const conteo = new Map<UUID, number>()
  for (const e of enlaces) {
    if (!vivasTrx.has(e.id_transaccion)) continue
    conteo.set(e.id_etiqueta, (conteo.get(e.id_etiqueta) ?? 0) + 1)
  }

  return etiquetas.map((e) => ({ ...e, usos: conteo.get(e.id) ?? 0 }))
}

export async function etiquetasDe(base: BaseLocal, idTransaccion: UUID): Promise<UUID[]> {
  const filas = await base.transaccion_etiqueta
    .where('id_transaccion')
    .equals(idTransaccion)
    .toArray()
  return filas.map((f) => f.id_etiqueta)
}

export async function guardarEtiqueta(
  base: BaseLocal,
  idUsuario: UUID,
  entrada: { id?: UUID; nombre: string },
): Promise<Guardado> {
  const id = entrada.id ?? nuevoId()

  return base.transaction('rw', base.etiquetas, base.cuentas, base.categorias, base.outbox, async () => {
    const refs = await referencias(base)
    const previa = entrada.id ? await base.etiquetas.get(entrada.id) : undefined

    const candidata = { id, nombre: entrada.nombre.trim() }
    const r = validarEtiqueta(candidata, refs)
    if (!r.ok) return { ok: false as const, problemas: r.problemas }

    const fila: Etiqueta = previa
      ? { ...previa, ...candidata, actualizado_en: ahora() }
      : { ...candidata, id_usuario: idUsuario, ...marcasNuevas() }

    await base.etiquetas.put(fila)
    await encolar(base, 'etiquetas', id)
    return { ok: true as const, id }
  })
}

export async function borrarEtiqueta(base: BaseLocal, id: UUID): Promise<void> {
  await base.transaction('rw', base.etiquetas, base.outbox, async () => {
    const previa = await base.etiquetas.get(id)
    if (!previa) return
    const t = ahora()
    await base.etiquetas.put({ ...previa, eliminado_en: t, actualizado_en: t })
    await encolar(base, 'etiquetas', id)
  })
}
