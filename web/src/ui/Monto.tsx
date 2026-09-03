/**
 * La columna de dinero.
 *
 * El signo va en su propia celda de ancho fijo para que una
 * transferencia (sin signo) alinee exactamente con un gasto (con
 * signo). Sin eso la columna se descuadra un carácter y toda la lista
 * se lee mal, que es el defecto más común de las listas de montos.
 *
 * Ingreso y gasto se distinguen por **signo y peso tipográfico**, nunca
 * por verde y rojo: así funcionan igual para quien no distingue esos
 * dos colores, y dejan libre el color para transportar significado de
 * verdad.
 */

import { partirParaColumna } from '../dominio/dinero.ts'
import type { Centavos } from '../dominio/tipos.ts'
import estilos from './Monto.module.css'

interface Props {
  centavos: Centavos
  /** `siempre` marca el ingreso con `+`; `nunca` es para transferencias. */
  signo?: 'auto' | 'siempre' | 'nunca'
  /** `fuerte` es el ingreso; `suave` es la transferencia. */
  enfasis?: 'normal' | 'suave' | 'fuerte'
  tamano?: 'menor' | 'cuerpo' | 'titulo' | 'gigante'
  /** Antepone el símbolo. Solo en los totales de cabecera. */
  conMoneda?: boolean
}

export function Monto({
  centavos,
  signo = 'auto',
  enfasis = 'normal',
  tamano = 'cuerpo',
  conMoneda = false,
}: Props) {
  const partes = partirParaColumna(centavos, signo)

  return (
    <span
      className={[
        'cifra',
        estilos.monto,
        estilos[tamano],
        estilos[enfasis],
      ].join(' ')}
    >
      {/* El signo va primero y la moneda después ("−$4.50"). Al revés,
          la celda vacía del signo abriría un hueco visible entre el
          símbolo y la cifra en los totales positivos. */}
      <span className={estilos.signo} aria-hidden={partes.signo === ''}>
        {partes.signo}
      </span>
      {conMoneda && <span className={estilos.moneda}>$</span>}
      {partes.cifra}
    </span>
  )
}
