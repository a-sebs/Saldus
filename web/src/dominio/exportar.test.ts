import { describe, expect, it } from 'vitest'
import { aCSV, CABECERAS, nombreArchivo } from './exportar.ts'
import { leerFilas, parsearCSV, sugerirMapeo } from './csv.ts'
import * as f from '../pruebas/fabricas.ts'

const efectivo = f.cuenta({ id: 'cta-efectivo', nombre: 'Efectivo' })
const banco = f.cuenta({ id: 'cta-banco', nombre: 'Pichincha', tipo: 'DEBITO' })

const comida = f.categoria({ id: 'cat-comida', nombre: 'Comida' })
const salario = f.categoria({ id: 'cat-salario', nombre: 'Salario', tipo: 'INGRESO' })

const viaje = f.etiqueta({ id: 'etq-viaje', nombre: 'Viaje2026' })
const urgente = f.etiqueta({ id: 'etq-urgente', nombre: 'Urgente' })

const base = {
  cuentas: [efectivo, banco],
  categorias: [comida, salario],
  etiquetas: [viaje, urgente],
  enlacesEtiqueta: [],
}

/** Parte el CSV en líneas, ya sin BOM. */
function lineas(csv: string): string[] {
  return csv.replace(/^﻿/, '').trimEnd().split('\r\n')
}

describe('aCSV', () => {
  it('escribe la cabecera esperada', () => {
    const csv = aCSV({ ...base, transacciones: [] })
    expect(lineas(csv)[0]).toBe(CABECERAS.join(','))
  })

  it('empieza con BOM y separa con CRLF, para que Excel no rompa las tildes', () => {
    const csv = aCSV({
      ...base,
      transacciones: [f.transaccion({ descripcion: 'Almuerzo en el café' })],
    })
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('\r\n')
  })

  it('escribe el monto como decimal exacto, sin artefactos de coma flotante', () => {
    const csv = aCSV({
      ...base,
      transacciones: [f.transaccion({ monto: 30, id_categoria: 'cat-comida' })],
    })
    // 30 centavos. Con `centavos / 100` esto habría salido 0.30000000000000004.
    expect(lineas(csv)[1]).toContain(',0.30,')
  })

  it('resuelve nombres de cuenta y categoría', () => {
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({ id_cuenta: 'cta-banco', id_categoria: 'cat-comida' }),
      ],
    })
    expect(lineas(csv)[1]).toBe('02/09/2026,GASTO,4.50,Comida,Pichincha,,,')
  })

  it('omite los movimientos borrados: el borrado es suave, el respaldo no los lleva', () => {
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({ id_categoria: 'cat-comida' }),
        f.transaccion({
          id_categoria: 'cat-comida',
          eliminado_en: '2026-09-03T10:00:00.000Z',
        }),
      ],
    })
    expect(lineas(csv)).toHaveLength(2)
  })

  it('exporta la transferencia completa, con destino y sin categoría', () => {
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({
          tipo: 'TRANSFERENCIA',
          id_cuenta: 'cta-efectivo',
          id_cuenta_destino: 'cta-banco',
          id_categoria: null,
          monto: 10000,
        }),
      ],
    })
    expect(lineas(csv)[1]).toBe(
      '02/09/2026,TRANSFERENCIA,100.00,,Efectivo,Pichincha,,',
    )
  })

  it('junta las etiquetas de cada movimiento', () => {
    const csv = aCSV({
      ...base,
      transacciones: [f.transaccion({ id: 'trx-1', id_categoria: 'cat-comida' })],
      enlacesEtiqueta: [
        { id_transaccion: 'trx-1', id_etiqueta: 'etq-viaje' },
        { id_transaccion: 'trx-1', id_etiqueta: 'etq-urgente' },
      ],
    })
    // Entrecomillado porque el `;` es candidato a separador.
    expect(lineas(csv)[1]).toContain('"Urgente; Viaje2026"')
  })

  it('entrecomilla comas y comillas de la descripción', () => {
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({
          id_categoria: 'cat-comida',
          descripcion: 'Pan, queso y "leche"',
        }),
      ],
    })
    expect(lineas(csv)[1]).toContain('"Pan, queso y ""leche"""')
  })

  it('ordena por fecha, para que dos respaldos iguales den archivos iguales', () => {
    const transacciones = [
      f.transaccion({ fecha: '2026-09-05', id_categoria: 'cat-comida' }),
      f.transaccion({ fecha: '2026-09-01', id_categoria: 'cat-comida' }),
      f.transaccion({ fecha: '2026-09-03', id_categoria: 'cat-comida' }),
    ]
    const csv = aCSV({ ...base, transacciones })
    const fechas = lineas(csv)
      .slice(1)
      .map((l) => l.split(',')[0])
    expect(fechas).toEqual(['01/09/2026', '03/09/2026', '05/09/2026'])

    // Los mismos datos en otro orden de entrada dan el mismo archivo.
    const otro = aCSV({ ...base, transacciones: transacciones.slice().reverse() })
    expect(otro).toBe(csv)
  })
})

