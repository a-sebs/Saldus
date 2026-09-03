import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BaseLocal, borrarBaseDe, olvidarBases } from './db.ts'
import { contarPendientes, idsPendientes } from './repos/comun.ts'
import { archivarCuenta, borrarCuenta, guardarCuenta, listarCuentas } from './repos/cuentas.ts'
import {
  archivarCategoria,
  guardarCategoria,
  listarCategorias,
  usoDeCategoria,
} from './repos/categorias.ts'
import {
  borrarTransaccion,
  guardarTransaccion,
  listarTransacciones,
  restaurarTransaccion,
} from './repos/transacciones.ts'
import { sembrarCategorias } from './semilla.ts'
import { sembrarDemo } from './demo.ts'
import { saldoTotal, saldos, totalesDelMes } from '../dominio/vistas.ts'
import type { Categoria } from '../dominio/tipos.ts'

const USUARIO = '00000000-0000-4000-8000-000000000001'

let base: BaseLocal
let contador = 0

beforeEach(async () => {
  contador += 1
  base = new BaseLocal(`prueba_${contador}`)
  await base.open()
})

afterEach(async () => {
  base.close()
  olvidarBases()
})

async function conCategorias(): Promise<Map<string, Categoria>> {
  const filas = await sembrarCategorias(base, USUARIO)
  return new Map(filas.map((c) => [c.nombre, c]))
}

