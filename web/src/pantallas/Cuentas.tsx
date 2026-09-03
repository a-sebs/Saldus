/**
 * Cuentas y saldos.
 *
 * El saldo de cada cuenta se **recalcula** desde los movimientos con
 * `vistas.saldos()`, nunca sale de un campo guardado. Por eso el
 * esquema no tiene `saldo_actual`: un saldo almacenado se desincroniza
 * el día que alguien edita un movimiento viejo y nadie se entera.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatMonto, parseMonto } from '../dominio/dinero.ts'
import { problemasPorCampo } from '../dominio/reglas.ts'
import { esDeuda, saldoTotal, saldos } from '../dominio/vistas.ts'
import { TIPOS_CUENTA } from '../dominio/tipos.ts'
import type { Cuenta, TipoCuenta, UUID } from '../dominio/tipos.ts'

import { archivarCuenta, guardarCuenta } from '../datos/repos/cuentas.ts'
import { useDatos } from '../estado/datos.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useBase, useSesion } from '../estado/sesion.tsx'

import { Cabecera } from '../ui/Cabecera.tsx'
import { Chip, FilaChips } from '../ui/Chip.tsx'
import { EstadoVacio } from '../ui/EstadoVacio.tsx'
import { Hoja } from '../ui/Hoja.tsx'
import { Monto } from '../ui/Monto.tsx'
import estilos from './Cuentas.module.css'

const NOMBRE_TIPO: Record<TipoCuenta, string> = {
  DEBITO: 'Cuenta bancaria',
  CREDITO: 'Tarjeta de crédito',
  EFECTIVO: 'Efectivo',
}

export function Cuentas() {
  const base = useBase()
  const { sesion } = useSesion()
  const { datos } = useDatos()
  const { mostrar } = useAviso()
  const navegar = useNavigate()

  const [editando, setEditando] = useState<Cuenta | 'nueva' | null>(null)

  const lista = useMemo(
    () => saldos(datos.cuentas, datos.transacciones),
    [datos.cuentas, datos.transacciones],
  )
  const total = useMemo(() => saldoTotal(lista), [lista])

  const activas = datos.cuentas.filter((c) => !c.archivada)
  const archivadas = datos.cuentas.filter((c) => c.archivada)

  const saldoDe = (id: UUID) => lista.find((s) => s.id_cuenta === id)

  return (
    <>
      <Cabecera titulo="Cuentas">
        {/* Etiqueta a la izquierda y cifra a la derecha, en la misma
            línea y en la misma columna de dinero que las filas de abajo:
            es la línea de total de un libro. */}
        <div className={estilos.total}>
          <span className={estilos.etiquetaTotal}>Saldo total en USD</span>
          <Monto centavos={total} tamano="titulo" conMoneda />
        </div>
      </Cabecera>

      {datos.cuentas.length === 0 ? (
        <EstadoVacio
          titulo="Crea tu primera cuenta"
          accion={{ texto: 'Nueva cuenta', hacer: () => setEditando('nueva') }}
        >
          Una cuenta es de dónde sale o entra el dinero: el efectivo del
          bolsillo, la cuenta del banco, la tarjeta.
        </EstadoVacio>
      ) : (
        <>
          <ul className={estilos.lista}>
            {activas.map((c) => {
              const s = saldoDe(c.id)
              const deuda = s ? esDeuda(s) : false
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={estilos.fila}
                    onClick={() => setEditando(c)}
                  >
                    <span className={estilos.nombre}>{c.nombre}</span>
                    <Monto
                      centavos={deuda ? Math.abs(s?.saldo_actual ?? 0) : (s?.saldo_actual ?? 0)}
                      signo={deuda ? 'nunca' : 'auto'}
                      enfasis={deuda ? 'suave' : 'normal'}
                    />
                    {/* Sin repetir: una cuenta llamada "Efectivo" de
                        tipo Efectivo no necesita la segunda línea. */}
                    <span className={estilos.tipo}>
                      {NOMBRE_TIPO[c.tipo] === c.nombre ? '' : NOMBRE_TIPO[c.tipo]}
                    </span>
                    {/* Una tarjeta en negativo no es "tienes −240.50",
                        es "debes 240.50". El signo crudo es correcto para
                        sumar y confuso para leer. */}
                    <span className={estilos.detalle}>{deuda ? 'debes' : ''}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {archivadas.length > 0 && (
            <>
              <p className={estilos.subtitulo}>Archivadas</p>
              <ul className={estilos.lista}>
                {archivadas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={[estilos.fila, estilos.filaArchivada].join(' ')}
                      onClick={() => setEditando(c)}
                    >
                      <span className={estilos.nombre}>{c.nombre}</span>
                      <Monto
                        centavos={saldoDe(c.id)?.saldo_actual ?? 0}
                        enfasis="suave"
                      />
                      {/* Sin repetir: una cuenta llamada "Efectivo" de
                        tipo Efectivo no necesita la segunda línea. */}
                    <span className={estilos.tipo}>
                      {NOMBRE_TIPO[c.tipo] === c.nombre ? '' : NOMBRE_TIPO[c.tipo]}
                    </span>
                      <span className={estilos.detalle}>archivada</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className={estilos.acciones}>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setEditando('nueva')}
            >
              Nueva cuenta
            </button>
            {activas.length >= 2 && (
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => navegar('/transferir')}
              >
                Transferir
              </button>
            )}
          </div>
        </>
      )}

      <HojaCuenta
        cuenta={editando}
        onCerrar={() => setEditando(null)}
        onGuardar={async (valores) => {
          const r = await guardarCuenta(base, sesion!.id_usuario, valores)
          if (r.ok) {
            setEditando(null)
            mostrar('Cuenta guardada')
          }
          return r
        }}
        onArchivar={async (id, archivada) => {
          await archivarCuenta(base, id, archivada)
          setEditando(null)
          mostrar(archivada ? 'Cuenta archivada' : 'Cuenta reactivada')
        }}
      />
    </>
  )
}

/* =====================================================================
   Alta y edición
   ===================================================================== */

interface ValoresCuenta {
  id?: UUID
  nombre: string
  tipo: TipoCuenta
  saldo_inicial: number
}

function HojaCuenta({
  cuenta,
  onCerrar,
  onGuardar,
  onArchivar,
}: {
  cuenta: Cuenta | 'nueva' | null
  onCerrar: () => void
  onGuardar: (
    v: ValoresCuenta,
  ) => Promise<{ ok: true; id: UUID } | { ok: false; problemas: { campo: string; mensaje: string }[] }>
  onArchivar: (id: UUID, archivada: boolean) => Promise<void>
}) {
  const esNueva = cuenta === 'nueva'
  const existente = cuenta === 'nueva' || cuenta === null ? null : cuenta

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCuenta>('EFECTIVO')
  const [saldo, setSaldo] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [clave, setClave] = useState('')

  // Al abrir la hoja para otra cuenta se recarga el formulario. Se
  // compara por id para no pisar lo que el usuario está escribiendo.
  const claveActual = existente?.id ?? (esNueva ? 'nueva' : '')
  if (cuenta !== null && claveActual !== clave) {
    setClave(claveActual)
    setNombre(existente?.nombre ?? '')
    setTipo(existente?.tipo ?? 'EFECTIVO')
    setSaldo(existente ? formatMonto(existente.saldo_inicial) : '')
    setErrores({})
  }

  async function enviar() {
    const centavos = saldo.trim() === '' ? 0 : parseMonto(saldo)
    if (centavos === null) {
      setErrores({ saldo_inicial: 'Ese saldo no es un monto válido.' })
      return
    }

    const r = await onGuardar({
      ...(existente ? { id: existente.id } : {}),
      nombre,
      tipo,
      saldo_inicial: centavos,
    })
    if (!r.ok) setErrores(problemasPorCampo({ ok: false, problemas: r.problemas }))
  }

  return (
    <Hoja
      abierta={cuenta !== null}
      titulo={esNueva ? 'Nueva cuenta' : 'Editar cuenta'}
      onCerrar={onCerrar}
    >
      <div className={estilos.campoHoja}>
        <label className="etiqueta-campo" htmlFor="nombre-cuenta">
          Nombre
        </label>
        <input
          id="nombre-cuenta"
          className={['campo', errores.nombre ? 'campo--invalido' : ''].join(' ')}
          type="text"
          maxLength={50}
          placeholder="Efectivo, Banco Pichincha, Visa…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        {errores.nombre && <span className="error-campo">{errores.nombre}</span>}
      </div>

      <div className={estilos.campoHoja}>
        <span className="etiqueta-campo">Tipo</span>
        <FilaChips>
          {TIPOS_CUENTA.map((t) => (
            <Chip key={t} seleccionado={tipo === t} onClick={() => setTipo(t)}>
              {NOMBRE_TIPO[t]}
            </Chip>
          ))}
        </FilaChips>
      </div>

      <div className={estilos.campoHoja}>
        <label className="etiqueta-campo" htmlFor="saldo-cuenta">
          Saldo inicial
        </label>
        <input
          id="saldo-cuenta"
          className={['campo', errores.saldo_inicial ? 'campo--invalido' : ''].join(' ')}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value.replace(/[^\d.,-]/g, ''))}
        />
        <span className={estilos.ayuda}>
          Lo que hay en la cuenta hoy. A partir de ahí el saldo lo calculan
          los movimientos.
        </span>
        {errores.saldo_inicial && (
          <span className="error-campo">{errores.saldo_inicial}</span>
        )}
      </div>

      <div className={estilos.accionesHoja}>
        <button type="button" className="boton boton--primario" onClick={() => void enviar()}>
          Guardar
        </button>
        {existente && (
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => void onArchivar(existente.id, !existente.archivada)}
          >
            {existente.archivada ? 'Reactivar cuenta' : 'Archivar cuenta'}
          </button>
        )}
        {existente && !existente.archivada && (
          <p className={estilos.ayuda}>
            Archivar la saca de los selectores y conserva todo su historial.
          </p>
        )}
      </div>
    </Hoja>
  )
}
