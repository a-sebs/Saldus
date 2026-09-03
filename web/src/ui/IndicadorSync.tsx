/**
 * Indicador de sincronización.
 *
 * Tres estados y ninguno grita:
 *
 * - Todo al día: **no se muestra nada**. Un icono verde permanente
 *   diciendo "ok" es ruido, y entrena a no mirarlo.
 * - Con pendientes: un contador sobrio.
 * - Sin conexión: un aviso claro y tranquilo. No es un error: la app
 *   está hecha para funcionar así.
 *
 * Mientras `HAY_BACKEND` sea falso no hay nada que sincronizar, así que
 * el contador no aparece: mostrar el número de la cola de salida como
 * "pendientes" sería mentir.
 */

import { HAY_BACKEND } from '../config.ts'
import { useEnLinea } from '../estado/conexion.ts'
import { IconoSinConexion } from './iconos.tsx'
import estilos from './IndicadorSync.module.css'

export function IndicadorSync({ pendientes }: { pendientes: number }) {
  const enLinea = useEnLinea()

  if (!enLinea) {
    return (
      <span className={estilos.indicador} role="status">
        <IconoSinConexion />
        <span>Sin conexión, se guarda igual</span>
      </span>
    )
  }

  if (HAY_BACKEND && pendientes > 0) {
    return (
      <span className={estilos.indicador} role="status">
        <span className={estilos.contador}>{pendientes}</span>
        <span>{pendientes === 1 ? 'por enviar' : 'por enviar'}</span>
      </span>
    )
  }

  return null
}
