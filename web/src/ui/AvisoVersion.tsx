/**
 * Aviso de versión nueva.
 *
 * El service worker está en modo `prompt`, no `autoUpdate`: recargar la
 * app sola mientras alguien está a mitad de escribir un gasto es un
 * riesgo innecesario en una app donde el dispositivo es la fuente de
 * verdad. Se avisa y decide el usuario.
 */

import { useRegisterSW } from 'virtual:pwa-register/react'
import estilos from './AvisoVersion.module.css'

export function AvisoVersion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW()

  if (!hayVersionNueva) return null

  return (
    <div className={estilos.aviso} role="status">
      <span className={estilos.texto}>Hay una versión nueva de la app.</span>
      <button
        type="button"
        className={estilos.accion}
        onClick={() => void updateServiceWorker(true)}
      >
        Actualizar
      </button>
      <button
        type="button"
        className={estilos.descartar}
        onClick={() => setHayVersionNueva(false)}
      >
        Ahora no
      </button>
    </div>
  )
}
