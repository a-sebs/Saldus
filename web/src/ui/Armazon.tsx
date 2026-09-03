/**
 * Armazón de la app: contenido, acción primaria y navegación inferior.
 *
 * Todo lo que se toca vive en el tercio inferior de la pantalla, porque
 * esta app se usa con una mano y de pie. La navegación va fija abajo y
 * respeta `env(safe-area-inset-bottom)`, o quedaría debajo de la barra
 * de gestos de iOS y sería intocable.
 */

import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  IconoAjustes,
  IconoCuentas,
  IconoMovimientos,
  IconoResumen,
} from './iconos.tsx'
import estilos from './Armazon.module.css'
import type { ReactNode } from 'react'

const DESTINOS = [
  { ruta: '/', texto: 'Movimientos', Icono: IconoMovimientos },
  { ruta: '/cuentas', texto: 'Cuentas', Icono: IconoCuentas },
  { ruta: '/resumen', texto: 'Resumen', Icono: IconoResumen },
  { ruta: '/ajustes', texto: 'Ajustes', Icono: IconoAjustes },
] as const

const RUTAS_CON_ACCION: string[] = ['/', '/cuentas', '/resumen']

export function Armazon({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const conAccion = RUTAS_CON_ACCION.includes(pathname)

  return (
    <div className={estilos.armazon}>
      <main
        className={[estilos.contenido, conAccion ? estilos.conAccion : ''].join(' ')}
      >
        {children}
      </main>

      {conAccion && (
        <div className={estilos.barraAccion}>
          <div className="contenedor">
            <button
              type="button"
              className="boton boton--primario"
              onClick={() => navegar('/registrar?tipo=GASTO')}
            >
              Registrar
            </button>
          </div>
        </div>
      )}

      <nav className={estilos.nav} aria-label="Secciones">
        {DESTINOS.map(({ ruta, texto, Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end={ruta === '/'}
            className={({ isActive }) =>
              [estilos.destino, isActive ? estilos.activo : ''].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icono activo={isActive} />
                <span className={estilos.etiquetaDestino}>{texto}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
