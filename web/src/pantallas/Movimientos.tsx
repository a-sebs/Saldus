/**
 * Lista de movimientos.
 *
 * Es la pantalla de inicio. Arriba, lo único que uno quiere saber de un
 * vistazo: cuánto lleva gastado el mes. Debajo, el libro.
 *
 * La búsqueda por texto sale del mes seleccionado y recorre todo el
 * historial, porque cuando uno busca "veterinario" no se acuerda de en
 * qué mes fue.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { hoy, primerDiaDelMes } from '../dominio/fechas.ts'
import { delMes, totalesDelMes, vivas } from '../dominio/vistas.ts'
import type { Transaccion, UUID } from '../dominio/tipos.ts'

import { indexar, useDatos } from '../estado/datos.ts'
import { Cabecera } from '../ui/Cabecera.tsx'
import { Chip, FilaChips } from '../ui/Chip.tsx'
import { EstadoVacio } from '../ui/EstadoVacio.tsx'
import { Hoja } from '../ui/Hoja.tsx'
import { IndicadorSync } from '../ui/IndicadorSync.tsx'
import { Monto } from '../ui/Monto.tsx'
import { SelectorMes } from '../ui/SelectorMes.tsx'
import { ListaMovimientos } from './ListaMovimientos.tsx'
import estilos from './Movimientos.module.css'

interface Filtros {
  idCuenta: UUID | null
  idCategoria: UUID | null
  idEtiqueta: UUID | null
}

const SIN_FILTROS: Filtros = { idCuenta: null, idCategoria: null, idEtiqueta: null }

export function Movimientos() {
  const { datos, cargando } = useDatos()
  const navegar = useNavigate()

  const [mes, setMes] = useState(() => primerDiaDelMes(hoy()))
  const [texto, setTexto] = useState('')
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const indices = useMemo(() => indexar(datos), [datos])
  const buscando = texto.trim() !== ''
  const hayFiltros =
    filtros.idCuenta !== null ||
    filtros.idCategoria !== null ||
    filtros.idEtiqueta !== null

  const etiquetasPorTransaccion = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const e of datos.enlacesEtiqueta) {
      const set = mapa.get(e.id_transaccion) ?? new Set<string>()
      set.add(e.id_etiqueta)
      mapa.set(e.id_transaccion, set)
    }
    return mapa
  }, [datos.enlacesEtiqueta])

  const visibles = useMemo(() => {
    // Buscar mira todo el historial; sin búsqueda, manda el mes.
    const base: readonly Transaccion[] = buscando
      ? vivas(datos.transacciones)
      : delMes(datos.transacciones, mes)

    const aguja = texto.trim().toLocaleLowerCase('es')

    return base.filter((t) => {
      if (filtros.idCuenta && t.id_cuenta !== filtros.idCuenta && t.id_cuenta_destino !== filtros.idCuenta) {
        return false
      }
      if (filtros.idCategoria && t.id_categoria !== filtros.idCategoria) return false
      if (
        filtros.idEtiqueta &&
        !etiquetasPorTransaccion.get(t.id)?.has(filtros.idEtiqueta)
      ) {
        return false
      }
      if (!buscando) return true

      const categoria = t.id_categoria ? indices.categoria.get(t.id_categoria) : undefined
      const cuenta = indices.cuenta.get(t.id_cuenta)
      const heno = [t.descripcion ?? '', categoria?.nombre ?? '', cuenta?.nombre ?? '']
        .join(' ')
        .toLocaleLowerCase('es')

      return heno.includes(aguja)
    })
  }, [
    buscando,
    datos.transacciones,
    mes,
    texto,
    filtros,
    indices,
    etiquetasPorTransaccion,
  ])

  const totales = useMemo(() => totalesDelMes(datos.transacciones, mes), [
    datos.transacciones,
    mes,
  ])

  return (
    <>
      <Cabecera
        titulo="Movimientos"
        derecha={<IndicadorSync pendientes={datos.pendientes.size} />}
      >
        {/*
          Aquí había también el balance del mes. Se quitó: esta pantalla
          responde una sola pregunta —cuánto llevo gastado— y una segunda
          cifra al lado obligaba a decidir cuál de las dos mirar. El
          balance responde otra pregunta distinta y está mejor contado en
          Resumen, que ya lo desglosa en entró, salió y queda.
        */}
        <div className={estilos.resumenMes}>
          <SelectorMes mes={mes} onCambiar={setMes} />
          <div className={estilos.total}>
            <span className={estilos.etiquetaTotal}>Gastado</span>
            <Monto centavos={totales.gastos} tamano="titulo" conMoneda />
          </div>
        </div>
      </Cabecera>

      <div className={estilos.busqueda}>
        <input
          className="campo"
          type="search"
          inputMode="search"
          placeholder="Buscar en todo el historial"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar movimientos"
        />
        <button
          type="button"
          className={[estilos.botonFiltros, hayFiltros ? estilos.filtrosActivos : ''].join(' ')}
          onClick={() => setFiltrosAbiertos(true)}
        >
          Filtros
        </button>
      </div>

      {(buscando || hayFiltros) && (
        <p className={estilos.aclaracion}>
          {visibles.length === 0
            ? 'Ningún movimiento coincide.'
            : `${visibles.length} ${visibles.length === 1 ? 'movimiento' : 'movimientos'}${
                buscando ? ' en todo el historial' : ''
              }.`}
        </p>
      )}

      {!cargando && visibles.length === 0 && !buscando && !hayFiltros ? (
        <EstadoVacio
          titulo={
            datos.transacciones.length === 0
              ? 'Anota el primer movimiento'
              : 'Este mes todavía está en blanco'
          }
          accion={{
            texto: 'Registrar un gasto',
            hacer: () => navegar('/registrar?tipo=GASTO'),
          }}
        >
          {datos.transacciones.length === 0
            ? 'El almuerzo de hoy, el pasaje, lo que sea. La app sirve para lo pequeño, que es lo que se olvida.'
            : 'Lo que anotes aquí aparece al instante, con o sin señal.'}
        </EstadoVacio>
      ) : (
        <ListaMovimientos
          transacciones={visibles}
          cuentas={indices.cuenta}
          categorias={indices.categoria}
          pendientes={datos.pendientes}
          onAbrir={(id) => navegar(`/movimiento/${id}`)}
        />
      )}

      <Hoja
        abierta={filtrosAbiertos}
        titulo="Filtrar"
        onCerrar={() => setFiltrosAbiertos(false)}
      >
        <div className={estilos.grupoFiltro}>
          <span className="etiqueta-campo">Cuenta</span>
          <FilaChips>
            {datos.cuentas.map((c) => (
              <Chip
                key={c.id}
                seleccionado={filtros.idCuenta === c.id}
                onClick={() =>
                  setFiltros((f) => ({
                    ...f,
                    idCuenta: f.idCuenta === c.id ? null : c.id,
                  }))
                }
              >
                {c.nombre}
              </Chip>
            ))}
          </FilaChips>
        </div>

        <div className={estilos.grupoFiltro}>
          <span className="etiqueta-campo">Categoría</span>
          <FilaChips>
            {datos.categorias
              .filter((c) => c.id_padre === null)
              .map((c) => (
                <Chip
                  key={c.id}
                  seleccionado={filtros.idCategoria === c.id}
                  onClick={() =>
                    setFiltros((f) => ({
                      ...f,
                      idCategoria: f.idCategoria === c.id ? null : c.id,
                    }))
                  }
                >
                  {c.nombre}
                </Chip>
              ))}
          </FilaChips>
        </div>

        {datos.etiquetas.length > 0 && (
          <div className={estilos.grupoFiltro}>
            <span className="etiqueta-campo">Etiqueta</span>
            <FilaChips>
              {datos.etiquetas.map((e) => (
                <Chip
                  key={e.id}
                  seleccionado={filtros.idEtiqueta === e.id}
                  onClick={() =>
                    setFiltros((f) => ({
                      ...f,
                      idEtiqueta: f.idEtiqueta === e.id ? null : e.id,
                    }))
                  }
                >
                  {e.nombre}
                </Chip>
              ))}
            </FilaChips>
          </div>
        )}

        <div className={estilos.accionesFiltro}>
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => setFiltros(SIN_FILTROS)}
          >
            Quitar filtros
          </button>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => setFiltrosAbiertos(false)}
          >
            Ver resultados
          </button>
        </div>
      </Hoja>
    </>
  )
}
