# Prompts para la interfaz

Van en orden. **Una pantalla por prompt**, nunca "constrúyeme la interfaz".
El prompt 0 es obligatorio antes que cualquier otro: crea el sistema de
diseño que los demás reutilizan.

Regla general: pide **primero la pantalla estática con datos falsos**, la
revisas, y recién entonces pides que la conectes a IndexedDB. Corregir
maquetación con la lógica ya enredada cuesta el triple.

---

## Prompt 0 — Sistema de diseño

> Antes de escribir cualquier pantalla, crea `DESIGN.md` en la raíz con
> el sistema de diseño de esta app, y un archivo de tokens CSS que todas
> las pantallas importarán. No escribas pantallas todavía.
>
> **Materia:** app de finanzas personales que uso con una mano, de pie,
> en la fila de la caja. El objeto que estoy digitalizando es un libro
> contable: filas, cifras alineadas a la derecha, saldos corridos,
> agrupación por fecha. Que la interfaz se parezca a eso y no a un panel
> de SaaS.
>
> **Color — restricción dura:** una escala neutra de 6 pasos y **un solo
> acento**. El color solo transporta significado, nunca decora. Ingreso y
> gasto se distinguen por el signo y el peso tipográfico, no por
> verde/rojo; si usas tinte semántico que sea muy leve y como refuerzo
> secundario. Nada de degradados, nada de fondos de color, nada de
> ilustraciones. Los gráficos usan la escala neutra más el acento.
>
> **Tipografía:** una sola familia. Escala de 5 tamaños como máximo, en
> proporción coherente. `font-variant-numeric: tabular-nums` en **todas**
> las cifras monetarias, sin excepción: si las columnas de montos no
> alinean verticalmente en una lista, está mal.
>
> **Espaciado:** una unidad base de 4px y una escala derivada de ella.
> Nada de valores sueltos.
>
> **Radio y sombra:** decide un valor de radio y aplícalo con jerarquía
> real, no el mismo a todo. Sombras solo en elementos que flotan de
> verdad (hoja modal, menú). Cero sombras decorativas bajo filas.
>
> **Modo oscuro** vía `prefers-color-scheme`, resuelto en los tokens.
>
> **Prohibido explícitamente:**
> - Fondo crema (~#F4F1EA) con acento terracota (~#D97757).
> - Fondo casi negro con un acento verde ácido o bermellón.
> - Trocear el contenido en tarjetas redondeadas idénticas con la misma
>   sombra gris suave.
> - Etiquetas en MAYÚSCULAS con tracking sobre cada título.
> - Cadenas de metadatos unidas con puntos medios (`A · B · C`).
> - Flechas `→` pegadas al texto de botones y enlaces.
> - Monoespaciada para etiquetas pequeñas.
> - Resaltar una sola palabra del título en otro color o cursiva.
>
> Primero escribe el plan (paleta con hex nombrados, familia y escala
> tipográfica, concepto de maquetación con wireframe ASCII, principios).
> Revísalo: si alguna parte es lo que producirías para cualquier app
> financiera genérica, cámbiala y dime qué cambiaste y por qué. Solo
> entonces escribe los tokens.

---

## Prompt 1 — Armazón y navegación

> Construye el armazón de la app usando los tokens de `DESIGN.md`.
> Mobile-first, ancho de referencia 390px. Datos falsos, sin lógica.
>
> - Navegación inferior fija con cuatro destinos: Movimientos, Cuentas,
>   Resumen, Ajustes.
> - Acción primaria "Registrar" siempre alcanzable con el pulgar, en el
>   tercio inferior de la pantalla.
> - Indicador de estado de sincronización discreto: nada cuando todo está
>   al día; un contador sobrio de pendientes cuando los hay; un aviso
>   claro pero no alarmante cuando no hay conexión. **Sin conexión no es
>   un error**, es un estado normal de esta app: que el tono lo refleje.
> - Respeta `env(safe-area-inset-bottom)` para el notch y la barra de
>   gestos de iOS.
> - Áreas táctiles de 44px mínimo.
> - Ninguna interacción que dependa de hover.

---

## Prompt 2 — Pantalla de captura

Esta es la pantalla que decide si sigo usando la app. Pídela sola.

> Construye la pantalla de registrar un gasto. **Objetivo medible: dos
> toques desde el ícono de la pantalla de inicio hasta el gasto
> guardado.** Todo lo que no sirva a ese objetivo, fuera.
>
> - El monto es el elemento más grande de la pantalla. Teclado numérico
>   directo (`inputmode="decimal"`), foco automático al abrir, sin tener
>   que escribir el símbolo de moneda.
> - Fecha por defecto hoy, en un control secundario que no estorbe pero
>   permita "ayer" en un toque.
> - Categorías ordenadas por frecuencia de uso reciente, **no
>   alfabéticamente**, visibles como opciones directas y no dentro de un
>   desplegable.
> - Última cuenta usada preseleccionada.
> - Descripción opcional y visualmente subordinada.
> - Al guardar: confirmación inmediata y optimista. La escritura va a
>   IndexedDB, **la interfaz nunca espera a la red**. El botón dice
>   "Guardar gasto" y el aviso dice "Gasto guardado".
> - Todos los inputs con `font-size` de 16px o más, para que iOS no haga
>   zoom al enfocarlos.
>
> Muéstrame la maquetación estática primero.

---

## Prompt 3 — Movimientos y detalle

> Construye la lista de movimientos y la pantalla de detalle/edición.
>
> - Filas agrupadas por día, con subtotal del día en el encabezado del
>   grupo.
> - Montos alineados a la derecha con cifras tabulares, columna perfecta.
> - Signo y peso tipográfico distinguen ingreso de gasto.
> - Las transferencias se ven claramente distintas de ingresos y gastos:
>   no son ni lo uno ni lo otro y no deben sumar al gasto del mes.
> - Búsqueda por texto y filtros por rango de fechas, cuenta, categoría y
>   etiqueta.
> - Marca visible en las filas que aún no se han sincronizado.
> - Borrado con confirmación y opción de deshacer. Es borrado suave.
> - Estado vacío que invite a registrar el primer movimiento, no un
>   dibujo con "Aún no hay nada aquí".
> - Virtualiza la lista si supera unos cientos de filas.

---

## Prompt 4 — Cuentas y transferencias

> Construye la pantalla de cuentas y el formulario de transferencia.
>
> - Cada cuenta muestra su saldo vivo, calculado desde los movimientos
>   locales, nunca un campo almacenado.
> - Saldo total sumado arriba, tratando las tarjetas de crédito con el
>   signo correcto.
> - Crear, editar y archivar cuentas. Archivar no borra el historial.
> - Formulario de transferencia con origen y destino, que impida
>   seleccionar la misma cuenta en ambos lados y no pida categoría.
> - Al confirmar, refleja el cambio en ambos saldos de inmediato.

---

## Prompt 5 — Categorías y etiquetas

> Construye la administración de categorías y etiquetas.
>
> - Árbol de dos niveles: categorías y subcategorías. Una subcategoría
>   hereda obligatoriamente el tipo (ingreso o gasto) de su padre; la
>   interfaz no debe permitir siquiera intentar lo contrario.
> - Crear, renombrar, mover entre padres, archivar.
> - Al archivar una categoría con movimientos, explica qué pasa con esos
>   movimientos antes de confirmar.
> - Etiquetas como lista plana simple, con contador de uso.
> - Semilla inicial de categorías razonables para Ecuador en USD, que yo
>   pueda editar por completo.

---

## Prompt 6 — Resumen

Pide los gráficos de a uno o dos, no los cinco juntos.

> Construye la pantalla de resumen. Todos los cálculos salen de
> IndexedDB, sin llamadas a la red. Selector de mes arriba.
>
> - Flujo de caja: ingresos contra gastos a lo largo del mes, para ver en
>   qué momento el saldo se pone crítico.
> - Gasto por categoría raíz, ordenado de mayor a menor.
> - Variación contra el mes anterior, en porcentaje y en dólares.
> - Gastos hormiga: subcategorías con muchas compras pequeñas.
> - Regla 50/30/20 sobre el ingreso del mes.
>
> Los gráficos usan la escala neutra más el único acento. **Sin leyendas
> de colores**: etiqueta los elementos directamente. Sin animación de
> entrada. Legibles a 390px de ancho sin scroll horizontal.
>
> Cada gráfico responde una pregunta concreta: pon esa pregunta como
> título, en lenguaje llano, no "Distribución de gastos".

---

## Prompt 7 — Acceso y primer uso

> Construye el acceso y el onboarding.
>
> - Botón **"Ver demo"** que entra sin pedir credenciales. Es lo primero
>   que ve alguien que abre esto desde mi portafolio.
> - Login normal debajo.
> - Recordatorio: **la autenticación protege la sincronización, no la
>   interfaz.** Si hay datos locales, la app abre completa aunque el
>   token esté vencido o no haya red. No envuelvas la interfaz en un
>   guard que redirija a login.
> - Primer uso: crear la primera cuenta con su saldo inicial, en el menor
>   número de pasos posible.
> - Invitación a instalar en la pantalla de inicio, mostrada en el
>   momento oportuno y no al segundo de entrar. En iOS hay que explicar
>   Compartir → Añadir a inicio, porque no existe prompt automático.

---

## Prompt 8 — Pulido móvil

Este pase corrige lo que casi siempre queda mal en interfaces generadas.

> Revisa toda la interfaz contra esta lista y arregla lo que falle:
>
> - `font-variant-numeric: tabular-nums` en toda cifra monetaria.
> - Inputs con `font-size` ≥16px (evita el zoom de iOS al enfocar).
> - `env(safe-area-inset-*)` en elementos fijos arriba y abajo.
> - Áreas táctiles ≥44px.
> - Acciones primarias dentro del alcance del pulgar.
> - `overscroll-behavior: contain` donde el pull-to-refresh estorbe.
> - `-webkit-tap-highlight-color` definido, no el azul por defecto.
> - Foco de teclado visible en todo elemento interactivo.
> - `prefers-reduced-motion` respetado.
> - Contraste que cumpla AA, verificado también en modo oscuro.
> - Ningún texto cortado con nombres de categoría o cuenta largos.
> - Montos de seis cifras sin romper la maquetación.
> - Sin salto de contenido al cargar.
> - `manifest.json` con `shortcuts` que abran directo el formulario de
>   gasto, íconos maskable y `theme-color` para claro y oscuro.

---

## Prompt 9 — Crítica

> Haz de director de arte y critica la interfaz que construiste como si
> fuera de otro. Enumera lo que se ve genérico o autogenerado, lo que
> añade decoración sin significado y lo que se aleja del concepto de
> libro contable de `DESIGN.md`. Después aplica el consejo de Chanel:
> quita un elemento. Dime cuál quitaste y por qué.
>
> Toma capturas a 390px de ancho para revisarlas si puedes.

---

## Para pegar en cualquier prompt de interfaz

```
Restricciones fijas: mobile-first a 390px. Solo tokens de DESIGN.md,
ningún hex suelto. Escala neutra más un acento; el color solo transporta
significado. Cifras monetarias con tabular-nums. La interfaz nunca espera
a la red: toda escritura confirma de inmediato contra IndexedDB. Sin
conexión es un estado normal, no un error.
```

## Lo que NO hay que escribir en un prompt

- "Minimalista", "limpio", "moderno", "elegante", "profesional".
  Producen siempre la misma plantilla.
- "Que se vea como Revolut / Notion / Linear". Sale una imitación floja.
- "Constrúyeme toda la interfaz". Sale todo mediocre a la vez.
- "Usa buenos colores". Di cuántos y para qué sirve cada uno.
