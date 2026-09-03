/**
 * Generador de los íconos de la PWA.
 *
 * Escribe PNG a mano con `zlib`, sin ninguna dependencia de imágenes:
 * el dibujo son cuatro rectángulos y meter `sharp` o `canvas` en el
 * proyecto para eso habría sido peso muerto en una app que presume de
 * abrir sin conexión.
 *
 * El ícono es el mismo motivo del sistema de diseño: tres renglones de
 * distinto largo y una raya de total debajo, en papel sobre tinta.
 *
 *   node herramientas/generar-iconos.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = join(AQUI, '..', 'public', 'icons')

/** Los mismos hex de tokens.css. */
const TINTA = [0x1f, 0x4b, 0x6b] // --acento, azul Prusia
const PAPEL = [0xf7, 0xf8, 0xf9] // --neutro-0

/**
 * El dibujo es el concepto de la app en cuatro rectángulos: tres
 * entradas con su concepto a la izquierda y su **cifra alineada a la
 * derecha**, una raya de cierre, y el total debajo en la misma columna
 * de cifras.
 *
 * Cuatro barras del mismo lado se leerían como un icono de menú; lo que
 * hace que esto se lea como un libro de cuentas es justamente que la
 * columna derecha esté alineada.
 *
 * Coordenadas normalizadas [0,1].
 */
const BARRAS = [
  // Conceptos, a la izquierda y de distinto largo.
  { x0: 0.2, x1: 0.45, y0: 0.22, y1: 0.275 },
  { x0: 0.2, x1: 0.52, y0: 0.36, y1: 0.415 },
  { x0: 0.2, x1: 0.41, y0: 0.5, y1: 0.555 },
  // Cifras, alineadas contra el mismo borde derecho.
  { x0: 0.63, x1: 0.8, y0: 0.22, y1: 0.275 },
  { x0: 0.6, x1: 0.8, y0: 0.36, y1: 0.415 },
  { x0: 0.65, x1: 0.8, y0: 0.5, y1: 0.555 },
  // Raya de cierre y total.
  { x0: 0.2, x1: 0.8, y0: 0.625, y1: 0.645 },
  { x0: 0.55, x1: 0.8, y0: 0.7, y1: 0.775 },
]

/* ---------------------------------------------------------------------
   PNG mínimo
   --------------------------------------------------------------------- */

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

function png(ancho, alto, pixeles) {
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 2 // color RGB
  ihdr[10] = 0 // compresión
  ihdr[11] = 0 // filtro
  ihdr[12] = 0 // sin entrelazado

  // Cada línea lleva delante su byte de filtro; 0 = sin filtro.
  const crudo = Buffer.alloc(alto * (1 + ancho * 3))
  for (let y = 0; y < alto; y++) {
    const inicio = y * (1 + ancho * 3)
    crudo[inicio] = 0
    pixeles.copy(crudo, inicio + 1, y * ancho * 3, (y + 1) * ancho * 3)
  }

  return Buffer.concat([
    firma,
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/* ---------------------------------------------------------------------
   Dibujo
   --------------------------------------------------------------------- */

function dibujar(lado, escala = 1) {
  const px = Buffer.alloc(lado * lado * 3)

  // Fondo de tinta a sangre: así el ícono funciona igual recortado en
  // círculo (Android) que en cuadrado redondeado (iOS).
  for (let i = 0; i < lado * lado; i++) {
    px[i * 3] = TINTA[0]
    px[i * 3 + 1] = TINTA[1]
    px[i * 3 + 2] = TINTA[2]
  }

  // `escala` encoge el dibujo hacia el centro para la variante
  // maskable, cuya zona segura es el 80% central.
  const ajustar = (v) => 0.5 + (v - 0.5) * escala

  for (const b of BARRAS) {
    const x0 = Math.round(ajustar(b.x0) * lado)
    const x1 = Math.round(ajustar(b.x1) * lado)
    const y0 = Math.round(ajustar(b.y0) * lado)
    const y1 = Math.round(ajustar(b.y1) * lado)

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * lado + x) * 3
        px[i] = PAPEL[0]
        px[i + 1] = PAPEL[1]
        px[i + 2] = PAPEL[2]
      }
    }
  }

  return png(lado, lado, px)
}

mkdirSync(SALIDA, { recursive: true })

const archivos = [
  ['icono-192.png', dibujar(192)],
  ['icono-512.png', dibujar(512)],
  ['icono-maskable-512.png', dibujar(512, 0.8)],
  ['apple-touch-icon.png', dibujar(180)],
]

for (const [nombre, datos] of archivos) {
  writeFileSync(join(SALIDA, nombre), datos)
  console.log(`escrito public/icons/${nombre} (${datos.length} bytes)`)
}
