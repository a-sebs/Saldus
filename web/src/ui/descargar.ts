/**
 * Entregar un archivo generado en el dispositivo.
 *
 * No es tan simple como un `<a download>` porque el caso principal de
 * esta app es un iPhone con la PWA instalada, y ahí `download` se
 * comporta mal: Safari en modo standalone o lo ignora o abre el archivo
 * en una vista de la que no se puede guardar.
 *
 * La hoja de compartir del sistema sí funciona y además deja elegir
 * destino —Archivos, correo, WhatsApp—, que para un respaldo es
 * justamente lo que se quiere: sacar el archivo *del* teléfono. Por eso
 * se intenta primero, y el ancla queda de reserva para el escritorio.
 */

export type ResultadoEntrega = 'compartido' | 'descargado' | 'cancelado'

export async function entregarArchivo(
  nombre: string,
  contenido: string,
  tipoMime: string,
): Promise<ResultadoEntrega> {
  const blob = new Blob([contenido], { type: tipoMime })

  if (typeof File !== 'undefined' && navigator.canShare) {
    const archivo = new File([blob], nombre, { type: tipoMime })
    if (navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: nombre })
        return 'compartido'
      } catch (e) {
        // Cancelar la hoja de compartir es una decisión del usuario, no
        // un fallo: no hay que “rescatarla” descargando por detrás.
        if (e instanceof Error && e.name === 'AbortError') return 'cancelado'
        // Cualquier otro fallo sí cae a la descarga clásica.
      }
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const ancla = document.createElement('a')
    ancla.href = url
    ancla.download = nombre
    ancla.rel = 'noopener'
    document.body.appendChild(ancla)
    ancla.click()
    ancla.remove()
    return 'descargado'
  } finally {
    // Revocar de inmediato cancelaría la descarga en algunos
    // navegadores; se deja un margen y se libera después.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
