/**
 * Rutas de la app.
 *
 * **Aquí no hay ningún guard de autenticación.** La pantalla de acceso
 * aparece solo cuando no existe todavía ninguna sesión local, que es
 * literalmente la primera vez que se abre la app. A partir de ahí la
 * interfaz funciona completa siempre: sin red, con el token vencido o
 * en modo avión. Envolver las rutas en un guard destruiría el offline,
 * que es el punto central del proyecto.
 */

import { Navigate, Route, Routes } from 'react-router-dom'

import { useSesion } from './estado/sesion.tsx'
import { Armazon } from './ui/Armazon.tsx'
import { AvisoVersion } from './ui/AvisoVersion.tsx'

import { Acceso } from './pantallas/Acceso.tsx'
import { Ajustes } from './pantallas/Ajustes.tsx'
import { Captura } from './pantallas/Captura.tsx'
import { Categorias } from './pantallas/Categorias.tsx'
import { Cuentas } from './pantallas/Cuentas.tsx'
import { Detalle } from './pantallas/Detalle.tsx'
import { Importar } from './pantallas/Importar.tsx'
import { Movimientos } from './pantallas/Movimientos.tsx'
import { Resumen } from './pantallas/Resumen.tsx'
import { Transferencia } from './pantallas/Transferencia.tsx'

export function App() {
  const { sesion, cargando } = useSesion()

  // Un instante en blanco mientras se lee el puntero de sesión, para que
  // la pantalla de acceso no parpadee delante de quien ya tiene datos.
  if (cargando) return null

  if (!sesion) {
    return (
      <Routes>
        <Route path="*" element={<Acceso />} />
      </Routes>
    )
  }

  return (
    <>
      <AvisoVersion />
      <Armazon>
        <Routes>
          <Route path="/" element={<Movimientos />} />
          <Route path="/registrar" element={<Captura />} />
          <Route path="/movimiento/:id" element={<Detalle />} />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/transferir" element={<Transferencia />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/resumen" element={<Resumen />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Armazon>
    </>
  )
}
