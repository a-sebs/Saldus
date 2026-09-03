/**
 * Usuario demo — seis meses de datos plausibles para Ecuador en USD.
 *
 * Es lo primero que ve alguien que abre esto desde mi portafolio, así
 * que los datos tienen que resistir una mirada: almuerzos de tres
 * dólares entre semana, pasajes de setenta centavos, el arriendo el día
 * 3, el sueldo a fin de mes y la tarjeta pagada con una transferencia.
 * Un generador aleatorio sin forma se nota enseguida.
 *
 * El generador es **determinista** (PRNG con semilla fija): la misma
 * fecha produce siempre el mismo dataset. Eso es lo que hace posible el
 * reseteo nocturno de la Fase 2, que tiene que devolver el demo a un
 * estado conocido y no a uno cualquiera.
 */

import type { BaseLocal } from './db.ts'
import { sembrarCategorias } from './semilla.ts'
import { ahora, diasDelMes, hoy, sumarDias, sumarMeses } from '../dominio/fechas.ts'
import { nuevoId } from '../dominio/ids.ts'
import type {
  Categoria,
  Centavos,
  Cuenta,
  FechaContable,
  TipoTransaccion,
  Transaccion,
  UUID,
} from '../dominio/tipos.ts'

const MESES_DE_HISTORIAL = 6

