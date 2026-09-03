/**
 * Opción directa, visible y pulsable.
 *
 * Las categorías y las cuentas se eligen con estos, **nunca dentro de un
 * desplegable**: un `<select>` esconde las opciones detrás de un toque y
 * de un menú del sistema, y eso solo ya rompe el objetivo de dos toques.
 */

import type { ReactNode } from 'react'
import estilos from './Chip.module.css'

interface Props {
  seleccionado?: boolean
  onClick: () => void
  children: ReactNode
  /** Variante apagada para acciones como "Todas" o "Más". */
  secundario?: boolean
}

export function Chip({ seleccionado = false, onClick, children, secundario = false }: Props) {
  return (
    <button
      type="button"
      className={[
        estilos.chip,
        seleccionado ? estilos.seleccionado : '',
        secundario ? estilos.secundario : '',
      ].join(' ')}
      onClick={onClick}
      aria-pressed={seleccionado}
    >
      {children}
    </button>
  )
}

export function FilaChips({ children }: { children: ReactNode }) {
  return <div className={estilos.fila}>{children}</div>
}
