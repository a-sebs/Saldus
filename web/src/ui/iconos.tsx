/**
 * Iconos de la navegación.
 *
 * Dibujados a mano y no traídos de una librería: son cuatro, tienen que
 * compartir grosor de trazo y caja óptica con el resto del sistema, y
 * una librería habría metido kilobytes y un estilo ajeno.
 *
 * Todos heredan el color con `currentColor`, así que el estado activo
 * se resuelve en CSS sin variantes.
 */

interface Props {
  activo?: boolean
}

const comun = {
  width: 22,
  height: 22,
  viewBox: '0 0 22 22',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
}

/** Movimientos: renglones de un libro, de distinto largo. */
export function IconoMovimientos({ activo }: Props) {
  return (
    <svg {...comun} strokeWidth={activo ? 2.1 : 1.6}>
      <path d="M3 5.5h16M3 11h11M3 16.5h14" />
    </svg>
  )
}

/** Cuentas: una tarjeta con su banda. */
export function IconoCuentas({ activo }: Props) {
  return (
    <svg {...comun} strokeWidth={activo ? 2.1 : 1.6}>
      <rect x="2.5" y="5" width="17" height="12" rx="2" />
      <path d="M2.5 9.5h17" />
    </svg>
  )
}

/** Resumen: barras de distinta altura. */
export function IconoResumen({ activo }: Props) {
  return (
    <svg {...comun} strokeWidth={activo ? 2.1 : 1.6}>
      <path d="M5 17V9M11 17V4M17 17v-5" />
    </svg>
  )
}

/** Ajustes: dos controles deslizantes. */
export function IconoAjustes({ activo }: Props) {
  return (
    <svg {...comun} strokeWidth={activo ? 2.1 : 1.6}>
      <path d="M3 7.5h10M17 7.5h2M3 14.5h4M11 14.5h8" />
      <circle cx="15" cy="7.5" r="2" />
      <circle cx="9" cy="14.5" r="2" />
    </svg>
  )
}

/** Sin conexión: una nube tachada. */
export function IconoSinConexion() {
  return (
    <svg {...comun} width={16} height={16} viewBox="0 0 22 22">
      <path d="M6.5 16h9a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 7.2 7.2" />
      <path d="M3 3l16 16" />
    </svg>
  )
}
