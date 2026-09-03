/**
 * Registrar un gasto o un ingreso.
 *
 * Esta es la pantalla que decide si la app se sigue usando: si anotar un
 * gasto cuesta más esfuerzo que no anotarlo, la app muere. Objetivo
 * medible: **dos toques desde el ícono de la pantalla de inicio hasta el
 * gasto guardado.**
 *
 *   Toque 1 · el atajo del manifest abre `/registrar?tipo=GASTO` con el
 *             monto enfocado, la fecha en hoy, la última cuenta usada
 *             preseleccionada y la categoría más frecuente ya elegida.
 *             Se teclea el monto.
 *   Toque 2 · "Guardar gasto".
 *
 * Todo lo que no sirva a eso está fuera de la pantalla.
 *
 * Al guardar, la escritura va a IndexedDB y la confirmación es
 * inmediata. **La interfaz no espera a la red en ningún punto.**
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'

import { formatMonto, parseMonto } from '../dominio/dinero.ts'
import { ayer, fechaCorta, hoy } from '../dominio/fechas.ts'
import {
  cuentaMasUsada,
  montosFrecuentes,
  ordenarPorFrecuencia,
} from '../dominio/frecuencia.ts'
import { problemasPorCampo } from '../dominio/reglas.ts'
import type { TipoCategoria, UUID } from '../dominio/tipos.ts'

import { CLAVES, escribirMeta, leerMeta } from '../datos/repos/meta.ts'
import { guardarTransaccion } from '../datos/repos/transacciones.ts'
import { useDatos } from '../estado/datos.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useBase, useSesion } from '../estado/sesion.tsx'

import { Cabecera } from '../ui/Cabecera.tsx'
import { Chip, FilaChips } from '../ui/Chip.tsx'
import { SelectorCategoria } from '../ui/SelectorCategoria.tsx'
import estilos from './Captura.module.css'

/**
 * Seis y no más. Con ocho, las opciones ocupan tres filas y empujan el
 * resto del formulario fuera de la pantalla; el resto está a un toque en
 * "Todas".
 */
const MAX_CATEGORIAS_VISIBLES = 6

