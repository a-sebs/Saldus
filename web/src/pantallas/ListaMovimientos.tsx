/**
 * La lista rayada: filas agrupadas por día, con subtotal en la cabecera
 * de cada grupo.
 *
 * Virtualiza **solo cuando hace falta**. Con el mes corriente son ~150
 * filas y montar un virtualizador ahí cuesta más de lo que ahorra;
 * cuando se busca en todo el historial la lista puede pasar de mil y
 * entonces sí. El umbral está en 300 elementos.
 */

import { useRef } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

import { fechaRelativa } from '../dominio/fechas.ts'
import { agruparPorDia } from '../dominio/vistas.ts'
import type { Categoria, Cuenta, Transaccion } from '../dominio/tipos.ts'
import { Monto } from '../ui/Monto.tsx'
import { FilaMovimiento } from '../ui/FilaMovimiento.tsx'
import estilos from './ListaMovimientos.module.css'

const UMBRAL_VIRTUALIZAR = 300

type Elemento =
  | { clase: 'dia'; clave: string; fecha: string; subtotal: number }
  | { clase: 'movimiento'; clave: string; transaccion: Transaccion }

interface Props {
  transacciones: readonly Transaccion[]
  cuentas: Map<string, Cuenta>
  categorias: Map<string, Categoria>
  pendientes: Set<string>
  onAbrir: (id: string) => void
}

export function ListaMovimientos({
  transacciones,
  cuentas,
  categorias,
  pendientes,
  onAbrir,
}: Props) {
  const elementos: Elemento[] = []
  for (const grupo of agruparPorDia(transacciones)) {
    elementos.push({
      clase: 'dia',
      clave: `dia-${grupo.fecha}`,
      fecha: grupo.fecha,
      subtotal: grupo.subtotal,
    })
    for (const t of grupo.transacciones) {
      elementos.push({ clase: 'movimiento', clave: t.id, transaccion: t })
    }
  }

  const pintar = (e: Elemento) =>
    e.clase === 'dia' ? (
      <CabeceraDia fecha={e.fecha} subtotal={e.subtotal} />
    ) : (
      <FilaMovimiento
        transaccion={e.transaccion}
        cuenta={cuentas.get(e.transaccion.id_cuenta)}
        cuentaDestino={
          e.transaccion.id_cuenta_destino
            ? cuentas.get(e.transaccion.id_cuenta_destino)
            : undefined
        }
        categoria={
          e.transaccion.id_categoria
            ? categorias.get(e.transaccion.id_categoria)
            : undefined
        }
        categoriaPadre={padreDe(e.transaccion, categorias)}
        pendiente={pendientes.has(e.transaccion.id)}
        onSeleccionar={() => onAbrir(e.transaccion.id)}
      />
    )

  if (elementos.length <= UMBRAL_VIRTUALIZAR) {
    return (
      <div className={estilos.lista}>
        {elementos.map((e) => (
          <div key={e.clave}>{pintar(e)}</div>
        ))}
      </div>
    )
  }

  return <ListaVirtual elementos={elementos} pintar={pintar} />
}

function ListaVirtual({
  elementos,
  pintar,
}: {
  elementos: Elemento[]
  pintar: (e: Elemento) => React.ReactNode
}) {
  const contenedor = useRef<HTMLDivElement>(null)

  const virtual = useWindowVirtualizer({
    count: elementos.length,
    // Alturas aproximadas; `measureElement` corrige la real al montar.
    estimateSize: (i) => (elementos[i]?.clase === 'dia' ? 40 : 66),
    overscan: 8,
    scrollMargin: contenedor.current?.offsetTop ?? 0,
  })

  return (
    <div ref={contenedor} className={estilos.lista}>
      <div
        style={{ height: virtual.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {virtual.getVirtualItems().map((fila) => {
          const e = elementos[fila.index]
          if (!e) return null
          return (
            <div
              key={e.clave}
              data-index={fila.index}
              ref={virtual.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${
                  fila.start - virtual.options.scrollMargin
                }px)`,
              }}
            >
              {pintar(e)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CabeceraDia({ fecha, subtotal }: { fecha: string; subtotal: number }) {
  return (
    <div className={estilos.dia}>
      <span className={estilos.fecha}>{fechaRelativa(fecha)}</span>
      {subtotal !== 0 && <Monto centavos={subtotal} tamano="menor" enfasis="suave" />}
    </div>
  )
}

function padreDe(
  t: Transaccion,
  categorias: Map<string, Categoria>,
): Categoria | undefined {
  if (!t.id_categoria) return undefined
  const c = categorias.get(t.id_categoria)
  if (!c?.id_padre) return undefined
  return categorias.get(c.id_padre)
}
