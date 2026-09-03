/**
 * Lectura de datos.
 *
 * Todo el dataset cabe holgadamente en memoria: ~2.000 filas al año,
 * menos de 1 MB en total. Así que en vez de una consulta afinada por
 * pantalla, se carga todo una vez y cada pantalla calcula lo suyo con
 * las funciones de `dominio/vistas.ts`.
 *
 * Es deliberado. Con este volumen, una capa de consultas por pantalla
 * costaría más de lo que ahorra y multiplicaría los sitios donde un
 * filtro `eliminado_en IS NULL` se puede olvidar.
 *
 * `useLiveQuery` de Dexie vuelve a ejecutar la consulta sola cuando
 * cambia cualquiera de las tablas, así que una escritura se ve en todas
 * las pantallas sin ningún bus de eventos.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useBase } from './sesion.tsx'
import { vivas } from '../dominio/vistas.ts'
import type {
  Categoria,
  Cuenta,
  Etiqueta,
  Transaccion,
  TransaccionEtiqueta,
} from '../dominio/tipos.ts'

export interface Datos {
  cuentas: Cuenta[]
  categorias: Categoria[]
  transacciones: Transaccion[]
  etiquetas: Etiqueta[]
  enlacesEtiqueta: TransaccionEtiqueta[]
  /** Ids con escrituras sin sincronizar, para marcarlos en la lista. */
  pendientes: Set<string>
}

const VACIO: Datos = {
  cuentas: [],
  categorias: [],
  transacciones: [],
  etiquetas: [],
  enlacesEtiqueta: [],
  pendientes: new Set(),
}

export function useDatos(): { datos: Datos; cargando: boolean } {
  const base = useBase()

  const datos = useLiveQuery(async () => {
    const [cuentas, categorias, transacciones, etiquetas, enlaces, outbox] =
      await Promise.all([
        base.cuentas.toArray(),
        base.categorias.toArray(),
        base.transacciones.toArray(),
        base.etiquetas.toArray(),
        base.transaccion_etiqueta.toArray(),
        base.outbox.toArray(),
      ])

    return {
      cuentas: vivas(cuentas),
      categorias: vivas(categorias),
      transacciones: vivas(transacciones),
      etiquetas: vivas(etiquetas),
      enlacesEtiqueta: enlaces,
      pendientes: new Set(outbox.map((o) => o.id)),
    } satisfies Datos
  }, [base])

  return { datos: datos ?? VACIO, cargando: datos === undefined }
}

/** Búsquedas por id que casi todas las pantallas necesitan. */
export function indexar(datos: Datos) {
  return {
    cuenta: new Map(datos.cuentas.map((c) => [c.id, c])),
    categoria: new Map(datos.categorias.map((c) => [c.id, c])),
    etiqueta: new Map(datos.etiquetas.map((e) => [e.id, e])),
  }
}
