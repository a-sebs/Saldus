/**
 * Una fila del libro.
 *
 * Dos líneas y dos columnas:
 *
 *   Almuerzo                              −4.50
 *   Comida rápida                      Efectivo
 *
 * La segunda línea es lo que evita la cadena de metadatos con puntos
 * medios que el brief prohíbe: en vez de `Comida · Efectivo · 14:32`,
 * hay dos columnas alineadas con el resto de la maquetación, que es
 * como se lee un libro contable. La hora se quitó porque nadie decide
 * nada con ella.
 */

import { HAY_BACKEND } from '../config.ts'
import type { Categoria, Cuenta, Transaccion } from '../dominio/tipos.ts'
import { Monto } from './Monto.tsx'
import estilos from './FilaMovimiento.module.css'

interface Props {
  transaccion: Transaccion
  cuenta: Cuenta | undefined
  cuentaDestino: Cuenta | undefined
  categoria: Categoria | undefined
  categoriaPadre: Categoria | undefined
  pendiente?: boolean
  onSeleccionar?: () => void
}

export function FilaMovimiento({
  transaccion: t,
  cuenta,
  cuentaDestino,
  categoria,
  categoriaPadre,
  pendiente = false,
  onSeleccionar,
}: Props) {
  const esTransferencia = t.tipo === 'TRANSFERENCIA'

  const concepto = esTransferencia
    ? (t.descripcion ?? 'Transferencia')
    : (t.descripcion ?? categoria?.nombre ?? 'Sin categoría')

  // La segunda línea nunca repite la primera. Si la descripción ya dice
  // lo mismo que la categoría ("Almuerzo" en la categoría "Almuerzo"),
  // se sube a la categoría padre; y si tampoco aporta, se deja vacía.
  // Repetir la misma palabra dos veces seguidas hace que la fila
  // parezca un error de la app.
  let contexto = esTransferencia
    ? 'Transferencia'
    : t.descripcion
      ? (categoria?.nombre ?? '')
      : (categoriaPadre?.nombre ?? '')

  if (contexto === concepto) contexto = categoriaPadre?.nombre ?? ''
  if (contexto === concepto) contexto = ''

  const detalleDerecha = esTransferencia
    ? `${cuenta?.nombre ?? '—'} a ${cuentaDestino?.nombre ?? '—'}`
    : (cuenta?.nombre ?? '')

  return (
    <button
      type="button"
      className={estilos.fila}
      onClick={onSeleccionar}
      aria-label={`${concepto}, ${detalleDerecha}`}
    >
      <span className={estilos.concepto}>
        {concepto}
        {HAY_BACKEND && pendiente && (
          <span className={estilos.pendiente} title="Todavía sin enviar" />
        )}
      </span>

      <Monto
        centavos={t.tipo === 'GASTO' ? -t.monto : t.monto}
        signo={esTransferencia ? 'nunca' : t.tipo === 'INGRESO' ? 'siempre' : 'auto'}
        enfasis={esTransferencia ? 'suave' : t.tipo === 'INGRESO' ? 'fuerte' : 'normal'}
      />

      <span className={estilos.contexto}>{contexto}</span>
      <span className={estilos.detalle}>{detalleDerecha}</span>
    </button>
  )
}
