# Graph Report - Saldus  (2026-09-13)

## Corpus Check
- 81 files · ~53,411 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: .css 24, (none) 3)

## Summary
- 583 nodes · 1708 edges · 20 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.85)
- Token cost: 429,088 input · 0 output

## Community Hubs (Navigation)
- App Shell, Money & Screens
- Local DB, Session & Demo Seed
- Repositories & Domain Rules
- PWA Update, Config & Export
- npm Dependencies
- Design System (DESIGN.md)
- Local Views & Domain Types
- Usage Frequency Ranking
- Date Utilities (UTC-5)
- Render Deployment Pipeline
- CSV Import Parser
- TypeScript Config
- Movimientos Screenshot
- Cuentas Screenshot
- Icon Generator Script
- Captura Screenshot
- Dark Mode Screenshot
- PWA Icon Set
- Resumen Screenshot

## God Nodes (most connected - your core abstractions)
1. `Categoria` - 27 edges
2. `ahora()` - 26 edges
3. `hoy()` - 25 edges
4. `Transaccion` - 24 edges
5. `react` - 23 edges
6. `BaseLocal` - 22 edges
7. `Cuenta` - 21 edges
8. `useDatos()` - 21 edges
9. `useSesion()` - 21 edges
10. `compilerOptions` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Cache-Control: no-cache en sw.js y manifest.webmanifest` --semantically_similar_to--> `Probar la instalación: SW apagado en dev, dev:pwa lo enciende`  [INFERRED] [semantically similar]
  render.yaml → README.md
- `El service worker exige contexto seguro (HTTPS)` --semantically_similar_to--> `Desde el celular hace falta HTTPS para instalar`  [INFERRED] [semantically similar]
  render.yaml → README.md
- `--peligro: único color semántico extra, solo para borrar` --conceptually_related_to--> `Pruebas: 97 de dominio/repositorios (Vitest) + Playwright a 390px`  [AMBIGUOUS]
  DESIGN.md → README.md
- `Despliegue: render.yaml como Blueprint en Render` --conceptually_related_to--> `Workflow: Desplegar`  [AMBIGUOUS]
  README.md → .github/workflows/desplegar.yml
- `Job: verificar-y-desplegar` --references--> `Comandos npm (dev, dev:pwa, test, build, preview, iconos)`  [INFERRED]
  .github/workflows/desplegar.yml → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Flujo de despliegue del frontend (GitHub Actions → Deploy Hook → Render static site)** — _github_workflows_desplegar_desplegar, _github_workflows_desplegar_render_deploy_hook, _github_workflows_desplegar_verificar_antes_de_desplegar, render_saldus, render_autodeploy, readme_despliegue_render [EXTRACTED 1.00]
- **Lenguaje visual del libro contable (sin tarjetas, columna de cifras, color que no decora)** — design_libro_contable, design_sin_tarjetas, design_columna_de_dinero, design_color_no_decora, design_tabular_nums, design_rayado_con_tinte, design_signo_y_peso [EXTRACTED 1.00]
- **Requisitos para que la PWA sea instalable y se actualice (HTTPS, manifest, SW sin caché, rewrite SPA)** — render_contexto_seguro, readme_https_instalacion, readme_instalacion_pwa, web_index_meta_pwa, render_sw_no_cache, render_reescritura_spa [INFERRED 0.85]
- **Flujo de captura de un gasto** — docs_capturas_captura_selector_tipo_gasto_ingreso, docs_capturas_captura_campo_monto, docs_capturas_captura_selector_fecha_rapida, docs_capturas_captura_chips_categoria, docs_capturas_captura_chips_cuenta, docs_capturas_captura_boton_guardar_gasto [EXTRACTED 1.00]
- **Valores por defecto que habilitan la captura en dos toques** — docs_capturas_captura_montos_frecuentes, docs_capturas_captura_selector_fecha_rapida, docs_capturas_captura_chips_categoria, docs_capturas_captura_chips_cuenta, docs_capturas_captura_captura_en_dos_toques [INFERRED 0.85]
- **Calculo del saldo total neto a partir de las cuentas** — docs_capturas_cuentas_saldo_total_en_usd, docs_capturas_cuentas_lista_de_cuentas, docs_capturas_cuentas_saldo_deuda_tarjeta, docs_capturas_cuentas_tipo_de_cuenta [INFERRED 0.85]
- **Navegacion principal de la PWA (cuatro pestanas)** — docs_capturas_cuentas_barra_de_navegacion_inferior, docs_capturas_cuentas_pestana_movimientos, docs_capturas_cuentas_pantalla_cuentas, docs_capturas_cuentas_pestana_resumen, docs_capturas_cuentas_pestana_ajustes [EXTRACTED 1.00]
- **Acciones disponibles en la pantalla Cuentas** — docs_capturas_cuentas_boton_nueva_cuenta, docs_capturas_cuentas_boton_transferir, docs_capturas_cuentas_boton_registrar [EXTRACTED 1.00]
- **Vista mensual de movimientos** — docs_capturas_movimientos_navegador_de_mes, docs_capturas_movimientos_total_gastado_del_mes, docs_capturas_movimientos_lista_agrupada_por_dia [INFERRED 0.85]
- **Navegación por pestañas de la PWA** — docs_capturas_movimientos_pantalla_movimientos, docs_capturas_movimientos_tab_cuentas, docs_capturas_movimientos_tab_resumen, docs_capturas_movimientos_tab_ajustes, docs_capturas_movimientos_barra_de_navegacion_inferior [EXTRACTED 1.00]
- **Filtrado del listado de movimientos** — docs_capturas_oscuro_navegador_de_mes, docs_capturas_oscuro_buscador_historial, docs_capturas_oscuro_boton_filtros, docs_capturas_oscuro_lista_agrupada_por_dia [INFERRED 0.75]
- **Jerarquia de agregacion de montos (fila, dia, mes)** — docs_capturas_oscuro_fila_de_transaccion, docs_capturas_oscuro_subtotal_diario, docs_capturas_oscuro_total_gastado_del_mes [INFERRED 0.85]
- **Vista mensual del resumen** — docs_capturas_resumen_navegador_de_mes, docs_capturas_resumen_totales_del_mes, docs_capturas_resumen_nota_transferencias, docs_capturas_resumen_desglose_por_categoria [INFERRED 0.85]
- **Conjunto de íconos de instalación de la PWA Saldus** — web_public_favicon, web_public_icons_apple_touch_icon, web_public_icons_icono_192, web_public_icons_icono_512, web_public_icons_icono_maskable_512 [INFERRED 0.85]
- **Variantes de tamaño del mismo motivo (192 / 512 / maskable / apple)** — web_public_icons_apple_touch_icon, web_public_icons_icono_192, web_public_icons_icono_512, web_public_icons_icono_maskable_512, web_public_favicon_motivo [INFERRED 0.95]

## Communities (20 total, 0 thin omitted)

### Community 0 - "App Shell, Money & Screens"
Cohesion: 0.07
Nodes (74): dexie-react-hooks, react, react-router-dom, App(), etiquetasDe(), CLAVES, escribirMeta(), leerMeta() (+66 more)

### Community 1 - "Local DB, Session & Demo Seed"
Cohesion: 0.08
Nodes (49): @tanstack/react-virtual, abiertas, baseDe(), BaseLocal, borrarBaseDe(), olvidarBases(), pedirPersistencia(), PREFIJO_BASE (+41 more)

### Community 2 - "Repositories & Domain Rules"
Cohesion: 0.12
Nodes (45): arbolCategorias(), archivarCategoria(), guardarCategoria(), listarCategorias(), restaurarCategoria(), UsoCategoria, usoDeCategoria(), contarPendientes() (+37 more)

### Community 3 - "PWA Update, Config & Export"
Cohesion: 0.06
Nodes (35): HAY_BACKEND, NOMBRE_APP, aCSV(), celda(), fechaCSV(), nombreArchivo(), Contexto, EstadoBusqueda (+27 more)

### Community 4 - "npm Dependencies"
Cohesion: 0.05
Nodes (41): dexie, fake-indexeddb, react-dom, @types/node, @types/react, @types/react-dom, typescript, vite (+33 more)

### Community 5 - "Design System (DESIGN.md)"
Cohesion: 0.09
Nodes (38): Acento único: azul Prusia (#1F4B6B / #7FB2D1), Autocrítica del plan: siete cambios sobre el borrador genérico, El color no decora nunca, La columna de dinero es sagrada, Escala neutra de seis pasos (tono 210°), Espaciado: unidad base 4px (--esp-1..--esp-7), La materia: un libro contable, usado con una mano de pie, Maquetación mobile-first, 390px de referencia (+30 more)

### Community 6 - "Local Views & Domain Types"
Cohesion: 0.10
Nodes (32): EntradaTransaccion, FilaImportada, primerDiaDelMes(), Centavos, FechaContable, FilaResumenMensual, Movimiento, SaldoCuenta (+24 more)

### Community 7 - "Usage Frequency Ranking"
Cohesion: 0.13
Nodes (29): vitest, EntradaCategoria, EntradaCuenta, Plantilla, diasEntre(), cuentaMasUsada(), hijaMasUsada(), hijasPorFrecuencia() (+21 more)

### Community 8 - "Date Utilities (UTC-5)"
Cohesion: 0.21
Nodes (21): aDate(), aFechaUTC(), ayer(), capitalizar(), DESFASE_EC_MINUTOS, diasDelMes(), fechaCorta(), fechaLarga() (+13 more)

### Community 9 - "Render Deployment Pipeline"
Cohesion: 0.12
Nodes (24): Workflow: Desplegar, Filtro de rutas del disparador (web/**, render.yaml, workflow), Secreto RENDER_DEPLOY_HOOK, Verificar (tipos, pruebas, build) antes de desplegar, Job: verificar-y-desplegar, Alcance del pulgar: nav abajo, acción primaria en tercio inferior, 44px, sin hover, Escala tipográfica de cinco tamaños, 16px mínimo en todo input (+16 more)

### Community 10 - "CSV Import Parser"
Cohesion: 0.11
Nodes (20): armar(), CampoDestino, detectarSeparador(), FilaRechazada, huella(), leerFilas(), Mapeo, normalizarFecha() (+12 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+14 more)

### Community 12 - "Movimientos Screenshot"
Cohesion: 0.23
Nodes (14): Barra de navegación inferior, Botón Filtros, Botón Registrar, Buscador en todo el historial, Cuenta Banco Pichincha, Cuenta Efectivo, Fila de movimiento, Lista agrupada por día (+6 more)

### Community 13 - "Cuentas Screenshot"
Cohesion: 0.22
Nodes (13): Barra de navegacion inferior, Boton Nueva cuenta, Boton Registrar, Boton Transferir, Fila de cuenta, Lista de cuentas, Pantalla Cuentas, Pestana Ajustes (+5 more)

### Community 14 - "Icon Generator Script"
Cohesion: 0.21
Nodes (11): AQUI, archivos, BARRAS, crc32(), dibujar(), PAPEL, png(), SALIDA (+3 more)

### Community 15 - "Captura Screenshot"
Cohesion: 0.33
Nodes (11): Barra de navegacion inferior, Boton Guardar gasto, Campo de descripcion opcional, Campo de monto, Captura en dos toques, Chips de categoria, Chips de cuenta, Montos frecuentes sugeridos (+3 more)

### Community 16 - "Dark Mode Screenshot"
Cohesion: 0.35
Nodes (11): Barra de navegacion inferior, Boton Filtros, Boton Registrar, Buscador en todo el historial, Fila de transaccion, Lista agrupada por dia, Modo oscuro, Navegador de mes (+3 more)

### Community 17 - "PWA Icon Set"
Cohesion: 0.46
Nodes (8): favicon.svg (ícono de pestaña), Inversión de color según prefers-color-scheme, Motivo del ícono: lista de movimientos con total, apple-touch-icon.png (pantalla de inicio iOS), icono-192.png (ícono PWA 192px), icono-512.png (ícono PWA 512px), icono-maskable-512.png (ícono PWA maskable), Zona segura de íconos maskable

### Community 18 - "Resumen Screenshot"
Cohesion: 0.52
Nodes (7): Barra de navegación inferior, Botón Registrar, Desglose por categoría (¿En qué se fue el mes?), Navegador de mes, Nota: transferencias no cuentan, Pantalla Resumen (captura), Totales del mes (Entró / Salió / Queda)

## Ambiguous Edges - Review These
- `Workflow: Desplegar` → `Despliegue: render.yaml como Blueprint en Render`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `--peligro: único color semántico extra, solo para borrar` → `Pruebas: 97 de dominio/repositorios (Vitest) + Playwright a 390px`  [AMBIGUOUS]
  DESIGN.md · relation: conceptually_related_to
- `Pantalla Nuevo gasto` → `Barra de navegacion inferior`  [AMBIGUOUS]
  docs/capturas/captura.png · relation: conceptually_related_to
- `Boton Registrar` → `Pestana Movimientos`  [AMBIGUOUS]
  docs/capturas/cuentas.png · relation: conceptually_related_to

## Knowledge Gaps
- **156 isolated node(s):** `AQUI`, `SALIDA`, `TINTA`, `PAPEL`, `BARRAS` (+151 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 174 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Workflow: Desplegar` and `Despliegue: render.yaml como Blueprint en Render`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `--peligro: único color semántico extra, solo para borrar` and `Pruebas: 97 de dominio/repositorios (Vitest) + Playwright a 390px`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Pantalla Nuevo gasto` and `Barra de navegacion inferior`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Boton Registrar` and `Pestana Movimientos`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `App Shell, Money & Screens` to `Local DB, Session & Demo Seed`, `PWA Update, Config & Export`, `npm Dependencies`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `vitest` connect `Usage Frequency Ranking` to `App Shell, Money & Screens`, `Repositories & Domain Rules`, `npm Dependencies`, `Local Views & Domain Types`, `Date Utilities (UTC-5)`, `CSV Import Parser`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `App Shell, Money & Screens` to `PWA Update, Config & Export`, `npm Dependencies`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._