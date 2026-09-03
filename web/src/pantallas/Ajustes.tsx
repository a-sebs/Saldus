/**
 * Ajustes.
 *
 * Es también donde la app dice la verdad sobre dónde viven los datos.
 * Mientras no exista backend, decirlo claro vale más que cualquier
 * indicador de sincronización: quien usa esto tiene que saber que si
 * borra los datos del navegador, se van.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { HAY_BACKEND, NOMBRE_APP } from '../config.ts'
import { useAviso } from '../estado/avisos.tsx'
import { useActualizacion } from '../estado/actualizacion.tsx'
import { useDatos } from '../estado/datos.ts'
import { useSesion } from '../estado/sesion.tsx'
import { pedirPersistencia } from '../datos/db.ts'
import { aCSV, nombreArchivo } from '../dominio/exportar.ts'
import { hoy } from '../dominio/fechas.ts'
import { entregarArchivo } from '../ui/descargar.ts'

import { Cabecera } from '../ui/Cabecera.tsx'
import { InvitacionInstalar } from '../ui/InvitacionInstalar.tsx'
import estilos from './Ajustes.module.css'

interface Almacenamiento {
  persistente: boolean
  usadoMB: number | null
}

export function Ajustes() {
  const { sesion, salir } = useSesion()
  const { datos } = useDatos()
  const navegar = useNavigate()
  const { mostrar } = useAviso()
  const { hayVersionNueva, estadoBusqueda, actualizar, buscar } =
    useActualizacion()

  const [almacenamiento, setAlmacenamiento] = useState<Almacenamiento | null>(null)
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)

  useEffect(() => {
    let vigente = true
    void (async () => {
      const persistente = (await navigator.storage?.persisted?.()) ?? false
      const cuota = await navigator.storage?.estimate?.().catch(() => null)
      if (!vigente) return
      setAlmacenamiento({
        persistente,
        usadoMB: cuota?.usage ? cuota.usage / (1024 * 1024) : null,
      })
    })()
    return () => {
      vigente = false
    }
  }, [])

  async function exportar() {
    if (datos.transacciones.length === 0) {
      mostrar('No hay movimientos que exportar todavía.')
      return
    }
    // El CSV se arma en memoria desde la réplica local: como todo lo
    // demás en esta app, no toca la red.
    const csv = aCSV({
      transacciones: datos.transacciones,
      cuentas: datos.cuentas,
      categorias: datos.categorias,
      etiquetas: datos.etiquetas,
      enlacesEtiqueta: datos.enlacesEtiqueta,
    })
    const resultado = await entregarArchivo(
      nombreArchivo(hoy()),
      csv,
      'text/csv;charset=utf-8',
    )
    if (resultado === 'cancelado') return
    mostrar(
      `${datos.transacciones.length} movimientos exportados. Guárdalo fuera del teléfono.`,
    )
  }

  return (
    <>
      <Cabecera titulo="Ajustes" />

      <section className={estilos.seccion}>
        <h2 className={estilos.subtitulo}>Sesión</h2>
        <p className={estilos.dato}>
          {sesion?.es_demo
            ? 'Estás viendo el demo, con datos de ejemplo.'
            : `Sesión local${sesion?.nombre ? ` de ${sesion.nombre}` : ''}.`}
        </p>
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.subtitulo}>Organizar</h2>
        <ul className={estilos.enlaces}>
          <li>
            <button
              type="button"
              className={estilos.enlace}
              onClick={() => navegar('/categorias')}
            >
              <span>Categorías y etiquetas</span>
              <span className={estilos.contador}>
                {datos.categorias.length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={estilos.enlace}
              onClick={() => navegar('/cuentas')}
            >
              <span>Cuentas</span>
              <span className={estilos.contador}>{datos.cuentas.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={estilos.enlace}
              onClick={() => navegar('/importar')}
            >
              <span>Importar desde CSV</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={estilos.enlace}
              onClick={exportar}
            >
              <span>Exportar a CSV</span>
              <span className={estilos.contador}>
                {datos.transacciones.length}
              </span>
            </button>
          </li>
        </ul>
      </section>

      {/* --- Dónde viven los datos --------------------------------- */}
      <section className={estilos.seccion}>
        <h2 className={estilos.subtitulo}>Tus datos</h2>
        <p className={estilos.dato}>
          {HAY_BACKEND
            ? 'Se guardan en este dispositivo y se sincronizan con el servidor en segundo plano.'
            : 'Se guardan solo en este dispositivo. Todavía no hay servidor con el que sincronizar, así que si borras los datos del navegador se van. Exporta a CSV de vez en cuando para tener una copia fuera del teléfono.'}
        </p>
        <p className={estilos.dato}>
          {datos.transacciones.length}{' '}
          {datos.transacciones.length === 1 ? 'movimiento' : 'movimientos'}
          {almacenamiento?.usadoMB !== null && almacenamiento !== null
            ? `, ${almacenamiento.usadoMB.toFixed(1)} MB en uso`
            : ''}
          .
        </p>

        {almacenamiento && !almacenamiento.persistente && (
          <>
            <p className={estilos.dato}>
              El navegador todavía puede borrar estos datos si se queda sin
              espacio. Puedes pedirle que los marque como protegidos: no abre
              ningún diálogo, lo concede o lo niega él solo según cuánto uses
              la app.
            </p>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={async () => {
                await pedirPersistencia()
                // El valor que manda es persisted(), no lo que devolvió
                // persist(): así lo que se muestra es el estado real del
                // navegador y no una suposición nuestra.
                const persistente =
                  (await navigator.storage?.persisted?.()) ?? false
                setAlmacenamiento((a) => (a ? { ...a, persistente } : a))
                // Sin este aviso, que lo nieguen es indistinguible de que
                // el botón esté roto: se repinta lo mismo y no pasa nada.
                mostrar(
                  persistente
                    ? 'Datos protegidos.'
                    : 'El navegador no lo concedió todavía. Suele concederlo tras unos días de uso.',
                )
              }}
            >
              Pedir almacenamiento protegido
            </button>
          </>
        )}
        {almacenamiento?.persistente && (
          <p className={estilos.dato}>
            El navegador tiene marcados estos datos como protegidos.
          </p>
        )}
      </section>

      <section className={estilos.seccion}>
        <h2 className={estilos.subtitulo}>Instalar y actualizar</h2>
        <InvitacionInstalar siempre />

        {hayVersionNueva ? (
          <>
            <p className={estilos.dato}>Hay una versión nueva lista.</p>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => void actualizar()}
            >
              Actualizar ahora
            </button>
          </>
        ) : (
          <>
            <p className={estilos.dato}>
              {estadoBusqueda === 'al-dia'
                ? 'Ya tienes la última versión.'
                : estadoBusqueda === 'sin-soporte'
                  ? 'Este navegador no gestiona actualizaciones en segundo plano. Recarga la página para traer la última versión.'
                  : 'La app busca versiones nuevas cada vez que se abre. Si acabas de publicar una, puedes comprobarlo ahora.'}
            </p>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => void buscar()}
              disabled={estadoBusqueda === 'buscando'}
            >
              {estadoBusqueda === 'buscando'
                ? 'Buscando…'
                : 'Buscar actualizaciones'}
            </button>
          </>
        )}
      </section>

      {/* --- Salir --------------------------------------------------- */}
      <section className={estilos.seccion}>
        <h2 className={estilos.subtitulo}>Cerrar sesión</h2>
        {!confirmandoSalida ? (
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => setConfirmandoSalida(true)}
          >
            Cerrar sesión
          </button>
        ) : (
          <div className={estilos.confirmacion}>
            <p className={estilos.dato}>
              {/* Sin esto, quien entre después al demo en este mismo
                  navegador leería las transacciones reales cacheadas. */}
              Cerrar sesión <strong>borra la base local de este navegador</strong>
              {HAY_BACKEND
                ? '. Lo que ya se sincronizó sigue en el servidor.'
                : ', y todavía no hay servidor donde estén copiados. Se pierden.'}
            </p>
            <button
              type="button"
              className="boton boton--peligro"
              onClick={() => void salir()}
            >
              Borrar y cerrar sesión
            </button>
            <button
              type="button"
              className="boton boton--texto"
              onClick={() => setConfirmandoSalida(false)}
            >
              Cancelar
            </button>
          </div>
        )}
      </section>

      <p className={estilos.version}>{NOMBRE_APP}, versión local</p>
    </>
  )
}
