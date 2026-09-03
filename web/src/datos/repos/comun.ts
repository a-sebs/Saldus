/**
 * Piezas compartidas por todos los repositorios.
 *
 * El contrato de **toda** escritura de la app es siempre el mismo:
 *
 *   validar con reglas.ts → escribir en Dexie → encolar en outbox
 *
 * los tres pasos dentro de una misma transacción de Dexie, y recién
 * entonces se le confirma al usuario. La interfaz no espera nada más:
 * la red no participa.
 */

import type { BaseLocal } from '../db.ts'
import { ahora } from '../../dominio/fechas.ts'
import type { Referencias } from '../../dominio/reglas.ts'
import type { EntidadSync, Instante, UUID } from '../../dominio/tipos.ts'
import { vivas } from '../../dominio/vistas.ts'

export type Guardado =
  | { ok: true; id: UUID }
  | { ok: false; problemas: { campo: string; mensaje: string }[] }

/**
 * Encola una fila para el `POST /sync/push` de la Fase 2.
 *
 * Se escribe ya, aunque en la Fase 1 nadie drene la cola: son unas pocas
 * líneas ahora, contra tener que volver a recorrer cada sitio de
 * escritura después. Además la interfaz ya la usa para marcar las filas
 * que están sin sincronizar.
 *
 * Si la fila ya estaba encolada se reemplaza en vez de duplicarse: el
 * push manda el estado actual completo, no un diario de cambios.
 */
export async function encolar(
  base: BaseLocal,
  entidad: EntidadSync,
  id: string,
): Promise<void> {
  const previas = await base.outbox.where('id').equals(id).toArray()
  const yaEstaba = previas.find((p) => p.entidad === entidad)

  if (yaEstaba?.seq !== undefined) {
    await base.outbox.update(yaEstaba.seq, { encolado_en: ahora() })
    return
  }

  await base.outbox.add({
    entidad,
    id,
    op: 'upsert',
    encolado_en: ahora(),
    intentos: 0,
  })
}

/** Ids que aún no se han sincronizado, para marcarlos en la lista. */
export async function idsPendientes(base: BaseLocal): Promise<Set<string>> {
  const filas = await base.outbox.toArray()
  return new Set(filas.map((f) => f.id))
}

export async function contarPendientes(base: BaseLocal): Promise<number> {
  return base.outbox.count()
}

/**
 * Datos de referencia vivos para validar. Se leen dentro de la misma
 * transacción que la escritura, así que no puede colarse una condición
 * de carrera entre la comprobación y el guardado.
 */
export async function referencias(base: BaseLocal): Promise<Referencias> {
  const [cuentas, categorias, etiquetas] = await Promise.all([
    base.cuentas.toArray(),
    base.categorias.toArray(),
    base.etiquetas.toArray(),
  ])
  return {
    cuentas: vivas(cuentas),
    categorias: vivas(categorias),
    etiquetas: vivas(etiquetas),
  }
}

/**
 * Marcas de tiempo de una fila nueva.
 *
 * En Postgres `actualizado_en` lo mantiene un trigger. Aquí no hay
 * triggers, así que lo pone el repositorio: es el mismo papel, en el
 * único sitio por el que pasan todas las escrituras. Cuando en la Fase 2
 * el servidor devuelva su propio `actualizado_en`, ese gana.
 */
export function marcasNuevas(): {
  creado_en: Instante
  actualizado_en: Instante
  eliminado_en: null
} {
  const t = ahora()
  return { creado_en: t, actualizado_en: t, eliminado_en: null }
}
