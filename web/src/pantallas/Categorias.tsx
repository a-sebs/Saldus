/**
 * Categorías y etiquetas.
 *
 * Árbol de **dos niveles**. Una subcategoría hereda obligatoriamente el
 * tipo de su padre, y aquí la interfaz ni siquiera deja intentar lo
 * contrario: al elegir padre solo aparecen los del mismo tipo. La FK
 * compuesta `(id_padre, tipo)` del esquema lo impediría igual, pero
 * fallar en la pantalla —donde el usuario puede corregirlo— es mucho
 * mejor que fallar al sincronizar.
 */

import { useEffect, useMemo, useState } from 'react'

import type { Categoria, TipoCategoria, UUID } from '../dominio/tipos.ts'
import { problemasPorCampo } from '../dominio/reglas.ts'

import {
  archivarCategoria,
  guardarCategoria,
  usoDeCategoria,
} from '../datos/repos/categorias.ts'
import { borrarEtiqueta, etiquetasConUso, guardarEtiqueta } from '../datos/repos/etiquetas.ts'
import { useDatos } from '../estado/datos.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useBase, useSesion } from '../estado/sesion.tsx'
import { useLiveQuery } from 'dexie-react-hooks'

import { Cabecera } from '../ui/Cabecera.tsx'
import { Chip, FilaChips } from '../ui/Chip.tsx'
import { Hoja } from '../ui/Hoja.tsx'
import estilos from './Categorias.module.css'

