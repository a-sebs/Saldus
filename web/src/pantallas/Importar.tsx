/**
 * Importar movimientos desde un CSV.
 *
 * Nada se escribe hasta que el usuario ve el recuento: cuántas filas
 * entran, cuántas se rechazan y por qué, y cuáles parecen repetidas.
 * La importación es todo o nada —media importación es peor que
 * ninguna— y las filas se validan una por una con las mismas reglas que
 * el resto de la app.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatMontoAgrupado } from '../dominio/dinero.ts'
import { fechaCorta } from '../dominio/fechas.ts'
import { leerFilas, parsearCSV, sugerirMapeo } from '../dominio/csv.ts'
import type { CampoDestino, Mapeo } from '../dominio/csv.ts'
import type { UUID } from '../dominio/tipos.ts'

import { importarTransacciones } from '../datos/repos/transacciones.ts'
import { useDatos } from '../estado/datos.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useBase, useSesion } from '../estado/sesion.tsx'

import { Cabecera } from '../ui/Cabecera.tsx'
import estilos from './Importar.module.css'

const CAMPOS: { valor: CampoDestino; texto: string }[] = [
  { valor: 'ignorar', texto: 'No importar' },
  { valor: 'fecha', texto: 'Fecha' },
  { valor: 'monto', texto: 'Monto' },
  { valor: 'descripcion', texto: 'Descripción' },
  { valor: 'categoria', texto: 'Categoría' },
  { valor: 'cuenta', texto: 'Cuenta' },
  { valor: 'tipo', texto: 'Tipo' },
]

export function Importar() {
  const base = useBase()
  const { sesion } = useSesion()
  const { datos } = useDatos()
  const { mostrar } = useAviso()
  const navegar = useNavigate()

  const [filas, setFilas] = useState<string[][] | null>(null)
  const [mapeo, setMapeo] = useState<Mapeo>({})
  const [conCabecera, setConCabecera] = useState(true)
  const [cuentaPorDefecto, setCuentaPorDefecto] = useState<UUID | null>(null)
  const [usarReserva, setUsarReserva] = useState(false)
  const [incluirDuplicados, setIncluirDuplicados] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  const cuentas = datos.cuentas.filter((c) => !c.archivada)
  const reserva = datos.categorias.find(
    (c) => c.tipo === 'GASTO' && c.nombre.toLocaleLowerCase('es').startsWith('otros'),
  )

  const lectura = useMemo(() => {
    if (!filas || !cuentaPorDefecto) return null
    return leerFilas(filas, {
      mapeo,
      conCabecera,
      cuentas: datos.cuentas,
      categorias: datos.categorias,
      cuentaPorDefecto,
      categoriaDeReserva: usarReserva ? (reserva?.id ?? null) : null,
      existentes: datos.transacciones,
    })
  }, [
    filas,
    mapeo,
    conCabecera,
    cuentaPorDefecto,
    usarReserva,
    reserva,
    datos.cuentas,
    datos.categorias,
    datos.transacciones,
  ])

  const aImportar = useMemo(
    () =>
      (lectura?.validas ?? []).filter(
        (f) => incluirDuplicados || !f.probableDuplicado,
      ),
    [lectura, incluirDuplicados],
  )

  const duplicados = (lectura?.validas ?? []).filter((f) => f.probableDuplicado).length

  async function tomarArchivo(archivo: File) {
    const texto = await archivo.text()
    const leidas = parsearCSV(texto)
    setFilas(leidas)
    setMapeo(sugerirMapeo(leidas[0] ?? []))
    setCuentaPorDefecto(cuentas[0]?.id ?? null)
  }

  async function importar() {
    if (aImportar.length === 0) return
    setTrabajando(true)

    const r = await importarTransacciones(
      base,
      sesion!.id_usuario,
      aImportar.map((f) => ({
        id_cuenta: f.id_cuenta,
        id_categoria: f.id_categoria,
        tipo: f.tipo,
        monto: f.monto,
        fecha: f.fecha,
        descripcion: f.descripcion,
      })),
    )

    setTrabajando(false)

    if (!r.ok) {
      mostrar(`Nada se importó. Falló la fila ${r.fila + 1}: ${r.mensaje}`)
      return
    }

    mostrar(`Se importaron ${r.cuantas} movimientos`)
    navegar('/')
  }

  return (
    <>
      <Cabecera titulo="Importar CSV" volverA="/ajustes" />

      {cuentas.length === 0 ? (
        <p className={estilos.explicacion}>
          Necesitas al menos una cuenta antes de importar.
        </p>
      ) : !filas ? (
        <div className={estilos.seccion}>
          <p className={estilos.explicacion}>
            Elige un archivo CSV exportado de tu banco o de otra app. Antes
            de escribir nada verás cuántas filas entran y cuáles no.
          </p>
          <label className={estilos.archivo}>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="solo-lectores"
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                if (archivo) void tomarArchivo(archivo)
              }}
            />
            <span className="boton boton--primario">Elegir archivo</span>
          </label>
        </div>
      ) : (
        <>
          {/* --- Mapeo de columnas ---------------------------------- */}
          <section className={estilos.seccion}>
            <h2 className={estilos.subtitulo}>Qué es cada columna</h2>
            <label className={estilos.interruptor}>
              <input
                type="checkbox"
                checked={conCabecera}
                onChange={(e) => setConCabecera(e.target.checked)}
              />
              <span>La primera fila son los títulos de las columnas</span>
            </label>

            <ul className={estilos.columnas}>
              {(filas[0] ?? []).map((cabecera, i) => (
                <li key={i} className={estilos.columna}>
                  <span className={estilos.muestra}>
                    {conCabecera ? cabecera : (filas[1]?.[i] ?? cabecera)}
                  </span>
                  <select
                    className="campo"
                    value={mapeo[i] ?? 'ignorar'}
                    onChange={(e) =>
                      setMapeo((m) => ({ ...m, [i]: e.target.value as CampoDestino }))
                    }
                    aria-label={`Columna ${i + 1}`}
                  >
                    {CAMPOS.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.texto}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>

          {/* --- Opciones ------------------------------------------- */}
          <section className={estilos.seccion}>
            <h2 className={estilos.subtitulo}>A dónde van</h2>
            <label className="etiqueta-campo" htmlFor="cuenta-defecto">
              Cuenta para las filas sin cuenta reconocida
            </label>
            <select
              id="cuenta-defecto"
              className="campo"
              value={cuentaPorDefecto ?? ''}
              onChange={(e) => setCuentaPorDefecto(e.target.value)}
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            {reserva && (
              <label className={estilos.interruptor}>
                <input
                  type="checkbox"
                  checked={usarReserva}
                  onChange={(e) => setUsarReserva(e.target.checked)}
                />
                <span>
                  Mandar a «{reserva.nombre}» las filas con categoría
                  desconocida, en vez de rechazarlas
                </span>
              </label>
            )}
          </section>

          {/* --- Vista previa --------------------------------------- */}
          {lectura && (
            <section className={estilos.seccion}>
              <h2 className={estilos.subtitulo}>Qué va a pasar</h2>

              <ul className={estilos.recuento}>
                <li>
                  <span>Entran</span>
                  <strong className="cifra">{aImportar.length}</strong>
                </li>
                <li>
                  <span>Se rechazan</span>
                  <strong className="cifra">{lectura.rechazadas.length}</strong>
                </li>
                <li>
                  <span>Parecen repetidas</span>
                  <strong className="cifra">{duplicados}</strong>
                </li>
              </ul>

              {duplicados > 0 && (
                <label className={estilos.interruptor}>
                  <input
                    type="checkbox"
                    checked={incluirDuplicados}
                    onChange={(e) => setIncluirDuplicados(e.target.checked)}
                  />
                  <span>
                    Importar también las repetidas. Dos almuerzos iguales el
                    mismo día son normales, así que decides tú.
                  </span>
                </label>
              )}

              {lectura.rechazadas.length > 0 && (
                <div className={estilos.rechazadas}>
                  <p className={estilos.explicacion}>Filas que no entran:</p>
                  <ul>
                    {lectura.rechazadas.slice(0, 20).map((r) => (
                      <li key={r.linea} className={estilos.rechazada}>
                        <span className={estilos.linea}>Fila {r.linea}</span>
                        <span className={estilos.motivo}>{r.motivo}</span>
                        <span className={estilos.contenido}>{r.contenido}</span>
                      </li>
                    ))}
                  </ul>
                  {lectura.rechazadas.length > 20 && (
                    <p className={estilos.explicacion}>
                      y {lectura.rechazadas.length - 20} más.
                    </p>
                  )}
                </div>
              )}

              {aImportar.length > 0 && (
                <div className={estilos.muestraFilas}>
                  <p className={estilos.explicacion}>Las primeras que entran:</p>
                  <ul>
                    {aImportar.slice(0, 5).map((f) => (
                      <li key={f.linea} className={estilos.previa}>
                        <span>{fechaCorta(f.fecha)}</span>
                        <span className={estilos.previaTexto}>
                          {f.descripcion ?? '—'}
                        </span>
                        <span className="cifra">
                          {f.tipo === 'GASTO' ? '−' : '+'}
                          {formatMontoAgrupado(f.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <div className={estilos.acciones}>
            <button
              type="button"
              className="boton boton--primario"
              disabled={aImportar.length === 0 || trabajando}
              onClick={() => void importar()}
            >
              {trabajando
                ? 'Importando…'
                : `Importar ${aImportar.length} movimientos`}
            </button>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => setFilas(null)}
            >
              Elegir otro archivo
            </button>
          </div>
        </>
      )}
    </>
  )
}
