/**
 * Detalle y edición de un movimiento.
 *
 * Borrar es **suave y con deshacer**: la fila se queda con
 * `eliminado_en` puesto, así que deshacer es quitarlo. Esa es la razón
 * de que no haga falta un diálogo de confirmación con dos botones
 * delante de cada borrado.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'

import { formatMonto, parseMonto } from '../dominio/dinero.ts'
import { fechaLarga, hoy } from '../dominio/fechas.ts'
import { ordenarPorFrecuencia } from '../dominio/frecuencia.ts'
import { problemasPorCampo } from '../dominio/reglas.ts'
import type { TipoCategoria, UUID } from '../dominio/tipos.ts'

import {
  borrarTransaccion,
  guardarTransaccion,
  restaurarTransaccion,
} from '../datos/repos/transacciones.ts'
import { etiquetasDe, guardarEtiqueta } from '../datos/repos/etiquetas.ts'
import { useDatos } from '../estado/datos.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useBase, useSesion } from '../estado/sesion.tsx'

import { Cabecera } from '../ui/Cabecera.tsx'
import { Chip, FilaChips } from '../ui/Chip.tsx'
import { Monto } from '../ui/Monto.tsx'
import { SelectorCategoria } from '../ui/SelectorCategoria.tsx'
import estilos from './Detalle.module.css'

const MAX_CATEGORIAS_VISIBLES = 6

export function Detalle() {
  const { id } = useParams<{ id: string }>()
  const base = useBase()
  const { sesion } = useSesion()
  const { datos, cargando } = useDatos()
  const { mostrar } = useAviso()
  const navegar = useNavigate()

  const transaccion = datos.transacciones.find((t) => t.id === id)

  const etiquetasActuales = useLiveQuery(
    () => (id ? etiquetasDe(base, id) : Promise.resolve([])),
    [base, id],
  )

  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [idCategoria, setIdCategoria] = useState<UUID | null>(null)
  const [idCuenta, setIdCuenta] = useState<UUID | null>(null)
  const [idCuentaDestino, setIdCuentaDestino] = useState<UUID | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [etiquetas, setEtiquetas] = useState<UUID[]>([])
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [listo, setListo] = useState(false)

  // Se copia la fila al estado del formulario una sola vez: si se
  // sincronizara en cada render, escribir un monto sería imposible.
  useEffect(() => {
    if (!transaccion || listo) return
    setMonto(formatMonto(transaccion.monto))
    setFecha(transaccion.fecha)
    setIdCategoria(transaccion.id_categoria)
    setIdCuenta(transaccion.id_cuenta)
    setIdCuentaDestino(transaccion.id_cuenta_destino)
    setDescripcion(transaccion.descripcion ?? '')
    setListo(true)
  }, [transaccion, listo])

  useEffect(() => {
    if (etiquetasActuales) setEtiquetas(etiquetasActuales)
  }, [etiquetasActuales])

  const cuentas = useMemo(
    () => datos.cuentas.filter((c) => !c.archivada || c.id === idCuenta),
    [datos.cuentas, idCuenta],
  )

  const tipoCategoria: TipoCategoria =
    transaccion?.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO'

  const categoriasOrdenadas = useMemo(
    () => ordenarPorFrecuencia(datos.categorias, datos.transacciones, tipoCategoria),
    [datos.categorias, datos.transacciones, tipoCategoria],
  )

  if (cargando) return null

  if (!transaccion) {
    return (
      <>
        <Cabecera titulo="Movimiento" volverA="/" />
        <p className={estilos.aviso}>
          Este movimiento ya no existe. Puede que lo hayas borrado.
        </p>
      </>
    )
  }

  const esTransferencia = transaccion.tipo === 'TRANSFERENCIA'
  const visibles = categoriasOrdenadas.slice(0, MAX_CATEGORIAS_VISIBLES)
  const elegidaFueraDeVista =
    idCategoria !== null && !visibles.some((c) => c.id === idCategoria)
  const categoriaElegida = datos.categorias.find((c) => c.id === idCategoria)

  async function guardar() {
    if (!transaccion) return
    const centavos = parseMonto(monto)
    if (centavos === null || centavos === 0) {
      setErrores({ monto: 'Escribe un monto.' })
      return
    }

    const r = await guardarTransaccion(base, sesion!.id_usuario, {
      id: transaccion.id,
      id_cuenta: idCuenta ?? transaccion.id_cuenta,
      id_cuenta_destino: idCuentaDestino,
      id_categoria: idCategoria,
      tipo: transaccion.tipo,
      monto: Math.abs(centavos),
      fecha,
      descripcion,
      etiquetas,
    })

    if (!r.ok) {
      setErrores(problemasPorCampo({ ok: false, problemas: r.problemas }))
      return
    }

    mostrar('Cambios guardados')
    navegar('/')
  }

  async function borrar() {
    if (!transaccion) return
    const idBorrado = transaccion.id
    await borrarTransaccion(base, idBorrado)
    navegar('/')
    mostrar('Movimiento borrado', {
      texto: 'Deshacer',
      hacer: () => restaurarTransaccion(base, idBorrado),
    })
  }

  async function agregarEtiqueta() {
    const nombre = nuevaEtiqueta.trim()
    if (nombre === '') return

    const existente = datos.etiquetas.find(
      (e) => e.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'),
    )
    if (existente) {
      setEtiquetas((prev) => (prev.includes(existente.id) ? prev : [...prev, existente.id]))
      setNuevaEtiqueta('')
      return
    }

    const r = await guardarEtiqueta(base, sesion!.id_usuario, { nombre })
    if (r.ok) {
      setEtiquetas((prev) => [...prev, r.id])
      setNuevaEtiqueta('')
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void guardar()
      }}
    >
      <Cabecera titulo="Movimiento" volverA="/" />

      <div className={estilos.cabeceraMonto}>
        <Monto
          centavos={transaccion.tipo === 'GASTO' ? -transaccion.monto : transaccion.monto}
          signo={esTransferencia ? 'nunca' : transaccion.tipo === 'INGRESO' ? 'siempre' : 'auto'}
          enfasis={esTransferencia ? 'suave' : transaccion.tipo === 'INGRESO' ? 'fuerte' : 'normal'}
          tamano="gigante"
        />
        <span className={estilos.fechaLarga}>{fechaLarga(transaccion.fecha)}</span>
      </div>

      <div className={estilos.seccion}>
        <label className="etiqueta-campo" htmlFor="monto">
          Monto
        </label>
        <input
          id="monto"
          className={['campo', errores.monto ? 'campo--invalido' : ''].join(' ')}
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value.replace(/[^\d.,]/g, ''))
            setErrores({})
          }}
        />
        {errores.monto && <span className="error-campo">{errores.monto}</span>}
      </div>

      <div className={estilos.seccion}>
        <label className="etiqueta-campo" htmlFor="fecha">
          Fecha
        </label>
        <input
          id="fecha"
          className="campo"
          type="date"
          value={fecha}
          max={hoy()}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {esTransferencia ? (
        <>
          <div className={estilos.seccion}>
            <span className="etiqueta-campo">Sale de</span>
            <FilaChips>
              {cuentas.map((c) => (
                <Chip
                  key={c.id}
                  seleccionado={idCuenta === c.id}
                  onClick={() => setIdCuenta(c.id)}
                >
                  {c.nombre}
                </Chip>
              ))}
            </FilaChips>
          </div>
          <div className={estilos.seccion}>
            <span className="etiqueta-campo">Entra en</span>
            <FilaChips>
              {cuentas
                .filter((c) => c.id !== idCuenta)
                .map((c) => (
                  <Chip
                    key={c.id}
                    seleccionado={idCuentaDestino === c.id}
                    onClick={() => setIdCuentaDestino(c.id)}
                  >
                    {c.nombre}
                  </Chip>
                ))}
            </FilaChips>
            {errores.id_cuenta_destino && (
              <span className="error-campo">{errores.id_cuenta_destino}</span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className={estilos.seccion}>
            <span className="etiqueta-campo">Categoría</span>
            <FilaChips>
              {visibles.map((c) => (
                <Chip
                  key={c.id}
                  seleccionado={idCategoria === c.id}
                  onClick={() => setIdCategoria(c.id)}
                >
                  {c.nombre}
                </Chip>
              ))}
              {elegidaFueraDeVista && categoriaElegida && (
                <Chip seleccionado onClick={() => setSelectorAbierto(true)}>
                  {categoriaElegida.nombre}
                </Chip>
              )}
              <Chip secundario onClick={() => setSelectorAbierto(true)}>
                Todas
              </Chip>
            </FilaChips>
            {errores.id_categoria && (
              <span className="error-campo">{errores.id_categoria}</span>
            )}
          </div>

          <div className={estilos.seccion}>
            <span className="etiqueta-campo">Cuenta</span>
            <FilaChips>
              {cuentas.map((c) => (
                <Chip
                  key={c.id}
                  seleccionado={idCuenta === c.id}
                  onClick={() => setIdCuenta(c.id)}
                >
                  {c.nombre}
                </Chip>
              ))}
            </FilaChips>
          </div>
        </>
      )}

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

      <div className={estilos.seccion}>
        <span className="etiqueta-campo">Etiquetas</span>
        <FilaChips>
          {datos.etiquetas.map((e) => (
            <Chip
              key={e.id}
              seleccionado={etiquetas.includes(e.id)}
              onClick={() =>
                setEtiquetas((prev) =>
                  prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id],
                )
              }
            >
              {e.nombre}
            </Chip>
          ))}
        </FilaChips>
        <div className={estilos.nuevaEtiqueta}>
          <input
            className="campo"
            type="text"
            maxLength={50}
            placeholder="Nueva etiqueta"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void agregarEtiqueta()
              }
            }}
          />
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => void agregarEtiqueta()}
          >
            Añadir
          </button>
        </div>
      </div>

      <div className={estilos.pie}>
        <button type="submit" className="boton boton--primario">
          Guardar cambios
        </button>
        <button
          type="button"
          className="boton boton--peligro"
          onClick={() => void borrar()}
        >
          Borrar movimiento
        </button>
      </div>

      <SelectorCategoria
        abierta={selectorAbierto}
        tipo={tipoCategoria}
        categorias={datos.categorias}
        transacciones={datos.transacciones}
        seleccionada={idCategoria}
        onElegir={(idElegida) => {
          setIdCategoria(idElegida)
          setSelectorAbierto(false)
        }}
        onCerrar={() => setSelectorAbierto(false)}
      />
    </form>
  )
}