export function Captura() {
  const base = useBase()
  const { sesion } = useSesion()
  const { datos } = useDatos()
  const { mostrar } = useAviso()
  const navegar = useNavigate()
  const [params] = useSearchParams()

  const tipo: TipoCategoria = params.get('tipo') === 'INGRESO' ? 'INGRESO' : 'GASTO'
  const esGasto = tipo === 'GASTO'

  const ultimaCuenta = useLiveQuery(
    () => leerMeta<UUID>(base, CLAVES.ultimaCuenta),
    [base],
  )

  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(() => hoy())
  const [idCategoria, setIdCategoria] = useState<UUID | null>(null)
  const [idCuenta, setIdCuenta] = useState<UUID | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const campoMonto = useRef<HTMLInputElement>(null)

  const cuentas = useMemo(
    () => datos.cuentas.filter((c) => !c.archivada),
    [datos.cuentas],
  )

  const categoriasOrdenadas = useMemo(
    () => ordenarPorFrecuencia(datos.categorias, datos.transacciones, tipo),
    [datos.categorias, datos.transacciones, tipo],
  )

  const sugerencias = useMemo(
    () => montosFrecuentes(datos.transacciones, tipo),
    [datos.transacciones, tipo],
  )

  /* --- Valores por defecto -----------------------------------------
     El objetivo de los dos toques depende de que al abrir la pantalla
     ya esté todo elegido menos el monto. */
  useEffect(() => {
    if (idCuenta !== null || cuentas.length === 0) return
    // Orden de preferencia: la última usada, la más usada últimamente y,
    // en último caso, la primera. La segunda opción importa al abrir el
    // demo o justo después de importar un CSV, cuando todavía no hay
    // "última usada" y la primera por orden alfabético sería un azar.
    const masUsada = cuentaMasUsada(datos.transacciones)
    const preferida =
      cuentas.find((c) => c.id === ultimaCuenta) ??
      cuentas.find((c) => c.id === masUsada)
    setIdCuenta((preferida ?? cuentas[0])?.id ?? null)
  }, [cuentas, ultimaCuenta, idCuenta, datos.transacciones])

  useEffect(() => {
    if (idCategoria !== null || categoriasOrdenadas.length === 0) return
    setIdCategoria(categoriasOrdenadas[0]?.id ?? null)
  }, [categoriasOrdenadas, idCategoria])

  // Al cambiar de gasto a ingreso, la categoría anterior ya no vale: es
  // de otro tipo y la FK compuesta del esquema la rechazaría.
  useEffect(() => {
    setIdCategoria(null)
  }, [tipo])

  const visibles = categoriasOrdenadas.slice(0, MAX_CATEGORIAS_VISIBLES)
  const elegidaFueraDeVista =
    idCategoria !== null && !visibles.some((c) => c.id === idCategoria)
  const categoriaElegida = datos.categorias.find((c) => c.id === idCategoria)

  async function guardar() {
    const centavos = parseMonto(monto)
    if (centavos === null || centavos === 0) {
      setErrores({ monto: 'Escribe un monto.' })
      campoMonto.current?.focus()
      return
    }

    if (!idCuenta) {
      setErrores({ id_cuenta: 'Necesitas al menos una cuenta.' })
      return
    }

    setGuardando(true)
    const r = await guardarTransaccion(base, sesion!.id_usuario, {
      id_cuenta: idCuenta,
      id_categoria: idCategoria,
      tipo,
      // El signo lo determina el tipo, nunca el monto: si alguien
      // teclea "-4.50" en un gasto, sigue siendo un gasto de 4.50.
      monto: Math.abs(centavos),
      fecha,
      descripcion,
    })
    setGuardando(false)

    if (!r.ok) {
      setErrores(problemasPorCampo({ ok: false, problemas: r.problemas }))
      return
    }

    await escribirMeta(base, CLAVES.ultimaCuenta, idCuenta)
    mostrar(esGasto ? 'Gasto guardado' : 'Ingreso guardado')
    navegar('/')
  }

  if (cuentas.length === 0) {
    return (
      <>
        <Cabecera titulo="Registrar" volverA="/" />
        <div className={estilos.seccion}>
          <p className={estilos.explicacion}>
            Antes de anotar un movimiento hace falta una cuenta: el efectivo
            del bolsillo, la cuenta del banco o la tarjeta.
          </p>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => navegar('/cuentas')}
          >
            Crear una cuenta
          </button>
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
      <Cabecera titulo={esGasto ? 'Nuevo gasto' : 'Nuevo ingreso'} volverA="/" />

      {/* --- Tipo ---------------------------------------------------- */}
      <div className={estilos.seccion}>
        <div className={estilos.segmentado} role="group" aria-label="Tipo de movimiento">
          <button
            type="button"
            className={[estilos.segmento, esGasto ? estilos.segmentoActivo : ''].join(' ')}
            onClick={() => navegar('/registrar?tipo=GASTO', { replace: true })}
            aria-pressed={esGasto}
          >
            Gasto
          </button>
          <button
            type="button"
            className={[estilos.segmento, !esGasto ? estilos.segmentoActivo : ''].join(' ')}
            onClick={() => navegar('/registrar?tipo=INGRESO', { replace: true })}
            aria-pressed={!esGasto}
          >
            Ingreso
          </button>
        </div>
      </div>

      {/* --- Monto: el elemento más grande de la pantalla ------------- */}
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
            ref={campoMonto}
            className={estilos.entradaMonto}
            /* Teclado numérico directo, sin tener que escribir el
               símbolo de moneda ni buscar la tecla del punto. */
            inputMode="decimal"
            type="text"
            autoComplete="off"
            /* En Android abre el teclado solo; iOS exige un gesto del
               usuario y no hay forma de evitarlo desde la web. */
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

        {sugerencias.length > 0 && (
          <div className={estilos.sugerencias}>
            <FilaChips>
              {sugerencias.map((c) => (
                <Chip key={c} onClick={() => setMonto(formatMonto(c))} secundario>
                  {formatMonto(c)}
                </Chip>
              ))}
            </FilaChips>
          </div>
        )}
      </div>

      {/* --- Fecha: "ayer" a un toque, que es el caso normal ---------- */}
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
            <span aria-hidden="true">
              {fecha !== hoy() && fecha !== ayer() ? fechaCorta(fecha) : 'Otro día'}
            </span>
          </label>
        </FilaChips>
        {errores.fecha && <span className="error-campo">{errores.fecha}</span>}
      </div>

      {/* --- Categorías: opciones directas, nunca un desplegable ------ */}
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

      {/* --- Cuenta -------------------------------------------------- */}
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
        {errores.id_cuenta && <span className="error-campo">{errores.id_cuenta}</span>}
      </div>

      {/* --- Descripción: opcional y subordinada ---------------------- */}
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
        <button type="submit" className="boton boton--primario" disabled={guardando}>
          {esGasto ? 'Guardar gasto' : 'Guardar ingreso'}
        </button>
      </div>

      <SelectorCategoria
        abierta={selectorAbierto}
        tipo={tipo}
        categorias={datos.categorias}
        transacciones={datos.transacciones}
        seleccionada={idCategoria}
        onElegir={(id) => {
          setIdCategoria(id)
          setSelectorAbierto(false)
        }}
        onCerrar={() => setSelectorAbierto(false)}
      />
    </form>
  )
}
