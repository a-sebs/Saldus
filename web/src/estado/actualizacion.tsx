/**
 * Estado de actualización de la app.
 *
 * El service worker está en modo `prompt` y no `autoUpdate`: recargar la
 * app sola mientras alguien escribe un gasto es un riesgo innecesario
 * cuando el dispositivo es la fuente de verdad. Decide el usuario.
 *
 * El registro vive aquí y no en el aviso por dos motivos:
 *
 * 1. `useRegisterSW` registra el worker cada vez que se llama. Con la
 *    llamada dentro del aviso, Ajustes no podía enterarse de nada sin
 *    provocar un segundo registro con su propio estado, desincronizado
 *    del primero.
 * 2. El navegador solo busca versiones nuevas al registrar. Si la app se
 *    abrió antes de que terminara el despliegue, no se enteraba nunca:
 *    no había forma de volver a preguntar. De ahí `buscar()`.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Cada cuánto se vuelve a preguntar mientras la app sigue abierta. */
const INTERVALO_MS = 60 * 60 * 1000

export type EstadoBusqueda = 'reposo' | 'buscando' | 'al-dia' | 'sin-soporte'

interface ValorContexto {
  hayVersionNueva: boolean
  estadoBusqueda: EstadoBusqueda
  /** Aplica la versión nueva. Recarga la página. */
  actualizar: () => Promise<void>
  /** Pregunta al servidor si hay algo nuevo, ahora. */
  buscar: () => Promise<void>
  descartar: () => void
}

const Contexto = createContext<ValorContexto | null>(null)

export function ProveedorActualizacion({ children }: { children: ReactNode }) {
  const registro = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const [estadoBusqueda, setEstadoBusqueda] = useState<EstadoBusqueda>('reposo')

  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registro.current = r
      // Sin esto, una sesión larga no se entera de un despliegue hasta
      // que se cierra y se vuelve a abrir la app.
      if (r) setInterval(() => void r.update().catch(() => {}), INTERVALO_MS)
    },
  })

  // Espejo en ref: `buscar` se ejecuta fuera del render que capturó el
  // valor, así que necesita leer el actual y no el de hace un momento.
  const hayVersionNuevaRef = useRef(hayVersionNueva)
  useEffect(() => {
    hayVersionNuevaRef.current = hayVersionNueva
  }, [hayVersionNueva])

  async function buscar() {
    if (!registro.current) {
      setEstadoBusqueda('sin-soporte')
      return
    }
    setEstadoBusqueda('buscando')
    try {
      await registro.current.update()
    } catch {
      // Sin conexión no es un error en esta app: se cae a "al día" y ya.
    }
    // `update()` resuelve al terminar la consulta, pero el worker nuevo
    // pasa a "installed" por un evento un instante después. Sin esta
    // espera diríamos "ya estás al día" justo antes de que aparezca.
    await new Promise((r) => setTimeout(r, 1500))
    setEstadoBusqueda(hayVersionNuevaRef.current ? 'reposo' : 'al-dia')
  }

  async function actualizar() {
    await updateServiceWorker(true)
  }

  return (
    <Contexto.Provider
      value={{
        hayVersionNueva,
        estadoBusqueda,
        actualizar,
        buscar,
        descartar: () => setHayVersionNueva(false),
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function useActualizacion(): ValorContexto {
  const v = useContext(Contexto)
  if (!v) throw new Error('useActualizacion fuera de ProveedorActualizacion')
  return v
}
