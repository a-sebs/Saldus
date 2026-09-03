/** Repositorio de transacciones. El camino caliente de la app. */

import type { BaseLocal } from '../db.ts'
import { ahora } from '../../dominio/fechas.ts'
import { nuevoId } from '../../dominio/ids.ts'
import { validarTransaccion } from '../../dominio/reglas.ts'
import { vivas } from '../../dominio/vistas.ts'
import type {
  Centavos,
  FechaContable,
  TipoTransaccion,
  Transaccion,
  UUID,
} from '../../dominio/tipos.ts'
import { encolar, marcasNuevas, referencias } from './comun.ts'
import type { Guardado } from './comun.ts'

export interface EntradaTransaccion {
  id?: UUID
  id_cuenta: UUID
  id_cuenta_destino?: UUID | null
  id_categoria?: UUID | null
  tipo: TipoTransaccion
  monto: Centavos
  fecha: FechaContable
  descripcion?: string | null
  /** Ids de etiquetas. Reemplaza el conjunto completo. */
  etiquetas?: UUID[]
}

export async function listarTransacciones(base: BaseLocal): Promise<Transaccion[]> {
  return vivas(await base.transacciones.toArray())
}

export async function obtenerTransaccion(
  base: BaseLocal,
  id: UUID,
): Promise<Transaccion | undefined> {
  return base.transacciones.get(id)
}

/**
 * Guarda un movimiento.
 *
 * Devuelve en cuanto IndexedDB confirma. No hay `await` de red en ningún
 * punto de este camino: la interfaz dice "guardado" y es verdad.
 */
export async function guardarTransaccion(
  base: BaseLocal,
  idUsuario: UUID,
  entrada: EntradaTransaccion,
): Promise<Guardado> {
  const id = entrada.id ?? nuevoId()

  return base.transaction(
    'rw',
    base.transacciones,
    base.cuentas,
    base.categorias,
    base.etiquetas,
    base.transaccion_etiqueta,
    base.outbox,
    async () => {
      const refs = await referencias(base)
      const previa = entrada.id ? await base.transacciones.get(entrada.id) : undefined

      const esTransferencia = entrada.tipo === 'TRANSFERENCIA'
      const candidata = {
        id,
        id_cuenta: entrada.id_cuenta,
        // Se normaliza aquí para que la forma sea siempre la que el
        // CHECK del esquema espera, incluso si la pantalla se despista.
        id_cuenta_destino: esTransferencia ? (entrada.id_cuenta_destino ?? null) : null,
        id_categoria: esTransferencia ? null : (entrada.id_categoria ?? null),
        tipo: entrada.tipo,
        monto: entrada.monto,
        fecha: entrada.fecha,
        descripcion: normalizarDescripcion(entrada.descripcion),
      }

      const r = validarTransaccion(candidata, refs)
      if (!r.ok) return { ok: false as const, problemas: r.problemas }

      const fila: Transaccion = previa
        ? { ...previa, ...candidata, actualizado_en: ahora() }
        : { ...candidata, id_usuario: idUsuario, ...marcasNuevas() }

      await base.transacciones.put(fila)

      if (entrada.etiquetas) {
        await base.transaccion_etiqueta.where('id_transaccion').equals(id).delete()
        for (const idEtiqueta of entrada.etiquetas) {
          await base.transaccion_etiqueta.put({
            id_transaccion: id,
            id_etiqueta: idEtiqueta,
          })
          await encolar(base, 'transaccion_etiqueta', `${id}:${idEtiqueta}`)
        }
      }

      await encolar(base, 'transacciones', id)
      return { ok: true as const, id }
    },
  )
}

function normalizarDescripcion(d: string | null | undefined): string | null {
  const t = (d ?? '').trim()
  return t === '' ? null : t
}

/**
 * Borrado suave. La fila se queda con `eliminado_en` puesto para que la
 * Fase 2 pueda contarle al servidor que se borró; un DELETE duro sería
 * invisible para el otro lado y, sobre todo, irrecuperable.
 */
export async function borrarTransaccion(base: BaseLocal, id: UUID): Promise<void> {
  await base.transaction('rw', base.transacciones, base.outbox, async () => {
    const previa = await base.transacciones.get(id)
    if (!previa || previa.eliminado_en !== null) return
    const t = ahora()
    await base.transacciones.put({ ...previa, eliminado_en: t, actualizado_en: t })
    await encolar(base, 'transacciones', id)
  })
}

/** Deshacer: lo contrario del borrado suave, que por eso es posible. */
export async function restaurarTransaccion(base: BaseLocal, id: UUID): Promise<void> {
  await base.transaction('rw', base.transacciones, base.outbox, async () => {
    const previa = await base.transacciones.get(id)
    if (!previa) return
    await base.transacciones.put({
      ...previa,
      eliminado_en: null,
      actualizado_en: ahora(),
    })
    await encolar(base, 'transacciones', id)
  })
}

/**
 * Alta en bloque para el importador de CSV. Valida fila por fila y no
 * mete ninguna si alguna falla: media importación es peor que ninguna.
 */
export async function importarTransacciones(
  base: BaseLocal,
  idUsuario: UUID,
  entradas: readonly EntradaTransaccion[],
): Promise<{ ok: true; cuantas: number } | { ok: false; fila: number; mensaje: string }> {
  return base.transaction(
    'rw',
    base.transacciones,
    base.cuentas,
    base.categorias,
    base.etiquetas,
    base.outbox,
    async () => {
      const refs = await referencias(base)
      const filas: Transaccion[] = []

      for (let i = 0; i < entradas.length; i++) {
        const e = entradas[i] as EntradaTransaccion
        const esTransferencia = e.tipo === 'TRANSFERENCIA'
        const candidata = {
          id: e.id ?? nuevoId(),
          id_cuenta: e.id_cuenta,
          id_cuenta_destino: esTransferencia ? (e.id_cuenta_destino ?? null) : null,
          id_categoria: esTransferencia ? null : (e.id_categoria ?? null),
          tipo: e.tipo,
          monto: e.monto,
          fecha: e.fecha,
          descripcion: normalizarDescripcion(e.descripcion),
        }

        const r = validarTransaccion(candidata, refs)
        if (!r.ok) {
          return {
            ok: false as const,
            fila: i,
            mensaje: r.problemas[0]?.mensaje ?? 'Fila inválida.',
          }
        }

        filas.push({ ...candidata, id_usuario: idUsuario, ...marcasNuevas() })
      }

      await base.transacciones.bulkPut(filas)
      for (const f of filas) await encolar(base, 'transacciones', f.id)

      return { ok: true as const, cuantas: filas.length }
    },
  )
}
