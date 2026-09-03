/**
 * Selector de mes.
 *
 * Los meses futuros se pueden mirar, pero no tiene sentido llegar más
 * allá del mes que viene: no hay nada que ver. El botón se deshabilita
 * en vez de desaparecer, para que la maquetación no salte.
 */

import { hoy, nombreMes, sumarMeses } from '../dominio/fechas.ts'
import type { FechaContable } from '../dominio/tipos.ts'
import estilos from './SelectorMes.module.css'

interface Props {
  mes: FechaContable
  onCambiar: (mes: FechaContable) => void
}

export function SelectorMes({ mes, onCambiar }: Props) {
  const limite = sumarMeses(hoy(), 1)
  const puedeAvanzar = sumarMeses(mes, 1) <= limite

  return (
    <div className={estilos.selector}>
      <button
        type="button"
        className={estilos.paso}
        onClick={() => onCambiar(sumarMeses(mes, -1))}
        aria-label="Mes anterior"
      >
        <Chevron direccion="izquierda" />
      </button>

      <span className={estilos.nombre}>{nombreMes(mes)}</span>

      <button
        type="button"
        className={estilos.paso}
        onClick={() => onCambiar(sumarMeses(mes, 1))}
        disabled={!puedeAvanzar}
        aria-label="Mes siguiente"
      >
        <Chevron direccion="derecha" />
      </button>
    </div>
  )
}

function Chevron({ direccion }: { direccion: 'izquierda' | 'derecha' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direccion === 'izquierda' ? 'M12 4 6 10l6 6' : 'M8 4l6 6-6 6'} />
    </svg>
  )
}
