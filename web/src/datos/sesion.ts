/**
 * Sesión local.
 *
 * En la Fase 1 no hay backend, así que una sesión es simplemente **qué
 * base local está activa**. En `localStorage` va únicamente ese puntero:
 * el id del usuario, su nombre y si es el demo.
 *
 * Nunca un token. Cuando en la Fase 2 haya JWT, el access token vive en
 * memoria y el refresh en IndexedDB o en una cookie httpOnly — jamás en
 * `localStorage`, entre otras cosas porque el service worker no puede
 * leerlo.
 */

import { baseDe, borrarBaseDe } from './db.ts'
import { sembrarDemo } from './demo.ts'
import { sembrarCategorias } from './semilla.ts'
import { ahora } from '../dominio/fechas.ts'
import { nuevoId } from '../dominio/ids.ts'
import type { Usuario, UUID } from '../dominio/tipos.ts'

const CLAVE_SESION = 'saldus.sesion'

/**
 * Id fijo del usuario demo. Fijo a propósito: así su base local siempre
 * se llama igual y "Ver demo" dos veces no deja bases huérfanas
 * ocupando la cuota de almacenamiento del navegador.
 */
export const ID_DEMO = '00000000-0000-4000-8000-00000000de70'

export interface Sesion {
  id_usuario: UUID
  email: string
  nombre: string | null
  es_demo: boolean
}

export function sesionActual(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION)
    if (!crudo) return null
    const s = JSON.parse(crudo) as Partial<Sesion>
    if (typeof s.id_usuario !== 'string') return null
    return {
      id_usuario: s.id_usuario,
      email: s.email ?? '',
      nombre: s.nombre ?? null,
      es_demo: s.es_demo === true,
    }
  } catch {
    // Modo privado de Safari o almacenamiento bloqueado: la app tiene
    // que abrir igual, solo que sin recordar la sesión.
    return null
  }
}

function guardarPuntero(sesion: Sesion): void {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
  } catch {
    /* sin persistencia del puntero, la sesión dura lo que la pestaña */
  }
}

/** Alta local de mi usuario real. Siembra las categorías de partida. */
export async function crearSesionPropia(datos: {
  nombre: string
  email?: string
}): Promise<Sesion> {
  const id = nuevoId()
  const t = ahora()

  const usuario: Usuario = {
    id,
    email: datos.email?.trim() || 'local@saldus',
    nombre: datos.nombre.trim() || null,
    es_demo: false,
    creado_en: t,
    actualizado_en: t,
  }

  const base = baseDe(id)
  await base.usuarios.put(usuario)
  await sembrarCategorias(base, id)

  const sesion: Sesion = {
    id_usuario: id,
    email: usuario.email,
    nombre: usuario.nombre,
    es_demo: false,
  }
  guardarPuntero(sesion)
  return sesion
}

/**
 * "Ver demo": entra sin pedir credenciales.
 *
 * Regenera el dataset cada vez, que es la versión local del reseteo
 * nocturno de la Fase 2. Si alguien borró la mitad de los movimientos
 * curioseando, el siguiente que abra el portafolio ve la app entera.
 */
export async function crearSesionDemo(): Promise<Sesion> {
  await borrarBaseDe(ID_DEMO)

  const t = ahora()
  const base = baseDe(ID_DEMO)

  await base.usuarios.put({
    id: ID_DEMO,
    email: 'demo@saldus',
    nombre: 'Demo',
    es_demo: true,
    creado_en: t,
    actualizado_en: t,
  })
  await sembrarDemo(base, ID_DEMO)

  const sesion: Sesion = {
    id_usuario: ID_DEMO,
    email: 'demo@saldus',
    nombre: 'Demo',
    es_demo: true,
  }
  guardarPuntero(sesion)
  return sesion
}

/**
 * Cerrar sesión **borra la base local**.
 *
 * No es una precaución teórica: sin esto, alguien que ve el demo en mi
 * navegador y luego vuelvo a entrar yo compartiría el mismo almacén, o
 * peor, mis transacciones reales quedarían cacheadas donde las puede
 * leer la sesión demo.
 */
export async function cerrarSesion(): Promise<void> {
  const sesion = sesionActual()
  try {
    localStorage.removeItem(CLAVE_SESION)
  } catch {
    /* nada que limpiar */
  }
  if (sesion) await borrarBaseDe(sesion.id_usuario)
}
