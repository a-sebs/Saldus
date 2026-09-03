/**
 * Resumen del mes.
 *
 * Todo se calcula localmente sobre IndexedDB con `dominio/vistas.ts`.
 * Ninguna llamada a la red, ni siquiera cuando la haya: los números
 * salen de los mismos datos que ya están en el dispositivo.
 *
 * Alcance de la Fase 1: el total del mes y en qué se fue. Los cinco
 * gráficos del tablero —flujo de caja, variación mensual, gastos
 * hormiga y la regla 50/30/20— son de la Fase 3, después de usar la app
 * dos semanas con datos reales.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { hoy, primerDiaDelMes } from '../dominio/fechas.ts'
import { resumenMensual, totalesDelMes } from '../dominio/vistas.ts'
import { formatMontoAgrupado } from '../dominio/dinero.ts'

import { useDatos } from '../estado/datos.ts'
import { Cabecera } from '../ui/Cabecera.tsx'
import { EstadoVacio } from '../ui/EstadoVacio.tsx'
import { Monto } from '../ui/Monto.tsx'
import { SelectorMes } from '../ui/SelectorMes.tsx'
import estilos from './Resumen.module.css'

export function Resumen() {
  const { datos } = useDatos()
  const navegar = useNavigate()
  const [mes, setMes] = useState(() => primerDiaDelMes(hoy()))

  const totales = useMemo(
    () => totalesDelMes(datos.transacciones, mes),
    [datos.transacciones, mes],
  )

  const porCategoria = useMemo(() => {
    const filas = resumenMensual(datos.transacciones, datos.categorias)
    return filas.filter((f) => f.mes === primerDiaDelMes(mes) && f.tipo === 'GASTO')
  }, [datos.transacciones, datos.categorias, mes])

  const mayor = porCategoria[0]?.total ?? 0

  return (
    <>
      <Cabecera titulo="Resumen">
        <SelectorMes mes={mes} onCambiar={setMes} />
      </Cabecera>

      {totales.movimientos === 0 ? (
        <EstadoVacio
          titulo="Este mes no tiene movimientos todavía"
          accion={{
            texto: 'Registrar un gasto',
            hacer: () => navegar('/registrar?tipo=GASTO'),
          }}
        >
          En cuanto haya movimientos, aquí sale en qué se fue el mes.
        </EstadoVacio>
      ) : (
        <>
          <section className={estilos.balance}>
            <div className={estilos.lineaBalance}>
              <span className={estilos.etiqueta}>Entró</span>
              <Monto centavos={totales.ingresos} enfasis="fuerte" tamano="titulo" />
            </div>
            <div className={estilos.lineaBalance}>
              <span className={estilos.etiqueta}>Salió</span>
              <Monto centavos={-totales.gastos} tamano="titulo" />
            </div>
            <div className={[estilos.lineaBalance, estilos.lineaTotal].join(' ')}>
              <span className={estilos.etiqueta}>Queda</span>
              <Monto
                centavos={totales.balance}
                signo="siempre"
                enfasis={totales.balance >= 0 ? 'fuerte' : 'normal'}
                tamano="titulo"
                conMoneda
              />
            </div>
          </section>

          <p className={estilos.nota}>
            Las transferencias entre cuentas propias no cuentan como gasto ni
            como ingreso.
          </p>

          {porCategoria.length > 0 && (
            <section className={estilos.categorias}>
              {/* El título es la pregunta que responde, en lenguaje llano.
                  "Distribución de gastos" no es una pregunta de nadie. */}
              <h2 className={estilos.pregunta}>¿En qué se fue el mes?</h2>

              <ul>
                {porCategoria.map((f) => {
                  const parte = totales.gastos > 0 ? f.total / totales.gastos : 0
                  return (
                    <li key={f.id_categoria_raiz} className={estilos.filaCategoria}>
                      <span className={estilos.nombre}>{f.categoria_raiz}</span>
                      <Monto centavos={f.total} />
                      {/* Etiquetado directo, sin leyenda de colores: el
                          porcentaje va pegado a su barra. Redactado como
                          frase y no como cadena de metadatos separada
                          por puntos medios, que no se puede escanear. */}
                      <span className={estilos.porcentaje}>
                        {Math.round(parte * 100)}% en {f.movimientos}{' '}
                        {f.movimientos === 1 ? 'compra' : 'compras'}
                      </span>
                      <div className={estilos.pista} aria-hidden="true">
                        <div
                          className={estilos.barra}
                          style={{
                            width: `${mayor > 0 ? (f.total / mayor) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="solo-lectores">
                        {formatMontoAgrupado(f.total)} dólares en{' '}
                        {f.movimientos} movimientos
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