export function Categorias() {
  const base = useBase()
  const { sesion } = useSesion()
  const { datos } = useDatos()
  const { mostrar } = useAviso()

  const [tipo, setTipo] = useState<TipoCategoria>('GASTO')
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')

  const etiquetas = useLiveQuery(() => etiquetasConUso(base), [base]) ?? []

  const arbol = useMemo(() => {
    const delTipo = datos.categorias.filter((c) => c.tipo === tipo)
    const porNombre = (a: Categoria, b: Categoria) =>
      a.nombre.localeCompare(b.nombre, 'es')
    return delTipo
      .filter((c) => c.id_padre === null)
      .sort(porNombre)
      .map((raiz) => ({
        raiz,
        hijas: delTipo.filter((c) => c.id_padre === raiz.id).sort(porNombre),
      }))
  }, [datos.categorias, tipo])

  const usos = useMemo(() => {
    const conteo = new Map<UUID, number>()
    for (const t of datos.transacciones) {
      if (!t.id_categoria) continue
      conteo.set(t.id_categoria, (conteo.get(t.id_categoria) ?? 0) + 1)
    }
    return conteo
  }, [datos.transacciones])

  async function crearEtiqueta() {
    const nombre = nuevaEtiqueta.trim()
    if (nombre === '') return
    const r = await guardarEtiqueta(base, sesion!.id_usuario, { nombre })
    if (r.ok) {
      setNuevaEtiqueta('')
      mostrar('Etiqueta creada')
    } else {
      mostrar(r.problemas[0]?.mensaje ?? 'No se pudo crear.')
    }
  }

  return (
    <>
      <Cabecera titulo="Categorías" volverA="/ajustes" />

      <div className={estilos.seccion}>
        <FilaChips>
          <Chip seleccionado={tipo === 'GASTO'} onClick={() => setTipo('GASTO')}>
            Gastos
          </Chip>
          <Chip seleccionado={tipo === 'INGRESO'} onClick={() => setTipo('INGRESO')}>
            Ingresos
          </Chip>
        </FilaChips>
      </div>

      <ul className={estilos.arbol}>
        {arbol.map(({ raiz, hijas }) => (
          <li key={raiz.id}>
            <button
              type="button"
              className={estilos.fila}
              onClick={() => setEditando(raiz)}
            >
              <span className={estilos.nombre}>{raiz.nombre}</span>
              <span className={estilos.conteo}>{usos.get(raiz.id) ?? 0}</span>
            </button>
            {hijas.map((hija) => (
              <button
                key={hija.id}
                type="button"
                className={[estilos.fila, estilos.filaHija].join(' ')}
                onClick={() => setEditando(hija)}
              >
                <span className={estilos.nombre}>{hija.nombre}</span>
                <span className={estilos.conteo}>{usos.get(hija.id) ?? 0}</span>
              </button>
            ))}
          </li>
        ))}
      </ul>

      <div className={estilos.acciones}>
        <button
          type="button"
          className="boton boton--secundario"
          onClick={() => setEditando('nueva')}
        >
          Nueva categoría
        </button>
      </div>

      {/* --- Etiquetas: lista plana, sin jerarquía ------------------- */}
      <h2 className={estilos.subtitulo}>Etiquetas</h2>
      <p className={estilos.explicacion}>
        Sirven para agrupar movimientos por encima de las categorías, como
        un viaje o una mudanza.
      </p>

      {etiquetas.length > 0 && (
        <ul className={estilos.arbol}>
          {etiquetas.map((e) => (
            <li key={e.id} className={estilos.filaEtiqueta}>
              <span className={estilos.nombre}>{e.nombre}</span>
              <span className={estilos.conteo}>{e.usos}</span>
              <button
                type="button"
                className="boton boton--peligro"
                onClick={() => {
                  void borrarEtiqueta(base, e.id)
                  mostrar('Etiqueta borrada')
                }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

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
              void crearEtiqueta()
            }
          }}
        />
        <button
          type="button"
          className="boton boton--secundario"
          onClick={() => void crearEtiqueta()}
        >
          Añadir
        </button>
      </div>

      <HojaCategoria
        categoria={editando}
        tipo={tipo}
        categorias={datos.categorias}
        onCerrar={() => setEditando(null)}
        onGuardar={async (valores) => {
          const r = await guardarCategoria(base, sesion!.id_usuario, valores)
          if (r.ok) {
            setEditando(null)
            mostrar('Categoría guardada')
          }
          return r
        }}
        onArchivar={async (idCategoria) => {
          await archivarCategoria(base, idCategoria)
          setEditando(null)
          mostrar('Categoría archivada')
        }}
        contarUso={(idCategoria) => usoDeCategoria(base, idCategoria)}
      />
    </>
  )
}

/* =====================================================================
   Alta y edición
   ===================================================================== */

interface ValoresCategoria {
  id?: UUID
  nombre: string
  tipo: TipoCategoria
  id_padre: UUID | null
}

function HojaCategoria({
  categoria,
  tipo,
  categorias,
  onCerrar,
  onGuardar,
  onArchivar,
  contarUso,
}: {
  categoria: Categoria | 'nueva' | null
  tipo: TipoCategoria
  categorias: readonly Categoria[]
  onCerrar: () => void
  onGuardar: (
    v: ValoresCategoria,
  ) => Promise<
    { ok: true; id: UUID } | { ok: false; problemas: { campo: string; mensaje: string }[] }
  >
  onArchivar: (id: UUID) => Promise<void>
  contarUso: (id: UUID) => Promise<{ movimientos: number; hijas: number; movimientosDeHijas: number }>
}) {
  const esNueva = categoria === 'nueva'
  const existente = categoria === 'nueva' || categoria === null ? null : categoria

  const [nombre, setNombre] = useState('')
  const [idPadre, setIdPadre] = useState<UUID | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [clave, setClave] = useState('')
  const [uso, setUso] = useState<{
    movimientos: number
    hijas: number
    movimientosDeHijas: number
  } | null>(null)
  const [confirmandoArchivo, setConfirmandoArchivo] = useState(false)

  const claveActual = existente?.id ?? (esNueva ? 'nueva' : '')
  if (categoria !== null && claveActual !== clave) {
    setClave(claveActual)
    setNombre(existente?.nombre ?? '')
    setIdPadre(existente?.id_padre ?? null)
    setErrores({})
    setConfirmandoArchivo(false)
    setUso(null)
  }

  useEffect(() => {
    if (!existente) return
    let vigente = true
    void contarUso(existente.id).then((u) => {
      if (vigente) setUso(u)
    })
    return () => {
      vigente = false
    }
  }, [existente, contarUso])

  const tipoEfectivo = existente?.tipo ?? tipo

  // Solo pueden ser padre las raíces **del mismo tipo**: el árbol es de
  // dos niveles y el tipo se hereda.
  const posiblesPadres = categorias.filter(
    (c) =>
      c.tipo === tipoEfectivo &&
      c.id_padre === null &&
      c.id !== existente?.id,
  )

  const tieneHijas = categorias.some((c) => c.id_padre === existente?.id)

  async function enviar() {
    const r = await onGuardar({
      ...(existente ? { id: existente.id } : {}),
      nombre,
      tipo: tipoEfectivo,
      id_padre: idPadre,
    })
    if (!r.ok) setErrores(problemasPorCampo({ ok: false, problemas: r.problemas }))
  }

  return (
    <Hoja
      abierta={categoria !== null}
      titulo={esNueva ? 'Nueva categoría' : 'Editar categoría'}
      onCerrar={onCerrar}
    >
      <div className={estilos.campoHoja}>
        <label className="etiqueta-campo" htmlFor="nombre-categoria">
          Nombre
        </label>
        <input
          id="nombre-categoria"
          className={['campo', errores.nombre ? 'campo--invalido' : ''].join(' ')}
          type="text"
          maxLength={50}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        {errores.nombre && <span className="error-campo">{errores.nombre}</span>}
      </div>

      <div className={estilos.campoHoja}>
        <span className="etiqueta-campo">
          {tipoEfectivo === 'GASTO' ? 'Categoría de gasto dentro de' : 'Categoría de ingreso dentro de'}
        </span>
        <FilaChips>
          <Chip seleccionado={idPadre === null} onClick={() => setIdPadre(null)}>
            Ninguna, es principal
          </Chip>
          {!tieneHijas &&
            posiblesPadres.map((p) => (
              <Chip
                key={p.id}
                seleccionado={idPadre === p.id}
                onClick={() => setIdPadre(p.id)}
              >
                {p.nombre}
              </Chip>
            ))}
        </FilaChips>
        {tieneHijas && (
          <span className={estilos.ayuda}>
            Esta categoría tiene subcategorías, así que no puede colgar de
            otra: el árbol es de dos niveles.
          </span>
        )}
        {errores.id_padre && <span className="error-campo">{errores.id_padre}</span>}
      </div>

      <div className={estilos.accionesHoja}>
        <button type="button" className="boton boton--primario" onClick={() => void enviar()}>
          Guardar
        </button>

        {existente && !confirmandoArchivo && (
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => setConfirmandoArchivo(true)}
          >
            Archivar categoría
          </button>
        )}

        {/* Archivar algo con 84 movimientos detrás no puede ser una
            sorpresa: se dice antes qué pasa con ellos. */}
        {existente && confirmandoArchivo && uso && (
          <div className={estilos.confirmacion}>
            <p className={estilos.textoConfirmacion}>
              {uso.movimientos + uso.movimientosDeHijas === 0
                ? 'No hay movimientos con esta categoría.'
                : `Hay ${uso.movimientos + uso.movimientosDeHijas} ${
                    uso.movimientos + uso.movimientosDeHijas === 1
                      ? 'movimiento'
                      : 'movimientos'
                  } con esta categoría. No se borra ninguno: siguen mostrándola y contando en los resúmenes. Lo que cambia es que deja de aparecer al registrar.`}
              {uso.hijas > 0 &&
                ` Se archivan también sus ${uso.hijas} subcategorías.`}
            </p>
            <button
              type="button"
              className="boton boton--peligro"
              onClick={() => void onArchivar(existente.id)}
            >
              Archivar de todos modos
            </button>
          </div>
        )}
      </div>
    </Hoja>
  )
}
