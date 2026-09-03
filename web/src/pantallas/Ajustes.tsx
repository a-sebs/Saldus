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
import { useDatos } from '../estado/datos.ts'
import { useSesion } from '../estado/sesion.tsx'
import { pedirPersistencia } from '../datos/db.ts'

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
        </ul>
      </section>

      {/* --- Dónde viven los datos --------------------------------- */}
      <section className={estilos.seccion}>
        <h2 className={estilos.subtitulo}>Tus datos</h2>
        <p className={estilos.dato}>
          {HAY_BACKEND
            ? 'Se guardan en este dispositivo y se sincronizan con el servidor en segundo plano.'
            : 'Se guardan solo en este dispositivo. Todavía no hay servidor con el que sincronizar, así que si borras los datos del navegador se van.'}
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
              espacio.
            </p>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={async () => {
                const ok = await pedirPersistencia()
                setAlmacenamiento((a) => (a ? { ...a, persistente: ok } : a))
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
        <h2 className={estilos.subtitulo}>Instalar</h2>
        <InvitacionInstalar siempre />
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
