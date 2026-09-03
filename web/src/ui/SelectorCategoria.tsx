/**
 * Selector completo de categorías, en hoja modal.
 *
 * Es la salida para cuando la categoría buscada no está entre las
 * frecuentes. Muestra el árbol de dos niveles: la raíz se puede elegir
 * tal cual, y sus subcategorías van indentadas debajo.
 *
 * Solo lista categorías **del tipo del movimiento**. Que la interfaz ni
 * siquiera permita intentar guardar un gasto con categoría de ingreso
 * es mucho mejor que descubrirlo cuando el servidor rechaza la fila.
 */

import { raicesPorFrecuencia, hijasPorFrecuencia } from '../dominio/frecuencia.ts'
import type { Categoria, TipoCategoria, Transaccion, UUID } from '../dominio/tipos.ts'
import { Hoja } from './Hoja.tsx'
import estilos from './SelectorCategoria.module.css'

interface Props {
  abierta: boolean
  tipo: TipoCategoria
  categorias: readonly Categoria[]
  transacciones: readonly Transaccion[]
  seleccionada: UUID | null
  onElegir: (id: UUID) => void
  onCerrar: () => void
}

export function SelectorCategoria({
  abierta,
  tipo,
  categorias,
  transacciones,
  seleccionada,
  onElegir,
  onCerrar,
}: Props) {
  const raices = raicesPorFrecuencia(categorias, transacciones, tipo)

  return (
    <Hoja
      abierta={abierta}
      titulo={tipo === 'GASTO' ? 'Categoría del gasto' : 'Categoría del ingreso'}
      onCerrar={onCerrar}
    >
      <ul className={estilos.lista}>
        {raices.map((raiz) => {
          const hijas = hijasPorFrecuencia(categorias, transacciones, raiz.id)
          return (
            <li key={raiz.id}>
              <Fila
                nombre={raiz.nombre}
                seleccionada={seleccionada === raiz.id}
                onClick={() => onElegir(raiz.id)}
              />
              {hijas.map((hija) => (
                <Fila
                  key={hija.id}
                  nombre={hija.nombre}
                  hija
                  seleccionada={seleccionada === hija.id}
                  onClick={() => onElegir(hija.id)}
                />
              ))}
            </li>
          )
        })}
      </ul>
    </Hoja>
  )
}

function Fila({
  nombre,
  hija = false,
  seleccionada,
  onClick,
}: {
  nombre: string
  hija?: boolean
  seleccionada: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={[
        estilos.fila,
        hija ? estilos.hija : '',
        seleccionada ? estilos.seleccionada : '',
      ].join(' ')}
      onClick={onClick}
    >
      {nombre}
    </button>
  )
}
