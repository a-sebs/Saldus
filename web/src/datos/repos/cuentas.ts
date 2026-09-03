/** Repositorio de cuentas. */

import type { BaseLocal } from '../db.ts'
import { ahora } from '../../dominio/fechas.ts'
import { nuevoId } from '../../dominio/ids.ts'
import { validarCuenta } from '../../dominio/reglas.ts'
import { vivas } from '../../dominio/vistas.ts'
import type { Centavos, Cuenta, TipoCuenta, UUID } from '../../dominio/tipos.ts'
import { encolar, marcasNuevas, referencias } from './comun.ts'
import type { Guardado } from './comun.ts'

export interface EntradaCuenta {
  /** Sin id se crea; con id se actualiza. */
  id?: UUID
  nombre: string
  tipo: TipoCuenta
  saldo_inicial: Centavos
  archivada?: boolean
}

export async function listarCuentas(base: BaseLocal): Promise<Cuenta[]> {
  return vivas(await base.cuentas.toArray()).sort((a, b) => {
    // Las archivadas al final; entre iguales, por nombre.
    if (a.archivada !== b.archivada) return a.archivada ? 1 : -1
    return a.nombre.localeCompare(b.nombre, 'es')
  })
}

/** Solo las que se pueden elegir al registrar un movimiento. */
export async function cuentasActivas(base: BaseLocal): Promise<Cuenta[]> {
  return (await listarCuentas(base)).filter((c) => !c.archivada)
}

export async function guardarCuenta(
  base: BaseLocal,
  idUsuario: UUID,
  entrada: EntradaCuenta,
): Promise<Guardado> {
  const id = entrada.id ?? nuevoId()

  return base.transaction('rw', base.cuentas, base.etiquetas, base.categorias, base.outbox, async () => {
    const refs = await referencias(base)
    const previa = entrada.id ? await base.cuentas.get(entrada.id) : undefined

    const candidata = {
      id,
      nombre: entrada.nombre.trim(),
      tipo: entrada.tipo,
      saldo_inicial: entrada.saldo_inicial,
      moneda: 'USD' as const,
    }

    const r = validarCuenta(candidata, refs)
    if (!r.ok) return { ok: false as const, problemas: r.problemas }

    const fila: Cuenta = previa
      ? {
          ...previa,
          ...candidata,
          archivada: entrada.archivada ?? previa.archivada,
          actualizado_en: ahora(),
        }
      : {
          ...candidata,
          id_usuario: idUsuario,
          archivada: entrada.archivada ?? false,
          ...marcasNuevas(),
        }

    await base.cuentas.put(fila)
    await encolar(base, 'cuentas', id)
    return { ok: true as const, id }
  })
}

/**
 * Archivar no borra: la cuenta desaparece de los selectores pero su
 * historial sigue contando en los saldos y en los resúmenes.
 */
export async function archivarCuenta(
  base: BaseLocal,
  id: UUID,
  archivada = true,
): Promise<void> {
  await base.transaction('rw', base.cuentas, base.outbox, async () => {
    const previa = await base.cuentas.get(id)
    if (!previa) return
    await base.cuentas.put({ ...previa, archivada, actualizado_en: ahora() })
    await encolar(base, 'cuentas', id)
  })
}

/**
 * Borrado suave. Con sincronización de por medio un DELETE duro es
 * irrecuperable, y además el otro lado nunca se enteraría del borrado.
 *
 * Se niega a borrar una cuenta con movimientos, igual que el
 * `ON DELETE RESTRICT` de la clave foránea del esquema: para eso está
 * archivar.
 */
export async function borrarCuenta(
  base: BaseLocal,
  id: UUID,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  return base.transaction('rw', base.cuentas, base.transacciones, base.outbox, async () => {
    const usos = await base.transacciones
      .filter(
        (t) =>
          t.eliminado_en === null &&
          (t.id_cuenta === id || t.id_cuenta_destino === id),
      )
      .count()

    if (usos > 0) {
      return {
        ok: false as const,
        motivo: `Esta cuenta tiene ${usos} ${
          usos === 1 ? 'movimiento' : 'movimientos'
        }. Archívala para conservar el historial.`,
      }
    }

    const previa = await base.cuentas.get(id)
    if (!previa) return { ok: true as const }

    const t = ahora()
    await base.cuentas.put({ ...previa, eliminado_en: t, actualizado_en: t })
    await encolar(base, 'cuentas', id)
    return { ok: true as const }
  })
}
