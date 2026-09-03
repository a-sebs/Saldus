/**
 * Contexto de sesión.
 *
 * **La autenticación protege la sincronización, no la interfaz.** Este
 * contexto no es un guard: no redirige a nadie ni bloquea nada. Solo
 * dice qué base local está abierta. Si hay datos locales, la app abre y
 * funciona completa aunque no haya red y aunque en la Fase 2 el token
 * esté vencido.
 *
 * La pantalla de acceso aparece únicamente cuando **no existe ninguna
 * sesión local**, que es literalmente la primera vez.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { baseDe, pedirPersistencia } from '../datos/db.ts'
import type { BaseLocal } from '../datos/db.ts'
import {
  cerrarSesion,
  crearSesionDemo,
  crearSesionPropia,
  sesionActual,
} from '../datos/sesion.ts'
import type { Sesion } from '../datos/sesion.ts'

interface ValorContexto {
  sesion: Sesion | null
  base: BaseLocal | null
  /** true mientras se decide si hay sesión: evita parpadeo del acceso. */
  cargando: boolean
  entrarDemo: () => Promise<void>
  /**
   * `alCrear` corre con la sesión ya creada pero **antes** de activarla,
   * para que el alta pueda sembrar la primera cuenta y el usuario entre
   * a una app lista en vez de a una pantalla vacía.
   */
  entrarPropia: (
    nombre: string,
    alCrear?: (sesion: Sesion) => Promise<void>,
  ) => Promise<void>
  salir: () => Promise<void>
}

const Contexto = createContext<ValorContexto | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setSesion(sesionActual())
    setCargando(false)

    // Safari desaloja por LRU y puede borrar IndexedDB bajo presión de
    // almacenamiento. Pedir persistencia no lo garantiza, pero mueve la
    // base al final de esa cola. Se pide una vez al arrancar.
    void pedirPersistencia()
  }, [])

  const base = useMemo(
    () => (sesion ? baseDe(sesion.id_usuario) : null),
    [sesion],
  )

  const entrarDemo = useCallback(async () => {
    setSesion(await crearSesionDemo())
  }, [])

  const entrarPropia = useCallback(
    async (nombre: string, alCrear?: (sesion: Sesion) => Promise<void>) => {
      const nueva = await crearSesionPropia({ nombre })
      if (alCrear) await alCrear(nueva)
      setSesion(nueva)
    },
    [],
  )

  const salir = useCallback(async () => {
    await cerrarSesion()
    setSesion(null)
  }, [])

  const valor = useMemo(
    () => ({ sesion, base, cargando, entrarDemo, entrarPropia, salir }),
    [sesion, base, cargando, entrarDemo, entrarPropia, salir],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): ValorContexto {
  const v = useContext(Contexto)
  if (!v) throw new Error('useSesion fuera de ProveedorSesion')
  return v
}

/**
 * La base activa. Las pantallas se montan solo dentro de una sesión, así
 * que aquí ya no puede ser nula y no tiene sentido obligarlas a
 * comprobarlo en cada línea.
 */
export function useBase(): BaseLocal {
  const { base } = useSesion()
  if (!base) throw new Error('No hay base activa')
  return base
}
