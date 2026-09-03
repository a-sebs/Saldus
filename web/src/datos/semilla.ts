/**
 * Semilla de categorías.
 *
 * El orden de esta lista importa: es el desempate de
 * `ordenarPorFrecuencia` mientras no hay historial, así que arriba va lo
 * que uno registra el primer día. Después el uso real reordena solo.
 *
 * Son categorías para Ecuador en USD y **se pueden editar y borrar
 * todas**: es un punto de partida para no arrancar con una pantalla en
 * blanco, no una taxonomía impuesta.
 */

import type { BaseLocal } from './db.ts'
import { ahora } from '../dominio/fechas.ts'
import { nuevoId } from '../dominio/ids.ts'
import type { Categoria, TipoCategoria, UUID } from '../dominio/tipos.ts'

interface Plantilla {
  nombre: string
  tipo: TipoCategoria
  hijas?: string[]
}

export const CATEGORIAS_SEMILLA: Plantilla[] = [
  {
    nombre: 'Comida',
    tipo: 'GASTO',
    hijas: ['Almuerzo', 'Supermercado', 'Café y snacks', 'Restaurantes'],
  },
  {
    nombre: 'Transporte',
    tipo: 'GASTO',
    hijas: ['Bus', 'Taxi', 'Gasolina', 'Mantenimiento'],
  },
  {
    nombre: 'Vivienda',
    tipo: 'GASTO',
    hijas: ['Arriendo', 'Luz', 'Agua', 'Internet', 'Gas'],
  },
  { nombre: 'Salud', tipo: 'GASTO', hijas: ['Farmacia', 'Consultas'] },
  {
    nombre: 'Personal',
    tipo: 'GASTO',
    hijas: ['Ropa', 'Peluquería', 'Gimnasio'],
  },
  {
    nombre: 'Ocio',
    tipo: 'GASTO',
    hijas: ['Salidas', 'Suscripciones', 'Viajes'],
  },
  { nombre: 'Educación', tipo: 'GASTO', hijas: ['Cursos', 'Libros'] },
  { nombre: 'Familia', tipo: 'GASTO', hijas: ['Regalos', 'Mascotas'] },
  { nombre: 'Deudas', tipo: 'GASTO', hijas: ['Tarjeta', 'Préstamo'] },
  { nombre: 'Otros gastos', tipo: 'GASTO' },

  { nombre: 'Sueldo', tipo: 'INGRESO' },
  { nombre: 'Trabajos extra', tipo: 'INGRESO' },
  { nombre: 'Ventas', tipo: 'INGRESO' },
  { nombre: 'Intereses', tipo: 'INGRESO' },
  { nombre: 'Otros ingresos', tipo: 'INGRESO' },
]

/**
 * Escribe la semilla. Las categorías creadas aquí **no** pasan por el
 * outbox con prisa: son parte del alta del usuario y en la Fase 2 se
 * empujan igual, pero no hay nada que reconciliar.
 */
export async function sembrarCategorias(
  base: BaseLocal,
  idUsuario: UUID,
): Promise<Categoria[]> {
  const t = ahora()
  const filas: Categoria[] = []

  for (const plantilla of CATEGORIAS_SEMILLA) {
    const padre: Categoria = {
      id: nuevoId(),
      id_usuario: idUsuario,
      nombre: plantilla.nombre,
      tipo: plantilla.tipo,
      id_padre: null,
      creado_en: t,
      actualizado_en: t,
      eliminado_en: null,
    }
    filas.push(padre)

    for (const nombreHija of plantilla.hijas ?? []) {
      filas.push({
        id: nuevoId(),
        id_usuario: idUsuario,
        nombre: nombreHija,
        tipo: plantilla.tipo,
        id_padre: padre.id,
        creado_en: t,
        actualizado_en: t,
        eliminado_en: null,
      })
    }
  }

  await base.transaction('rw', base.categorias, base.outbox, async () => {
    await base.categorias.bulkPut(filas)
    await base.outbox.bulkAdd(
      filas.map((f) => ({
        entidad: 'categorias' as const,
        id: f.id,
        op: 'upsert' as const,
        encolado_en: t,
        intentos: 0,
      })),
    )
  })

  return filas
}
