/**
 * Clave/valor local.
 *
 * Vive en IndexedDB y no en `localStorage` a propósito: el service
 * worker no puede leer `localStorage`, y estas claves son las que va a
 * necesitar el sync de la Fase 2.
 */

import type { BaseLocal } from '../db.ts'

export const CLAVES = {
  /** Última cuenta usada, para preseleccionarla al registrar. */
  ultimaCuenta: 'ultima_cuenta_usada',
  /** Marca de agua del sync delta: "dame todo lo que cambió desde X". */
  ultimoSync: 'ultimo_sync_en',
  /** Si ya se mostró la invitación a instalar en pantalla de inicio. */
  invitacionInstalar: 'invitacion_instalar_vista',
  /** Si el usuario ya pasó por el alta de su primera cuenta. */
  onboardingHecho: 'onboarding_hecho',
} as const

export async function leerMeta<T>(
  base: BaseLocal,
  clave: string,
): Promise<T | undefined> {
  const fila = await base.meta.get(clave)
  return fila?.valor as T | undefined
}

export async function escribirMeta(
  base: BaseLocal,
  clave: string,
  valor: unknown,
): Promise<void> {
  await base.meta.put({ clave, valor })
}
