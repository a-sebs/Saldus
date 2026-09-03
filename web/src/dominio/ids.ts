/**
 * Generación de identificadores.
 *
 * **Los UUID los genera el cliente, no el servidor.** Es lo que hace
 * idempotente el `POST /sync/push` de la Fase 2: si la respuesta se
 * pierde y el reintento manda la misma fila, el upsert por id la
 * sobrescribe en vez de duplicarla.
 *
 * `crypto.randomUUID` solo existe en contexto seguro, y probar la app
 * desde el celular contra `http://192.168.x.x:5173` **no** lo es. Sin
 * esta reserva, la app funcionaría en el escritorio y reventaría justo
 * en el dispositivo para el que está hecha.
 */

const HEX: string[] = []
for (let i = 0; i < 256; i++) HEX.push((i + 0x100).toString(16).slice(1))

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // UUID v4 a mano. `getRandomValues` sí está disponible fuera de
  // contexto seguro, así que la aleatoriedad sigue siendo criptográfica.
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = ((b[6] as number) & 0x0f) | 0x40 // versión 4
  b[8] = ((b[8] as number) & 0x3f) | 0x80 // variante RFC 4122

  const h = (i: number) => HEX[b[i] as number] as string
  return (
    `${h(0)}${h(1)}${h(2)}${h(3)}-${h(4)}${h(5)}-${h(6)}${h(7)}-` +
    `${h(8)}${h(9)}-${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`
  )
}
