/**
 * Primer uso.
 *
 * Dos caminos y ninguno pide credenciales:
 *
 * - **Ver demo**: entra directo, con seis meses de datos sembrados. Es
 *   lo primero que ve alguien que abre esto desde mi portafolio, así que
 *   no puede haber un usuario y una contraseña que copiar a mano.
 * - **Empezar de cero**: crea la base local y la primera cuenta en un
 *   solo paso, porque sin cuenta no se puede anotar nada.
 *
 * No hay formulario de inicio de sesión. En la Fase 1 no existe
 * servidor contra el que autenticarse, y poner un formulario de fachada
 * que no hace nada sería peor que no ponerlo. Cuando haya backend, el
 * acceso protegerá **la sincronización**, no esta pantalla: la app
 * seguirá abriendo con los datos locales aunque el token esté vencido.
 */

import { useState } from 'react'

import { parseMonto } from '../dominio/dinero.ts'
import { TIPOS_CUENTA } from '../dominio/tipos.ts'
import type { TipoCuenta } from '../dominio/tipos.ts'

import { baseDe } from '../datos/db.ts'
import { guardarCuenta } from '../datos/repos/cuentas.ts'
import { CLAVES, escribirMeta } from '../datos/repos/meta.ts'
import { useSesion } from '../estado/sesion.tsx'

import { Chip, FilaChips } from '../ui/Chip.tsx'
import estilos from './Acceso.module.css'

const NOMBRE_TIPO: Record<TipoCuenta, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Cuenta bancaria',
  CREDITO: 'Tarjeta de crédito',
}

export function Acceso() {
  const { entrarDemo } = useSesion()
  const [modo, setModo] = useState<'inicio' | 'alta'>('inicio')
  const [trabajando, setTrabajando] = useState(false)

  if (modo === 'alta') {
    return <Alta onVolver={() => setModo('inicio')} />
  }

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.contenido}>
        <h1 className={estilos.titulo}>Saldus</h1>
        <p className={estilos.entrada}>
          Un libro de cuentas para el bolsillo. Anota lo que gastas en dos
          toques y funciona igual sin señal.
        </p>

        <div className={estilos.acciones}>
          <button
            type="button"
            className="boton boton--primario"
            disabled={trabajando}
            onClick={async () => {
              setTrabajando(true)
              await entrarDemo()
            }}
          >
            {trabajando ? 'Preparando el demo…' : 'Ver demo'}
          </button>

          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => setModo('alta')}
          >
            Empezar de cero
          </button>
        </div>

        <p className={estilos.nota}>
          El demo trae seis meses de movimientos de ejemplo y se puede
          trastear sin miedo: se regenera cada vez que se entra.
        </p>
      </div>
    </main>
  )
}

/* =====================================================================
   Alta: nombre y primera cuenta, en una sola pantalla
   ===================================================================== */

function Alta({ onVolver }: { onVolver: () => void }) {
  const { entrarPropia } = useSesion()

  const [nombre, setNombre] = useState('')
  const [cuenta, setCuenta] = useState('Efectivo')
  const [tipo, setTipo] = useState<TipoCuenta>('EFECTIVO')
  const [saldo, setSaldo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  async function empezar() {
    const centavos = saldo.trim() === '' ? 0 : parseMonto(saldo)
    if (centavos === null) {
      setError('Ese saldo no es un monto válido.')
      return
    }
    if (cuenta.trim() === '') {
      setError('Ponle un nombre a la cuenta.')
      return
    }

    setTrabajando(true)

    // La cuenta se siembra con la sesión ya creada pero antes de
    // activarla: así la app se monta con todo listo y no con una
    // pantalla vacía pidiendo crear una cuenta.
    await entrarPropia(nombre, async (sesion) => {
      const base = baseDe(sesion.id_usuario)
      const r = await guardarCuenta(base, sesion.id_usuario, {
        nombre: cuenta.trim(),
        tipo,
        saldo_inicial: centavos,
      })
      if (r.ok) await escribirMeta(base, CLAVES.ultimaCuenta, r.id)
    })
  }

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.contenido}>
        <h1 className={estilos.tituloAlta}>Tu primera cuenta</h1>
        <p className={estilos.entrada}>
          Una cuenta es de dónde sale el dinero. Puedes añadir más después.
        </p>

        <div className={estilos.campo}>
          <label className="etiqueta-campo" htmlFor="nombre">
            Cómo te llamas
          </label>
          <input
            id="nombre"
            className="campo"
            type="text"
            maxLength={100}
            autoComplete="given-name"
            placeholder="Opcional"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className={estilos.campo}>
          <label className="etiqueta-campo" htmlFor="cuenta">
            Nombre de la cuenta
          </label>
          <input
            id="cuenta"
            className="campo"
            type="text"
            maxLength={50}
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value)}
          />
        </div>

        <div className={estilos.campo}>
          <span className="etiqueta-campo">Tipo</span>
          <FilaChips>
            {TIPOS_CUENTA.map((t) => (
              <Chip
                key={t}
                seleccionado={tipo === t}
                onClick={() => {
                  setTipo(t)
                  // Solo se renombra si el nombre sigue siendo uno de
                  // los que puso la app: nunca se pisa lo que escribió
                  // el usuario.
                  const sinTocar =
                    cuenta.trim() === '' ||
                    Object.values(NOMBRE_TIPO).includes(cuenta)
                  if (sinTocar) setCuenta(NOMBRE_TIPO[t])
                }}
              >
                {NOMBRE_TIPO[t]}
              </Chip>
            ))}
          </FilaChips>
        </div>

        <div className={estilos.campo}>
          <label className="etiqueta-campo" htmlFor="saldo">
            Cuánto hay ahora
          </label>
          <input
            id="saldo"
            className="campo"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={saldo}
            onChange={(e) => {
              setSaldo(e.target.value.replace(/[^\d.,-]/g, ''))
              setError(null)
            }}
          />
        </div>

        {error && <span className="error-campo">{error}</span>}

        <div className={estilos.acciones}>
          <button
            type="button"
            className="boton boton--primario"
            disabled={trabajando}
            onClick={() => void empezar()}
          >
            Empezar
          </button>
          <button type="button" className="boton boton--texto" onClick={onVolver}>
            Volver
          </button>
        </div>
      </div>
    </main>
  )
}