/** PRNG con semilla (mulberry32): reproducible y sin dependencias. */
function generador(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function sembrarDemo(
  base: BaseLocal,
  idUsuario: UUID,
  hoyStr: FechaContable = hoy(),
): Promise<void> {
  const azar = generador(20260902)
  const t = ahora()

  /* --- Cuentas ---------------------------------------------------- */
  const cuentas: Cuenta[] = [
    crearCuenta(idUsuario, 'Efectivo', 'EFECTIVO', 4500, t),
    crearCuenta(idUsuario, 'Banco Pichincha', 'DEBITO', 82000, t),
    crearCuenta(idUsuario, 'Ahorros', 'DEBITO', 150000, t),
    crearCuenta(idUsuario, 'Visa', 'CREDITO', 0, t),
  ]
  const [efectivo, banco, ahorros, visa] = cuentas as [Cuenta, Cuenta, Cuenta, Cuenta]

  /* --- Categorías -------------------------------------------------- */
  const categorias = await sembrarCategorias(base, idUsuario)
  const cat = (nombre: string): UUID => {
    const c = categorias.find((x: Categoria) => x.nombre === nombre)
    if (!c) throw new Error(`Falta la categoría de semilla: ${nombre}`)
    return c.id
  }

  /* --- Transacciones ----------------------------------------------- */
  const trx: Transaccion[] = []

  /**
   * La descripción va en `null` cuando solo repetiría el nombre de la
   * categoría: nadie escribe "Almuerzo" en el detalle de un almuerzo, y
   * la fila de la lista quedaría diciendo la misma palabra dos veces.
   */
  const nueva = (
    tipo: TipoTransaccion,
    fecha: FechaContable,
    monto: Centavos,
    idCuenta: UUID,
    idCategoria: UUID | null,
    descripcion: string | null,
    idDestino: UUID | null = null,
  ) => {
    trx.push({
      id: nuevoId(),
      id_usuario: idUsuario,
      id_cuenta: idCuenta,
      id_cuenta_destino: idDestino,
      id_categoria: idCategoria,
      tipo,
      monto,
      fecha,
      descripcion,
      // `creado_en` acompaña al día contable: el demo simula una app
      // usada a diario, no una carga masiva de ayer.
      creado_en: `${fecha}T${String(12 + Math.floor(azar() * 9)).padStart(2, '0')}:${String(
        Math.floor(azar() * 60),
      ).padStart(2, '0')}:00.000Z`,
      actualizado_en: t,
      eliminado_en: null,
    })
  }

  const entre = (min: Centavos, max: Centavos): Centavos =>
    min + Math.floor(azar() * (max - min + 1))

  const primerMes = sumarMeses(hoyStr, -(MESES_DE_HISTORIAL - 1))

  for (let m = 0; m < MESES_DE_HISTORIAL; m++) {
    const inicioMes = sumarMeses(primerMes, m)
    const ultimoDia = diasDelMes(inicioMes)

    /* Fijos del mes */
    const dia = (n: number): FechaContable =>
      sumarDias(inicioMes, Math.min(n, ultimoDia) - 1)

    // Sueldo el último día del mes.
    if (dia(ultimoDia) <= hoyStr) {
      nueva('INGRESO', dia(ultimoDia), 115000, banco.id, cat('Sueldo'), 'Sueldo del mes')
    }
    if (dia(3) <= hoyStr) {
      nueva('GASTO', dia(3), 32000, banco.id, cat('Arriendo'), null)
    }
    if (dia(8) <= hoyStr) {
      nueva('GASTO', dia(8), 2700, banco.id, cat('Internet'), 'Internet fibra')
    }
    if (dia(12) <= hoyStr) {
      nueva('GASTO', dia(12), entre(1500, 3200), banco.id, cat('Luz'), 'Planilla de luz')
      nueva('GASTO', dia(12), entre(850, 1450), banco.id, cat('Agua'), 'Planilla de agua')
    }
    if (dia(14) <= hoyStr) {
      nueva('GASTO', dia(14), 999, visa.id, cat('Suscripciones'), 'Streaming')
    }

    // Retiros de efectivo: transferencias, no gastos.
    for (const d of [5, 18]) {
      if (dia(d) <= hoyStr) {
        nueva('TRANSFERENCIA', dia(d), 10000, banco.id, null, 'Retiro en cajero', efectivo.id)
      }
    }
    // Pago de la tarjeta y ahorro mensual: tampoco son gasto.
    if (dia(ultimoDia - 2) <= hoyStr) {
      const consumo = trx
        .filter((x) => x.id_cuenta === visa.id && x.fecha.startsWith(inicioMes.slice(0, 7)))
        .reduce((s, x) => s + x.monto, 0)
      if (consumo > 0) {
        nueva('TRANSFERENCIA', dia(ultimoDia - 2), consumo, banco.id, null, 'Pago Visa', visa.id)
      }
      nueva('TRANSFERENCIA', dia(ultimoDia - 2), 20000, banco.id, null, 'Ahorro del mes', ahorros.id)
    }

    /* Día a día */
    for (let d = 1; d <= ultimoDia; d++) {
      const fecha = dia(d)
      if (fecha > hoyStr) break

      const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay()
      const laborable = diaSemana >= 1 && diaSemana <= 5

      if (laborable) {
        nueva('GASTO', fecha, entre(300, 450), efectivo.id, cat('Almuerzo'), null)
        // Dos pasajes de bus: el gasto hormiga por excelencia.
        nueva('GASTO', fecha, 70, efectivo.id, cat('Bus'), 'Pasajes')
        if (azar() < 0.45) {
          nueva('GASTO', fecha, entre(100, 275), efectivo.id, cat('Café y snacks'), null)
        }
        if (azar() < 0.12) {
          nueva('GASTO', fecha, entre(250, 600), efectivo.id, cat('Taxi'), null)
        }
      } else {
        if (azar() < 0.7) {
          nueva('GASTO', fecha, entre(1200, 3800), visa.id, cat('Salidas'), null)
        }
        if (azar() < 0.3) {
          nueva('GASTO', fecha, entre(500, 1500), efectivo.id, cat('Restaurantes'), null)
        }
      }

      // Supermercado los sábados.
      if (diaSemana === 6 && azar() < 0.85) {
        nueva('GASTO', fecha, entre(3500, 7200), visa.id, cat('Supermercado'), null)
      }

      // Ocasionales
      if (azar() < 0.05) {
        nueva('GASTO', fecha, entre(450, 2800), efectivo.id, cat('Farmacia'), null)
      }
      if (azar() < 0.03) {
        nueva('GASTO', fecha, entre(1800, 6500), visa.id, cat('Ropa'), null)
      }
      if (azar() < 0.02) {
        nueva('GASTO', fecha, entre(1200, 4000), efectivo.id, cat('Regalos'), null)
      }
      if (azar() < 0.04) {
        nueva('INGRESO', fecha, entre(4000, 25000), banco.id, cat('Trabajos extra'), 'Trabajo extra')
      }
    }
  }

  await base.transaction('rw', base.cuentas, base.transacciones, base.outbox, async () => {
    await base.cuentas.bulkPut(cuentas)
    await base.transacciones.bulkPut(trx)
    // El demo no se sincroniza: es un dataset local de exhibición y
    // encolarlo llenaría el indicador de pendientes de ruido.
    await base.outbox.clear()
  })
}

function crearCuenta(
  idUsuario: UUID,
  nombre: string,
  tipo: Cuenta['tipo'],
  saldoInicial: Centavos,
  t: string,
): Cuenta {
  return {
    id: nuevoId(),
    id_usuario: idUsuario,
    nombre,
    tipo,
    saldo_inicial: saldoInicial,
    moneda: 'USD',
    archivada: false,
    creado_en: t,
    actualizado_en: t,
    eliminado_en: null,
  }
}
