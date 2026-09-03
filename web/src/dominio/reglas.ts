/**
 * Reglas — el módulo más importante de la Fase 1.
 *
 * Postgres tiene CHECKs y claves foráneas compuestas que garantizan la
 * coherencia de los datos. **IndexedDB no tiene ninguna restricción.**
 *
 * Si el cliente escribe en local una fila que el esquema rechazaría, esa
 * fila vive feliz en el teléfono, se muestra en la interfaz, cuadra mal
 * un saldo, y en la Fase 2 envenena la cola de sincronización para
 * siempre: el servidor la rechaza, el reintento la vuelve a mandar, y la
 * cola se atasca detrás de ella.
 *
 * Por eso toda escritura pasa por aquí, y cada regla de este archivo es
 * la copia literal de una restricción de V1__esquema_inicial.sql. El
 * comentario de cada bloque dice cuál.
 */

import { LIMITE_CENTAVOS } from './dinero.ts'
import { esFechaValida } from './fechas.ts'
import type {
  Categoria,
  Cuenta,
  Etiqueta,
  Transaccion,
  TipoCategoria,
  UUID,
} from './tipos.ts'
import {
  TIPOS_CATEGORIA,
  TIPOS_CUENTA,
  TIPOS_TRANSACCION,
} from './tipos.ts'

export interface Problema {
  /** Campo al que anclar el mensaje en el formulario. */
  campo: string
  mensaje: string
}

export type Resultado =
  | { ok: true }
  | { ok: false; problemas: Problema[] }

/**
 * Datos de referencia que hacen falta para comprobar las restricciones
 * que en Postgres son claves foráneas. Se pasan como argumento en vez de
 * leerse de la base para que las reglas sean funciones puras y se puedan
 * probar sin IndexedDB.
 *
 * Las listas deben venir ya filtradas a filas **vivas** (`eliminado_en`
 * nulo), que es lo que hacen los índices parciales del esquema.
 */
export interface Referencias {
  cuentas: readonly Cuenta[]
  categorias: readonly Categoria[]
  etiquetas?: readonly Etiqueta[]
}

const LARGO_NOMBRE = 50
const LARGO_DESCRIPCION = 255

function ok(problemas: Problema[]): Resultado {
  return problemas.length === 0 ? { ok: true } : { ok: false, problemas }
}

function normalizar(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es')
}

/* =====================================================================
   Cuentas
   ===================================================================== */

export function validarCuenta(
  cuenta: Pick<Cuenta, 'id' | 'nombre' | 'tipo' | 'saldo_inicial' | 'moneda'>,
  refs: Referencias,
): Resultado {
  const p: Problema[] = []

  const nombre = cuenta.nombre?.trim() ?? ''
  if (nombre === '') {
    p.push({ campo: 'nombre', mensaje: 'Ponle un nombre a la cuenta.' })
  } else if (nombre.length > LARGO_NOMBRE) {
    p.push({
      campo: 'nombre',
      mensaje: `El nombre no puede pasar de ${LARGO_NOMBRE} caracteres.`,
    })
  }

  // cuentas_nombre_uk: único por usuario, sin distinguir mayúsculas y
  // solo entre las cuentas vivas.
  const choca = refs.cuentas.some(
    (c) => c.id !== cuenta.id && normalizar(c.nombre) === normalizar(nombre),
  )
  if (choca) {
    p.push({ campo: 'nombre', mensaje: 'Ya tienes una cuenta con ese nombre.' })
  }

  // cuentas_tipo_chk
  if (!TIPOS_CUENTA.includes(cuenta.tipo)) {
    p.push({ campo: 'tipo', mensaje: 'Tipo de cuenta desconocido.' })
  }

  if (!Number.isSafeInteger(cuenta.saldo_inicial)) {
    p.push({
      campo: 'saldo_inicial',
      mensaje: 'El saldo inicial no es un monto válido.',
    })
  } else if (Math.abs(cuenta.saldo_inicial) > LIMITE_CENTAVOS) {
    p.push({ campo: 'saldo_inicial', mensaje: 'El saldo inicial es demasiado grande.' })
  }

  // La app es de moneda única. El campo existe por higiene del esquema.
  if (cuenta.moneda !== 'USD') {
    p.push({ campo: 'moneda', mensaje: 'La única moneda soportada es USD.' })
  }

  return ok(p)
}

/* =====================================================================
   Categorías
   ===================================================================== */

