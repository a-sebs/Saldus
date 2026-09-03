/**
 * Estado vacío.
 *
 * Invita a hacer la primera cosa útil. Sin ilustración y sin "Aún no
 * hay nada aquí": eso ya lo ve el usuario, lo que no sabe es qué hacer.
 */

import type { ReactNode } from 'react'
import estilos from './EstadoVacio.module.css'

interface Props {
  titulo: string
  children?: ReactNode
  accion?: { texto: string; hacer: () => void }
}

export function EstadoVacio({ titulo, children, accion }: Props) {
  return (
    <div className={estilos.vacio}>
      <p className={estilos.titulo}>{titulo}</p>
      {children && <p className={estilos.detalle}>{children}</p>}
      {accion && (
        <button
          type="button"
          className="boton boton--secundario"
          onClick={accion.hacer}
        >
          {accion.texto}
        </button>
      )}
    </div>
  )
}
