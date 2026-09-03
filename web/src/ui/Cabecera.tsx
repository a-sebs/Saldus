/**
 * Cabecera de pantalla.
 *
 * El título no lleva mayúsculas con tracking ni ninguna palabra
 * resaltada en otro color: es una línea de texto y ya. Debajo hay
 * espacio para la cifra que resume la pantalla, que es lo que uno viene
 * a mirar.
 */

import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import estilos from './Cabecera.module.css'

interface Props {
  titulo: string
  /** Ruta a la que vuelve la flecha. Sin esto no hay botón de volver. */
  volverA?: string
  derecha?: ReactNode
  /** Cifra o resumen bajo el título. */
  children?: ReactNode
}

export function Cabecera({ titulo, volverA, derecha, children }: Props) {
  const navegar = useNavigate()

  return (
    <header className={estilos.cabecera}>
      <div className={estilos.fila}>
        {volverA !== undefined && (
          <button
            type="button"
            className={estilos.volver}
            onClick={() => navegar(volverA)}
            aria-label="Volver"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M13.5 4.5 7 11l6.5 6.5" />
            </svg>
          </button>
        )}

        <h1 className={estilos.titulo}>{titulo}</h1>
        {derecha && <div className={estilos.derecha}>{derecha}</div>}
      </div>

      {children && <div className={estilos.resumen}>{children}</div>}
    </header>
  )
}