describe('escrituras', () => {
  it('valida antes de escribir: nada inválido llega a IndexedDB', async () => {
    const cats = await conCategorias()
    const cuenta = await guardarCuenta(base, USUARIO, {
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      saldo_inicial: 5000,
    })
    expect(cuenta.ok).toBe(true)
    if (!cuenta.ok) return

    // Un GASTO con categoría de INGRESO: Postgres lo rechazaría por la
    // FK compuesta, así que aquí tampoco puede entrar.
    const malo = await guardarTransaccion(base, USUARIO, {
      id_cuenta: cuenta.id,
      id_categoria: cats.get('Sueldo')!.id,
      tipo: 'GASTO',
      monto: 450,
      fecha: '2026-09-02',
    })

    expect(malo.ok).toBe(false)
    expect(await base.transacciones.count()).toBe(0)
  })

  it('encola cada escritura en el outbox', async () => {
    const cats = await conCategorias()
    const cuenta = await guardarCuenta(base, USUARIO, {
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      saldo_inicial: 0,
    })
    if (!cuenta.ok) throw new Error('no se creó la cuenta')

    const antes = await contarPendientes(base)
    const trx = await guardarTransaccion(base, USUARIO, {
      id_cuenta: cuenta.id,
      id_categoria: cats.get('Almuerzo')!.id,
      tipo: 'GASTO',
      monto: 450,
      fecha: '2026-09-02',
    })
    if (!trx.ok) throw new Error('no se guardó el movimiento')

    expect(await contarPendientes(base)).toBe(antes + 1)
    expect(await idsPendientes(base)).toContain(trx.id)
  })

  it('no duplica la entrada del outbox al editar dos veces', async () => {
    const cats = await conCategorias()
    const cuenta = await guardarCuenta(base, USUARIO, {
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      saldo_inicial: 0,
    })
    if (!cuenta.ok) throw new Error('no se creó la cuenta')

    const trx = await guardarTransaccion(base, USUARIO, {
      id_cuenta: cuenta.id,
      id_categoria: cats.get('Almuerzo')!.id,
      tipo: 'GASTO',
      monto: 450,
      fecha: '2026-09-02',
    })
    if (!trx.ok) throw new Error('no se guardó')

    await guardarTransaccion(base, USUARIO, {
      id: trx.id,
      id_cuenta: cuenta.id,
      id_categoria: cats.get('Almuerzo')!.id,
      tipo: 'GASTO',
      monto: 500,
      fecha: '2026-09-02',
    })

    const filas = await base.outbox.where('id').equals(trx.id).toArray()
    expect(filas).toHaveLength(1)
    expect((await base.transacciones.get(trx.id))?.monto).toBe(500)
  })

  it('normaliza la forma de una transferencia', async () => {
    await conCategorias()
    const a = await guardarCuenta(base, USUARIO, {
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      saldo_inicial: 0,
    })
    const b = await guardarCuenta(base, USUARIO, {
      nombre: 'Banco',
      tipo: 'DEBITO',
      saldo_inicial: 0,
    })
    if (!a.ok || !b.ok) throw new Error('no se crearon las cuentas')

    const r = await guardarTransaccion(base, USUARIO, {
      id_cuenta: a.id,
      id_cuenta_destino: b.id,
      // La pantalla manda una categoría por descuido; el repositorio la
      // descarta para que la fila cumpla transacciones_forma_chk.
      id_categoria: 'cat-cualquiera',
      tipo: 'TRANSFERENCIA',
      monto: 10000,
      fecha: '2026-09-02',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect((await base.transacciones.get(r.id))?.id_categoria).toBeNull()
  })
})

describe('borrado suave', () => {
  it('borra sin perder la fila y se puede deshacer', async () => {
    const cats = await conCategorias()
    const cuenta = await guardarCuenta(base, USUARIO, {
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      saldo_inicial: 0,
    })
    if (!cuenta.ok) throw new Error('no se creó la cuenta')

    const trx = await guardarTransaccion(base, USUARIO, {
      id_cuenta: cuenta.id,
      id_categoria: cats.get('Almuerzo')!.id,
      tipo: 'GASTO',
      monto: 450,
      fecha: '2026-09-02',
    })
    if (!trx.ok) throw new Error('no se guardó')

    await borrarTransaccion(base, trx.id)
    expect(await listarTransacciones(base)).toHaveLength(0)
    // La fila sigue: el servidor necesita enterarse del borrado.
    expect(await base.transacciones.count()).toBe(1)
    expect((await base.transacciones.get(trx.id))?.eliminado_en).not.toBeNull()

    await restaurarTransaccion(base, trx.id)
    expect(await listarTransacciones(base)).toHaveLength(1)
  })

  it('no deja borrar una cuenta con movimientos: para eso está archivar', async () => {
    const cats = await conCategorias()
    const cuenta = await guardarCuenta(base, USUARIO, {
      nombre: 'Efectivo',
      tipo: 'EFECTIVO',
      saldo_inicial: 0,
    })
    if (!cuenta.ok) throw new Error('no se creó la cuenta')

    await guardarTransaccion(base, USUARIO, {
      id_cuenta: cuenta.id,
      id_categoria: cats.get('Almuerzo')!.id,
      tipo: 'GASTO',
      monto: 450,
      fecha: '2026-09-02',
    })

    const r = await borrarCuenta(base, cuenta.id)
    expect(r.ok).toBe(false)

    await archivarCuenta(base, cuenta.id)
    const cuentas = await listarCuentas(base)
    expect(cuentas[0]?.archivada).toBe(true)
    // Archivar no toca el historial.
    expect(await listarTransacciones(base)).toHaveLength(1)
  })

  it('archivar una categoría se lleva sus subcategorías', async () => {
    const cats = await conCategorias()
    const comida = cats.get('Comida')!

    const uso = await usoDeCategoria(base, comida.id)
    expect(uso.hijas).toBe(4)

    await archivarCategoria(base, comida.id)
    const vivas = await listarCategorias(base)
    expect(vivas.find((c) => c.id === comida.id)).toBeUndefined()
    expect(vivas.find((c) => c.nombre === 'Almuerzo')).toBeUndefined()
    // Pero las de otra rama siguen.
    expect(vivas.find((c) => c.nombre === 'Bus')).toBeDefined()
  })
})

describe('categorías', () => {
  it('impide colgar una subcategoría de un padre de otro tipo', async () => {
    const cats = await conCategorias()
    const r = await guardarCategoria(base, USUARIO, {
      nombre: 'Uber',
      tipo: 'GASTO',
      id_padre: cats.get('Sueldo')!.id,
    })
    expect(r.ok).toBe(false)
  })

  it('impide cambiar el tipo de una categoría con subcategorías', async () => {
    const cats = await conCategorias()
    const r = await guardarCategoria(base, USUARIO, {
      id: cats.get('Comida')!.id,
      nombre: 'Comida',
      tipo: 'INGRESO',
      id_padre: null,
    })
    expect(r.ok).toBe(false)
  })
})

describe('semilla y demo', () => {
  it('la semilla deja un árbol de dos niveles utilizable', async () => {
    const filas = await sembrarCategorias(base, USUARIO)
    expect(filas.length).toBeGreaterThan(30)
    // Ningún nieto: el árbol es de dos niveles.
    const porId = new Map(filas.map((c) => [c.id, c]))
    for (const c of filas) {
      if (c.id_padre === null) continue
      expect(porId.get(c.id_padre)?.id_padre).toBeNull()
      // Y la hija hereda el tipo del padre.
      expect(porId.get(c.id_padre)?.tipo).toBe(c.tipo)
    }
  })

  it('el demo genera seis meses de datos coherentes', async () => {
    await sembrarDemo(base, USUARIO, '2026-09-02')

    const cuentas = await base.cuentas.toArray()
    const trx = await listarTransacciones(base)

    expect(cuentas).toHaveLength(4)
    expect(trx.length).toBeGreaterThan(400)

    // Ninguna transacción con fecha futura.
    expect(trx.every((t) => t.fecha <= '2026-09-02')).toBe(true)

    // Toda transferencia tiene destino distinto y ninguna categoría.
    const transf = trx.filter((t) => t.tipo === 'TRANSFERENCIA')
    expect(transf.length).toBeGreaterThan(0)
    expect(
      transf.every(
        (t) =>
          t.id_categoria === null &&
          t.id_cuenta_destino !== null &&
          t.id_cuenta_destino !== t.id_cuenta,
      ),
    ).toBe(true)

    // Todo ingreso y gasto lleva categoría del mismo tipo.
    const cats = new Map((await listarCategorias(base)).map((c) => [c.id, c]))
    for (const t of trx) {
      if (t.tipo === 'TRANSFERENCIA') continue
      expect(t.id_categoria).not.toBeNull()
      expect(cats.get(t.id_categoria!)?.tipo).toBe(t.tipo)
    }

    // El saldo total sale positivo: un demo en rojo se ve mal y además
    // no es lo que quiero mostrar.
    expect(saldoTotal(saldos(cuentas, trx))).toBeGreaterThan(0)

    // Y el mes corriente tiene movimiento suficiente para que el
    // resumen no se vea vacío.
    expect(totalesDelMes(trx, '2026-09-02').movimientos).toBeGreaterThan(0)
  })

  it('el demo es determinista: la misma fecha da el mismo dataset', async () => {
    const otra = new BaseLocal('prueba_demo_2')
    await otra.open()
    await sembrarDemo(base, USUARIO, '2026-09-02')
    await sembrarDemo(otra, USUARIO, '2026-09-02')

    // Los ids sí cambian entre corridas (son UUID aleatorios) y Dexie
    // devuelve por clave primaria, así que se compara el contenido
    // ordenado, que es lo que el reseteo nocturno tiene que reproducir.
    const huella = (t: Awaited<ReturnType<typeof listarTransacciones>>) =>
      t
        .map((x) => `${x.fecha}|${x.tipo}|${x.monto}|${x.descripcion ?? ''}`)
        .sort()

    expect(huella(await listarTransacciones(base))).toEqual(
      huella(await listarTransacciones(otra)),
    )

    otra.close()
    await borrarBaseDe('prueba_demo_2')
  })

  it('el demo no deja nada encolado en el outbox', async () => {
    await sembrarDemo(base, USUARIO, '2026-09-02')
    expect(await contarPendientes(base)).toBe(0)
  })
})
