import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './estilos/tokens.css'
import './estilos/base.css'

import { App } from './App.tsx'
import { ProveedorActualizacion } from './estado/actualizacion.tsx'
import { ProveedorAvisos } from './estado/avisos.tsx'
import { ProveedorSesion } from './estado/sesion.tsx'

const raiz = document.getElementById('raiz')
if (!raiz) throw new Error('Falta el nodo #raiz en index.html')

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorActualizacion>
        <ProveedorSesion>
          <ProveedorAvisos>
            <App />
          </ProveedorAvisos>
        </ProveedorSesion>
      </ProveedorActualizacion>
    </BrowserRouter>
  </StrictMode>,
)
