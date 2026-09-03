/**
 * Estado de la conexión.
 *
 * **Sin conexión no es un error en esta app, es un estado normal.** La
 * escritura ya está guardada en el dispositivo antes de que la red
 * entre en juego, así que estar sin señal no cambia nada de lo que el
 * usuario puede hacer. El tono de lo que se muestra tiene que reflejar
 * eso.
 */

import { useEffect, useState } from 'react'

export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const conectar = () => setEnLinea(true)
    const desconectar = () => setEnLinea(false)

    window.addEventListener('online', conectar)
    window.addEventListener('offline', desconectar)
    return () => {
      window.removeEventListener('online', conectar)
      window.removeEventListener('offline', desconectar)
    }
  }, [])

  return enLinea
}
