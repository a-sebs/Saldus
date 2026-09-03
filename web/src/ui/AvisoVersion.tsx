/**
 * Aviso de versión nueva.
 *
 * El registro del service worker no vive aquí sino en
 * `estado/actualizacion.tsx`, para que Ajustes pueda ofrecer el mismo
 * botón sin provocar un segundo registro con su propio estado.
 *
 * Este aviso es oportunista: aparece si la versión nueva se detecta
 * mientras la app está abierta. El camino fiable —preguntar cuando uno
 * quiera— está en Ajustes.
 */

import { useActualizacion } from '../estado/actualizacion.tsx'
import estilos from './AvisoVersion.module.css'

export function AvisoVersion() {
  const { hayVersionNueva, actualizar, descartar } = useActualizacion()

  if (!hayVersionNueva) return null

  return (
    <div className={estilos.aviso} role="status">
      <span className={estilos.texto}>Hay una versión nueva de la app.</span>
      <button
        type="button"
        className={estilos.accion}
        onClick={() => void actualizar()}
      >
        Actualizar
      </button>
      <button type="button" className={estilos.descartar} onClick={descartar}>
        Ahora no
      </button>
    </div>
  )
}