describe('formato de fecha', () => {
  it('escribe dd/mm/aaaa, no el ISO que Excel reinterpreta', () => {
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({ fecha: '2026-09-02', id_categoria: 'cat-comida' }),
      ],
    })
    expect(lineas(csv)[1]?.startsWith('02/09/2026,')).toBe(true)
  })

  it('un dia menor que 13 vuelve al mes correcto, no al dia', () => {
    // 04/03/2026 es 4 de marzo. Si algo lo leyera como mm/dd seria el 3
    // de abril: el movimiento acabaria en otro mes sin avisar.
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({ fecha: '2026-03-04', id_categoria: 'cat-comida' }),
      ],
    })
    expect(lineas(csv)[1]?.startsWith('04/03/2026,')).toBe(true)

    const filas = parsearCSV(csv)
    const { validas } = leerFilas(filas, {
      mapeo: sugerirMapeo(filas[0] as string[]),
      conCabecera: true,
      cuentas: base.cuentas,
      categorias: base.categorias,
      cuentaPorDefecto: 'cta-efectivo',
      existentes: [],
    })
    expect(validas[0]?.fecha).toBe('2026-03-04')
  })
})

describe('ida y vuelta con el importador', () => {
  it('el importador vuelve a leer lo exportado sin configurar el mapeo', () => {
    const transacciones = [
      f.transaccion({
        fecha: '2026-09-01',
        tipo: 'GASTO',
        monto: 1250,
        id_cuenta: 'cta-efectivo',
        id_categoria: 'cat-comida',
        descripcion: 'Pan, queso y "leche"',
      }),
      f.transaccion({
        fecha: '2026-09-02',
        tipo: 'INGRESO',
        monto: 150000,
        id_cuenta: 'cta-banco',
        id_categoria: 'cat-salario',
        descripcion: null,
      }),
    ]

    const filas = parsearCSV(aCSV({ ...base, transacciones }))
    const mapeo = sugerirMapeo(filas[0] as string[])

    // Las columnas que el importador no entiende se quedan fuera solas.
    expect(mapeo[0]).toBe('fecha')
    expect(mapeo[1]).toBe('tipo')
    expect(mapeo[2]).toBe('monto')
    expect(mapeo[3]).toBe('categoria')
    expect(mapeo[4]).toBe('cuenta')
    expect(mapeo[5]).toBe('ignorar')
    expect(mapeo[6]).toBe('descripcion')
    expect(mapeo[7]).toBe('ignorar')

    const { validas, rechazadas } = leerFilas(filas, {
      mapeo,
      conCabecera: true,
      cuentas: base.cuentas,
      categorias: base.categorias,
      cuentaPorDefecto: 'cta-efectivo',
      existentes: [],
    })

    expect(rechazadas).toEqual([])
    expect(validas).toHaveLength(2)
    expect(validas[0]).toMatchObject({
      fecha: '2026-09-01',
      tipo: 'GASTO',
      monto: 1250,
      id_cuenta: 'cta-efectivo',
      id_categoria: 'cat-comida',
      descripcion: 'Pan, queso y "leche"',
    })
    expect(validas[1]).toMatchObject({
      fecha: '2026-09-02',
      tipo: 'INGRESO',
      monto: 150000,
      id_cuenta: 'cta-banco',
      id_categoria: 'cat-salario',
      descripcion: null,
    })
  })

  it('la transferencia se exporta, pero el importador la rechaza y lo dice', () => {
    const csv = aCSV({
      ...base,
      transacciones: [
        f.transaccion({
          tipo: 'TRANSFERENCIA',
          id_cuenta: 'cta-efectivo',
          id_cuenta_destino: 'cta-banco',
          id_categoria: null,
        }),
      ],
    })
    const filas = parsearCSV(csv)
    const { validas, rechazadas } = leerFilas(filas, {
      mapeo: sugerirMapeo(filas[0] as string[]),
      conCabecera: true,
      cuentas: base.cuentas,
      categorias: base.categorias,
      cuentaPorDefecto: 'cta-efectivo',
      existentes: [],
    })

    // Documenta la limitación: el dato está en el archivo, pero el
    // importador no sabe reconstruir la cuenta de destino.
    expect(validas).toEqual([])
    expect(rechazadas).toHaveLength(1)
    expect(rechazadas[0]?.motivo).toContain('categoría')
  })
})

describe('nombreArchivo', () => {
  it('lleva la fecha dentro para que dos respaldos no se pisen', () => {
    expect(nombreArchivo('2026-09-03')).toBe('saldus-2026-09-03.csv')
  })
})
