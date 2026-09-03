/**
 * Transferencia entre cuentas.
 *
 * Una transferencia **no es un gasto**: mover dinero del banco al
 * efectivo no reduce lo que uno tiene, y contarlo como gasto es el error
 * que hace mentir a una app de finanzas. Por eso no pide categoría, y
 * por eso no suma al total del mes.
 *
 * En la base es **una sola fila** con cuenta de origen y de destino, no
 * dos filas enlazadas: así cada movimiento es una unidad atómica de
 * sincronización —un POST, un UUID, un reintento— y la vista
 * `v_movimientos` la parte en dos cuando hace falta sumar saldos.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { parseMonto } from '../dominio/dinero.ts'
import { ayer, hoy } from '../dominio/fechas.ts'
import { problemasPorCampo } from '../dominio/reglas.ts'
import type { UUID } from '../dominio/tipos.ts'

import { guardarTransaccion } from '../datos/repos/transacciones.ts'
import { useDatos } from '../estado/datos.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useBase, useSesion } from '../estado/sesion.tsx'

import { Cabecera } from '../ui/Cabecera.tsx'
import { Chip, FilaChips } from '../ui/Chip.tsx'
import estilos from './Captura.module.css'

export function Transferencia() {
  const base = useBase()
  const { sesion } = useSesion()
  const { datos } = useDatos()
  const { mostrar } = useAviso()
  const navegar = useNavigate()

  const cuentas = useMemo(
    () => datos.cuentas.filter((c) => !c.archivada),
    [datos.cuentas],
  )

  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(() => hoy())
  const [origen, setOrigen] = useState<UUID | null>(cuentas[0]?.id ?? null)
  const [destino, setDestino] = useState<UUID | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  async function guardar() {
    const centavos = parseMonto(monto)
    if (centavos === null || centavos === 0) {
      setErrores({ monto: 'Escribe un monto.' })
      return
    }
    if (!origen || !destino) {
      setErrores({ id_cuenta_destino: 'Elige de dónde sale y a dónde entra.' })
      return
    }

    const r = await guardarTransaccion(base, sesion!.id_usuario, {
      id_cuenta: origen,
      id_cuenta_destino: destino,
      tipo: 'TRANSFERENCIA',
      monto: Math.abs(centavos),
      fecha,
      descripcion,
    })

    if (!r.ok) {
      setErrores(problemasPorCampo({ ok: false, problemas: r.problemas }))
      return
    }

    // Los dos saldos se mueven al instante: `saldos()` los recalcula
    // desde los movimientos en cuanto Dexie avisa del cambio.
    mostrar('Transferencia guardada')
    navegar('/cuentas')
  }

  if (cuentas.length < 2) {
    return (
      <>
        <Cabecera titulo="Transferir" volverA="/cuentas" />
        <div className={estilos.seccion}>
          <p className={estilos.explicacion}>
            Para transferir hacen falta al menos dos cuentas.
          </p>
        </div>
      </>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void guardar()
      }}
    >
      <Cabecera titulo="Transferir" volverA="/cuentas" />

      <div className={estilos.zonaMonto}>
        <label className="solo-lectores" htmlFor="monto">
          Monto en dólares
        </label>
        <div className={estilos.campoMonto}>
          <span className={estilos.simbolo} aria-hidden="true">
            $
          </span>
          <input
            id="monto"
            className={estilos.entradaMonto}
            inputMode="decimal"
            type="text"
            autoComplete="off"
            autoFocus
            placeholder="0.00"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value.replace(/[^\d.,]/g, ''))
              setErrores({})
            }}
          />
        </div>
        {errores.monto && <span className="error-campo">{errores.monto}</span>}
      </div>

      <div className={estilos.seccion}>
        <span className="etiqueta-campo">Sale de</span>
        <FilaChips>
          {cuentas.map((c) => (
            <Chip
              key={c.id}
              seleccionado={origen === c.id}
              onClick={() => {
                setOrigen(c.id)
                // La misma cuenta en los dos lados es imposible por
                // CHECK; aquí ni siquiera se puede intentar.
                if (destino === c.id) setDestino(null)
              }}
            >
              {c.nombre}
            </Chip>
          ))}
        </FilaChips>
        {errores.id_cuenta && <span className="error-campo">{errores.id_cuenta}</span>}
      </div>

      <div className={estilos.seccion}>
        <span className="etiqueta-campo">Entra en</span>
        <FilaChips>
          {cuentas
            .filter((c) => c.id !== origen)
            .map((c) => (
              <Chip
                key={c.id}
                seleccionado={destino === c.id}
                onClick={() => setDestino(c.id)}
              >
                {c.nombre}
              </Chip>
            ))}
        </FilaChips>
        {errores.id_cuenta_destino && (
          <span className="error-campo">{errores.id_cuenta_destino}</span>
        )}
      </div>

      <div className={estilos.seccion}>
        <FilaChips>
          <Chip seleccionado={fecha === hoy()} onClick={() => setFecha(hoy())}>
            Hoy
          </Chip>
          <Chip seleccionado={fecha === ayer()} onClick={() => setFecha(ayer())}>
            Ayer
          </Chip>
          <label className={estilos.fechaLibre}>
            <span className="solo-lectores">Otra fecha</span>
            <input
              type="date"
              className={estilos.entradaFecha}
              value={fecha}
              max={hoy()}
              onChange={(e) => setFecha(e.target.value)}
            />
            <span aria-hidden="true">Otro día</span>
          </label>
        </FilaChips>
      </div>

      <div className={estilos.seccion}>
        <label className="etiqueta-campo" htmlFor="descripcion">
          Descripción
        </label>
        <input
          id="descripcion"
          className="campo"
          type="text"
          maxLength={255}
          placeholder="Opcional"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <div className={estilos.pie}>
        <button type="submit" className="boton boton--primario">
          Guardar transferencia
        </button>
      </div>
    </form>
  )
}
