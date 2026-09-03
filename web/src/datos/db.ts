/**
 * Base local (IndexedDB vía Dexie).
 *
 * **IndexedDB es una réplica completa, no una cola de pendientes.**
 * Todas las lecturas, listados y cálculos de la app salen de aquí, así
 * que la interfaz nunca espera a la red. El servidor de la Fase 2 será
 * la copia durable; el teléfono es la fuente de verdad para escrituras.
 *
 * La base se llama `finanzas_<uuid_usuario>` y **se borra al cerrar
 * sesión**. Si se compartiera una sola base entre usuarios, alguien que
 * entra a ver el demo desde mi portafolio leería mis transacciones
 * reales cacheadas en el mismo navegador.
 */

import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  Categoria,
  Cuenta,
  Etiqueta,
  Meta,
  OperacionPendiente,
  Transaccion,
  TransaccionEtiqueta,
  Usuario,
} from '../dominio/tipos.ts'

export const PREFIJO_BASE = 'finanzas_'

export class BaseLocal extends Dexie {
  usuarios!: Table<Usuario, string>
  cuentas!: Table<Cuenta, string>
  categorias!: Table<Categoria, string>
  transacciones!: Table<Transaccion, string>
  etiquetas!: Table<Etiqueta, string>
  transaccion_etiqueta!: Table<TransaccionEtiqueta, [string, string]>
  outbox!: Table<OperacionPendiente, number>
  meta!: Table<Meta, string>

  constructor(nombre: string) {
    super(nombre)

    /*
     * Los índices son el espejo de los del esquema SQL. Dexie no tiene
     * índices parciales, así que el `WHERE eliminado_en IS NULL` de
     * Postgres se hace filtrando en código: con ~2.000 filas al año da
     * exactamente igual.
     *
     * Los `[id_usuario+actualizado_en]` son los `*_sync_idx`: existen
     * para el "dame todo lo que cambió desde X" de la Fase 2, no para
     * las pantallas.
     */
    this.version(1).stores({
      usuarios: 'id, email',
      cuentas: 'id, id_usuario, [id_usuario+actualizado_en]',
      categorias:
        'id, id_usuario, id_padre, [id_usuario+tipo], [id_usuario+actualizado_en]',
      transacciones:
        'id, fecha, id_cuenta_destino, ' +
        '[id_usuario+fecha], ' +
        '[id_usuario+id_cuenta+fecha], ' +
        '[id_usuario+id_categoria+fecha], ' +
        '[id_usuario+actualizado_en]',
      etiquetas: 'id, id_usuario, [id_usuario+actualizado_en]',
      transaccion_etiqueta: '[id_transaccion+id_etiqueta], id_transaccion, id_etiqueta',
      // ++seq mantiene el orden real de las escrituras, que es el orden
      // en que hay que empujarlas al servidor.
      outbox: '++seq, entidad, id',
      meta: 'clave',
    })
  }
}

/* =====================================================================
   Instancia activa

   Se guarda una sola por nombre de base: abrir dos conexiones a la misma
   base desde la misma pestaña provoca bloqueos al versionar.
   ===================================================================== */

const abiertas = new Map<string, BaseLocal>()

export function baseDe(idUsuario: string): BaseLocal {
  const nombre = PREFIJO_BASE + idUsuario
  const existente = abiertas.get(nombre)
  if (existente) return existente

  const base = new BaseLocal(nombre)
  abiertas.set(nombre, base)
  return base
}

/** Cierra y borra la base de un usuario. Se llama al cerrar sesión. */
export async function borrarBaseDe(idUsuario: string): Promise<void> {
  const nombre = PREFIJO_BASE + idUsuario
  const base = abiertas.get(nombre)
  if (base) {
    base.close()
    abiertas.delete(nombre)
  }
  await Dexie.delete(nombre)
}

/** Solo para las pruebas: olvida las instancias en memoria. */
export function olvidarBases(): void {
  for (const base of abiertas.values()) base.close()
  abiertas.clear()
}

/* =====================================================================
   Persistencia

   Safari desaloja por LRU y puede borrar IndexedDB bajo presión de
   almacenamiento. Pedir persistencia no es una garantía, pero mueve la
   base al final de la cola de desalojo, y es gratis.
   ===================================================================== */

export async function pedirPersistencia(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false
  }
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
