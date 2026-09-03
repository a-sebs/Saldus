/**
 * Avisos: la confirmación breve que aparece tras guardar o borrar.
 *
 * Lleva la acción de deshacer, que es lo que hace tolerable borrar un
 * movimiento sin un diálogo de confirmación de por medio. El borrado es
 * suave, así que deshacer es literalmente quitar `eliminado_en`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import estilos from './avisos.module.css'

interface Accion {
  texto: string
  hacer: () => void | Promise<void>
}

interface Aviso {
  id: number
  texto: string
  accion?: Accion
}

interface ValorContexto {
  mostrar: (texto: string, accion?: Accion) => void
}

const Contexto = createContext<ValorContexto | null>(null)

const DURACION_MS = 5000

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const siguienteId = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cerrar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    setAviso(null)
  }, [])

  const mostrar = useCallback(
    (texto: string, accion?: Accion) => {
      if (temporizador.current) clearTimeout(temporizador.current)
      siguienteId.current += 1
      setAviso({ id: siguienteId.current, texto, ...(accion ? { accion } : {}) })
      temporizador.current = setTimeout(() => setAviso(null), DURACION_MS)
    },
    [],
  )

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  const valor = useMemo(() => ({ mostrar }), [mostrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aviso && (
        <div className={estilos.aviso} role="status" aria-live="polite">
          <span className={estilos.texto}>{aviso.texto}</span>
          {aviso.accion && (
            <button
              type="button"
              className={estilos.accion}
              onClick={() => {
                void aviso.accion?.hacer()
                cerrar()
              }}
            >
              {aviso.accion.texto}
            </button>
          )}
        </div>
      )}
    </Contexto.Provider>
  )
}

export function useAviso(): ValorContexto {
  const v = useContext(Contexto)
  if (!v) throw new Error('useAviso fuera de ProveedorAvisos')
  return v
}