export function validarCategoria(
  categoria: Pick<Categoria, 'id' | 'nombre' | 'tipo' | 'id_padre'>,
  refs: Referencias,
): Resultado {
  const p: Problema[] = []

  const nombre = categoria.nombre?.trim() ?? ''
  if (nombre === '') {
    p.push({ campo: 'nombre', mensaje: 'Ponle un nombre a la categoría.' })
  } else if (nombre.length > LARGO_NOMBRE) {
    p.push({
      campo: 'nombre',
      mensaje: `El nombre no puede pasar de ${LARGO_NOMBRE} caracteres.`,
    })
  }

  // categorias_tipo_chk
  if (!TIPOS_CATEGORIA.includes(categoria.tipo)) {
    p.push({ campo: 'tipo', mensaje: 'Una categoría es de ingreso o de gasto.' })
  }

  // categorias_no_autopadre_chk
  if (categoria.id_padre !== null && categoria.id_padre === categoria.id) {
    p.push({ campo: 'id_padre', mensaje: 'Una categoría no puede ser su propio padre.' })
  }

  if (categoria.id_padre !== null) {
    const padre = refs.categorias.find((c) => c.id === categoria.id_padre)
    if (!padre) {
      p.push({ campo: 'id_padre', mensaje: 'La categoría padre no existe.' })
    } else {
      // categorias_padre_fk: la FK compuesta (id_padre, tipo) obliga a
      // que la subcategoría herede el tipo del padre.
      if (padre.tipo !== categoria.tipo) {
        p.push({
          campo: 'id_padre',
          mensaje: `Una subcategoría de "${padre.nombre}" tiene que ser de ${
            padre.tipo === 'GASTO' ? 'gasto' : 'ingreso'
          }.`,
        })
      }
      // Árbol de dos niveles. Esta la impone la interfaz, no el SQL: el
      // esquema aceptaría más profundidad, pero una jerarquía de tres
      // niveles no cabe en una pantalla de 390px ni se navega con el
      // pulgar.
      if (padre.id_padre !== null) {
        p.push({
          campo: 'id_padre',
          mensaje: 'Solo hay dos niveles: categoría y subcategoría.',
        })
      }
    }

    // Que no se cuelgue de sí misma en un ciclo más largo.
    if (tieneCiclo(categoria.id, categoria.id_padre, refs.categorias)) {
      p.push({ campo: 'id_padre', mensaje: 'Eso crearía un ciclo de categorías.' })
    }
  }

  // categorias_nombre_uk: único por (usuario, tipo, nombre, padre) entre
  // las categorías vivas.
  const choca = refs.categorias.some(
    (c) =>
      c.id !== categoria.id &&
      c.tipo === categoria.tipo &&
      (c.id_padre ?? null) === (categoria.id_padre ?? null) &&
      normalizar(c.nombre) === normalizar(nombre),
  )
  if (choca) {
    p.push({
      campo: 'nombre',
      mensaje:
        categoria.id_padre === null
          ? 'Ya tienes una categoría con ese nombre.'
          : 'Ese padre ya tiene una subcategoría con ese nombre.',
    })
  }

  return ok(p)
}

function tieneCiclo(
  id: UUID,
  padreId: UUID | null,
  categorias: readonly Categoria[],
): boolean {
  const vistos = new Set<UUID>([id])
  let actual = padreId
  while (actual !== null) {
    if (vistos.has(actual)) return true
    vistos.add(actual)
    actual = categorias.find((c) => c.id === actual)?.id_padre ?? null
  }
  return false
}

/* =====================================================================
   Transacciones — aquí están las restricciones que más duelen si fallan
   ===================================================================== */

export type EntradaTransaccion = Pick<
  Transaccion,
  | 'id'
  | 'id_cuenta'
  | 'id_cuenta_destino'
  | 'id_categoria'
  | 'tipo'
  | 'monto'
  | 'fecha'
  | 'descripcion'
>

