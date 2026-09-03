/**
 * Invitación a instalar en la pantalla de inicio.
 *
 * Instalar no es cosmético en esta app: **Safari desaloja IndexedDB por
 * LRU bajo presión de almacenamiento**, y una web instalada en la
 * pantalla de inicio tiene mucha menos probabilidad de que le pase. Es
 * la diferencia entre conservar los datos y perderlos.
 *
 * Se muestra en el momento oportuno —cuando ya hay unos cuantos
 * movimientos anotados y por tanto algo que perder—, no al segundo de
 * entrar, que es cuando todavía no significa nada.
 *
 * En iOS no existe ningún aviso automático de instalación, así que hay
 * que explicar el gesto con palabras.
 */

import { useEffect, useState } from 'react'
import estilos from './InvitacionInstalar.module.css'

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function yaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
  // Safari en iOS no implementa display-mode y usa su propia bandera.
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone
  return standalone === true || iosStandalone === true
}

function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

interface Props {
  /** En Ajustes se muestra siempre; en la lista, solo si toca. */
  siempre?: boolean
  onDescartar?: () => void
}

export function InvitacionInstalar({ siempre = false, onDescartar }: Props) {
  const [evento, setEvento] = useState<EventoInstalar | null>(null)
  const [instalada, setInstalada] = useState(() => yaInstalada())

  useEffect(() => {
    const capturar = (e: Event) => {
      // Se evita el aviso automático del navegador para mostrarlo
      // cuando la app decide, no en medio de otra cosa.
      e.preventDefault()
      setEvento(e as EventoInstalar)
    }
    const instalado = () => setInstalada(true)

    window.addEventListener('beforeinstallprompt', capturar)
    window.addEventListener('appinstalled', instalado)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturar)
      window.removeEventListener('appinstalled', instalado)
    }
  }, [])

  if (instalada) {
    return siempre ? (
      <p className={estilos.instalada}>
        La app ya está instalada en esta pantalla de inicio.
      </p>
    ) : null
  }

  // Sin evento de instalación y fuera de iOS no hay nada que ofrecer:
  // el navegador no soporta instalar.
  if (!evento && !esIOS() && !siempre) return null

  return (
    <div className={estilos.invitacion}>
      <p className={estilos.texto}>
        Añádela a la pantalla de inicio: se abre como una app y el
        navegador deja de tratar sus datos como cacheables.
      </p>

      {evento ? (
        <button
          type="button"
          className="boton boton--secundario"
          onClick={async () => {
            await evento.prompt()
            await evento.userChoice
            setEvento(null)
          }}
        >
          Añadir a la pantalla de inicio
        </button>
      ) : (
        <p className={estilos.instrucciones}>
          {esIOS()
            ? 'En iPhone: toca Compartir en la barra de Safari y elige "Añadir a pantalla de inicio".'
            : 'En el menú del navegador busca "Instalar aplicación" o "Añadir a la pantalla de inicio".'}
        </p>
      )}

      {onDescartar && (
        <button type="button" className="boton boton--texto" onClick={onDescartar}>
          Ahora no
        </button>
      )}
    </div>
  )
}
