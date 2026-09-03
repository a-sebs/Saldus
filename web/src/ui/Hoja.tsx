/**
 * Hoja modal.
 *
 * Es **lo único de la app que flota de verdad**, así que es lo único
 * que lleva sombra y el radio grande. Entra desde abajo porque ahí está
 * el pulgar, y se cierra tocando fuera o con Escape.
 */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import estilos from './Hoja.module.css'

interface Props {
  abierta: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

export function Hoja({ abierta, titulo, onCerrar, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierta) return

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclear)

    // Mientras la hoja está abierta el fondo no se desplaza: si no, al
    // arrastrar dentro de la hoja se mueve la lista de atrás.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    panel.current?.focus()

    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierta, onCerrar])

  if (!abierta) return null

  return (
    <div className={estilos.fondo} onClick={onCerrar}>
      <div
        ref={panel}
        className={estilos.panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={estilos.asa} aria-hidden="true" />
        <div className={estilos.encabezado}>
          <h2 className={estilos.titulo}>{titulo}</h2>
          <button
            type="button"
            className={estilos.cerrar}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className={estilos.cuerpo}>{children}</div>
      </div>
    </div>
  )
}