export function validarTransaccion(
  t: EntradaTransaccion,
  refs: Referencias,
): Resultado {
  const p: Problema[] = []

  // transacciones_tipo_chk
  if (!TIPOS_TRANSACCION.includes(t.tipo)) {
    p.push({ campo: 'tipo', mensaje: 'Tipo de movimiento desconocido.' })
    return ok(p) // sin tipo válido, el resto de reglas no significa nada
  }

  // transacciones_monto_chk: CHECK (monto > 0). El signo lo determina el
  // tipo, nunca el monto.
  if (!Number.isSafeInteger(t.monto)) {
    p.push({ campo: 'monto', mensaje: 'El monto no es válido.' })
  } else if (t.monto <= 0) {
    p.push({ campo: 'monto', mensaje: 'El monto tiene que ser mayor que cero.' })
  } else if (t.monto > LIMITE_CENTAVOS) {
    p.push({ campo: 'monto', mensaje: 'Ese monto se sale del límite.' })
  }

  if (!esFechaValida(t.fecha)) {
    p.push({ campo: 'fecha', mensaje: 'La fecha no es válida.' })
  }

  if (t.descripcion !== null && t.descripcion.length > LARGO_DESCRIPCION) {
    p.push({
      campo: 'descripcion',
      mensaje: `La descripción no puede pasar de ${LARGO_DESCRIPCION} caracteres.`,
    })
  }

  const origen = refs.cuentas.find((c) => c.id === t.id_cuenta)
  if (!origen) {
    p.push({ campo: 'id_cuenta', mensaje: 'Elige una cuenta.' })
  }

  // transacciones_forma_chk, mitad transferencia:
  //   destino no nulo, distinto del origen, y sin categoría.
  if (t.tipo === 'TRANSFERENCIA') {
    if (t.id_cuenta_destino === null) {
      p.push({ campo: 'id_cuenta_destino', mensaje: 'Elige la cuenta de destino.' })
    } else {
      if (t.id_cuenta_destino === t.id_cuenta) {
        p.push({
          campo: 'id_cuenta_destino',
          mensaje: 'El origen y el destino no pueden ser la misma cuenta.',
        })
      }
      if (!refs.cuentas.some((c) => c.id === t.id_cuenta_destino)) {
        p.push({ campo: 'id_cuenta_destino', mensaje: 'La cuenta de destino no existe.' })
      }
    }
    if (t.id_categoria !== null) {
      p.push({
        campo: 'id_categoria',
        mensaje: 'Una transferencia no lleva categoría: el dinero no sale de tu bolsillo.',
      })
    }
  } else {
    // transacciones_forma_chk, mitad ingreso/gasto:
    //   sin destino y con categoría.
    if (t.id_cuenta_destino !== null) {
      p.push({
        campo: 'id_cuenta_destino',
        mensaje: 'Solo una transferencia lleva cuenta de destino.',
      })
    }
    if (t.id_categoria === null) {
      p.push({ campo: 'id_categoria', mensaje: 'Elige una categoría.' })
    } else {
      const categoria = refs.categorias.find((c) => c.id === t.id_categoria)
      if (!categoria) {
        p.push({ campo: 'id_categoria', mensaje: 'Esa categoría no existe.' })
      } else if (categoria.tipo !== (t.tipo as TipoCategoria)) {
        // transacciones_categoria_fk: la FK compuesta (id_categoria,
        // tipo) impide guardar un GASTO con categoría de INGRESO. Es una
        // restricción de base de datos; aquí se replica para que falle
        // en la interfaz, que es donde el usuario puede corregirlo.
        p.push({
          campo: 'id_categoria',
          mensaje: `"${categoria.nombre}" es una categoría de ${
            categoria.tipo === 'GASTO' ? 'gasto' : 'ingreso'
          } y esto es un ${t.tipo === 'GASTO' ? 'gasto' : 'ingreso'}.`,
        })
      }
    }
  }

  return ok(p)
}

/* =====================================================================
   Etiquetas
   ===================================================================== */

export function validarEtiqueta(
  etiqueta: Pick<Etiqueta, 'id' | 'nombre'>,
  refs: Referencias,
): Resultado {
  const p: Problema[] = []
  const nombre = etiqueta.nombre?.trim() ?? ''

  if (nombre === '') {
    p.push({ campo: 'nombre', mensaje: 'Ponle un nombre a la etiqueta.' })
  } else if (nombre.length > LARGO_NOMBRE) {
    p.push({
      campo: 'nombre',
      mensaje: `El nombre no puede pasar de ${LARGO_NOMBRE} caracteres.`,
    })
  }

  // etiquetas_nombre_uk
  const choca = (refs.etiquetas ?? []).some(
    (e) => e.id !== etiqueta.id && normalizar(e.nombre) === normalizar(nombre),
  )
  if (choca) {
    p.push({ campo: 'nombre', mensaje: 'Ya tienes una etiqueta con ese nombre.' })
  }

  return ok(p)
}

/* =====================================================================
   Utilidades para la interfaz
   ===================================================================== */

/** Junta los problemas por campo, que es como los pinta un formulario. */
export function problemasPorCampo(r: Resultado): Record<string, string> {
  if (r.ok) return {}
  const mapa: Record<string, string> = {}
  for (const p of r.problemas) {
    if (!(p.campo in mapa)) mapa[p.campo] = p.mensaje
  }
  return mapa
}

/** Primer mensaje, para un aviso de una sola línea. */
export function primerMensaje(r: Resultado): string | null {
  return r.ok ? null : (r.problemas[0]?.mensaje ?? null)
}
