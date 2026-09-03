# Sistema de diseño — Saldus

> Contrato visual de la app. Ninguna pantalla escribe un color, un tamaño
> ni un espaciado a mano: todo sale de `web/src/estilos/tokens.css`.
> Si algo no se puede construir con estos tokens, se discute el token,
> no se mete un hex suelto.

---

## 1. La materia

Estoy digitalizando **un libro contable**, no construyendo un panel de
SaaS. Un libro contable tiene: renglones rayados, una columna de cifras
alineada a la derecha, saldos corridos, y las entradas agrupadas bajo la
fecha escrita en el margen. Esa es la forma que debe tener la app.

El contexto de uso manda tanto como la materia: **una mano, de pie, en la
fila de la caja.** Todo lo que exija precisión de dos dedos, lectura
pausada o apuntar a algo pequeño, está mal.

De ahí salen tres consecuencias que atraviesan todo el sistema:

1. **No hay tarjetas.** El contenido se apoya directamente sobre el
   papel y se separa con reglas de un píxel, como el rayado impreso de
   un libro mayor. Trocear una lista en tarjetas redondeadas idénticas
   es exactamente lo que el brief prohíbe, y además rompe la columna de
   cifras, que es lo único que hace legible una lista de montos.
2. **La columna de dinero es sagrada.** Todas las cifras comparten
   ancho, alineación derecha y `tabular-nums`. El signo ocupa su propia
   celda de ancho fijo, así que una transferencia sin signo alinea
   perfecto con un gasto que sí lo lleva.
3. **El color no decora nunca.** La jerarquía la hacen el peso
   tipográfico, el tamaño y el espacio en blanco.

---

## 2. Color

Una escala neutra de seis pasos y **un solo acento**.

### Escala neutra

Tono base 210°, saturación muy baja y decreciente hacia los claros. Es
un gris con un susurro de azul: el papel de oficina bajo luz fría, no el
gris puro de una plantilla ni el crema de una libreta.

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--neutro-0` | `#F7F8F9` | `#14181C` | Papel. El fondo de la app |
| `--neutro-1` | `#EDEFF2` | `#1C2227` | Superficie hundida: campos, cabecera de grupo, fila seleccionada |
| `--neutro-2` | `#DDE1E6` | `#2A3239` | El rayado. Reglas, bordes, separadores |
| `--neutro-3` | `#AEB6BF` | `#5A656F` | Deshabilitado, marcas de posición |
| `--neutro-4` | `#5B6672` | `#99A3AD` | Texto secundario (categoría, cuenta, fechas) |
| `--neutro-5` | `#1B2229` | `#E8ECEF` | Tinta. Texto principal y cifras |

Contraste verificado: tinta sobre papel 15,2:1; secundario sobre papel
5,5:1 (AA con margen); acento sobre papel 8,9:1. En oscuro, tinta sobre
papel 14,8:1 y acento 7,8:1.

### El acento

`--acento` = **azul Prusia** `#1F4B6B` (claro) / `#7FB2D1` (oscuro).

Es el color de la tinta de pluma, no el azul de producto que sale por
defecto en cualquier framework. Aparece **solo** en cuatro sitios:

- la acción primaria de cada pantalla (un botón por pantalla, no más),
- el estado seleccionado de una opción,
- el anillo de foco de teclado,
- la única serie con significado en un gráfico.

Nada más. Si aparece en un quinto sitio, sobra.

### Ingreso contra gasto

**No hay verde ni rojo.** Un gasto es `−4.50` en peso normal; un ingreso
es `+1,200.00` en semibold. El signo y el peso hacen todo el trabajo, y
funcionan igual para alguien que no distingue rojo de verde.

Las transferencias no son ni lo uno ni lo otro: se muestran **sin signo
y en el gris secundario**, con la segunda línea leyendo "Efectivo a
Banco Pichincha". Quedan visiblemente aparte sin necesidad de un color
propio, y no suman al gasto del mes.

### El único color semántico extra

`--peligro` `#8C2F2A` / `#E0847E`, exclusivamente para la acción de
borrar. Borrar es irreversible desde el punto de vista del usuario
(aunque por dentro sea borrado suave) y merece un color que no se
confunda con nada. No se usa para "gasto", ni para errores de validación
menores, ni para adornar.

### El rayado tiene tinte

Las reglas horizontales llevan el mismo tono 210° de la escala neutra,
no un gris puro. A un píxel de grosor no se percibe el tinte de forma
consciente, pero hace que las líneas parezcan **impresas en el papel**
en vez de dibujadas por CSS encima.

---

## 3. Tipografía

**Una sola familia: la del sistema.** En iPhone eso es SF Pro; en
Android, Roboto; en Windows, Segoe UI.

Es una decisión, no una omisión. Una app local-first que tiene que abrir
en el subterráneo no puede depender de descargar una fuente, y ninguna
webfont mejora lo suficiente como para pagar ese precio. Además SF Pro
tiene de las mejores cifras tabulares que existen y ya está en el
dispositivo.

Escala de **cinco tamaños**, ni uno más:

| Token | Tamaño | Uso |
|---|---|---|
| `--texto-cifra` | 2.5rem (40px) | El monto en la pantalla de captura. Nada más llega a este tamaño |
| `--texto-titulo` | 1.375rem (22px) | Título de pantalla, saldo total |
| `--texto-cuerpo` | 1rem (16px) | Todo el texto corriente y **todos los inputs** |
| `--texto-menor` | 0.875rem (14px) | Texto secundario: categoría, cuenta, cabecera de día |
| `--texto-micro` | 0.75rem (12px) | Contadores y marcas. Nunca para nada que haya que leer para decidir |

16px es el mínimo de todo input: por debajo, iOS hace zoom al enfocar y
el usuario pierde el hilo del formulario.

`font-variant-numeric: tabular-nums` se aplica en `base.css` a la clase
`.cifra` y a `input[inputmode="decimal"]`. **Si en una lista los montos
no alinean verticalmente, es un defecto, no un detalle.**

### Lo que la tipografía NO hace

- Ninguna etiqueta en MAYÚSCULAS con tracking.
- Ninguna monoespaciada para etiquetas pequeñas. Las cifras tabulares ya
  resuelven la alineación; la monoespaciada solo aportaría disfraz de
  terminal.
- Ninguna palabra del título resaltada en otro color o en cursiva.
- Ninguna cadena de metadatos unida con puntos medios (`A · B · C`). Los
  metadatos van en columnas de verdad, que es lo que hace un libro
  contable.

---

## 4. Espaciado

Unidad base **4px**. Nada fuera de esta escala.

`--esp-1` 4 · `--esp-2` 8 · `--esp-3` 12 · `--esp-4` 16 · `--esp-5` 24 ·
`--esp-6` 32 · `--esp-7` 48

`--esp-4` (16px) es el margen lateral de la pantalla y el respiro
vertical por defecto de una fila. `--esp-7` solo separa bloques que son
conceptualmente distintos.

---

## 5. Radio y sombra

El radio tiene **jerarquía real**: dice cuánto flota cada cosa.

| Token | Valor | Qué lo lleva |
|---|---|---|
| `--radio-0` | `0` | Filas, reglas, cabeceras de grupo. El libro contable no tiene esquinas redondeadas |
| `--radio-1` | `3px` | Chips de categoría, campos de texto |
| `--radio-2` | `6px` | Botones |
| `--radio-3` | `14px` | Hoja modal. Lo único que de verdad está por encima del papel |
| `--radio-lleno` | `999px` | Solo el contador de pendientes del indicador de sync |

Sombras: **dos, y solo para lo que flota de verdad.** `--sombra-hoja`
para la hoja modal y `--sombra-menu` para menús emergentes. Debajo de
una fila de lista no va sombra jamás.

---

## 6. Maquetación

Mobile-first, ancho de referencia **390px**. Por encima de 560px el
contenido se centra con ancho máximo: la app no se convierte en un panel
de escritorio con columnas, sigue siendo el mismo libro, más ancho el
margen.

```
┌──────────────────────────────────────┐
│  Movimientos              septiembre │  título + selector de mes
│  Gastado 1,284.50                    │  cifra grande, tabular
│                                      │
├──────────────────────────────────────┤  ← regla fuerte (neutro-2)
│  mar 2 sep                    −48.20 │  ← cabecera de día + subtotal
├──────────────────────────────────────┤  ← regla fina
│  Almuerzo                      −4.50 │  ← línea 1: concepto | monto
│  Comida rápida            Efectivo   │  ← línea 2: categoría | cuenta
├──────────────────────────────────────┤
│  Sueldo                   +1,200.00  │  ingreso: signo + semibold
│  Salario                  Pichincha  │
├──────────────────────────────────────┤
│  Efectivo a Pichincha        200.00  │  transferencia: sin signo, gris
│  Transferencia                       │
├──────────────────────────────────────┤
│                                      │
│  lun 1 sep                    −12.75 │
│  ...                                 │
│                                      │
│        ┌──────────────────┐          │
│        │    Registrar     │          │  acción primaria, tercio inferior
│        └──────────────────┘          │
├──────────────────────────────────────┤
│  Movimientos  Cuentas  Resumen  Ajustes │  nav fija + safe-area
└──────────────────────────────────────┘
```

La segunda línea de cada fila es la clave del sistema: **categoría a la
izquierda, cuenta alineada a la derecha bajo la columna de dinero.** Eso
da dos columnas verdaderas, que es como se leen las cuentas, y evita la
cadena de puntos medios que el brief prohíbe.

### Alcance del pulgar

La barra de navegación va abajo, fija, respetando
`env(safe-area-inset-bottom)`. La acción primaria "Registrar" vive en el
tercio inferior de la pantalla, nunca arriba a la derecha. Todo objetivo
táctil mide **44px como mínimo**, aunque su parte visible sea menor.

Ninguna interacción depende de `:hover`. En un teléfono no existe.

---

## 7. Modo oscuro

Se resuelve **entero en los tokens**, con `prefers-color-scheme`. Ningún
componente conoce el modo en el que está.

El oscuro no es el claro invertido: el papel oscuro (`#14181C`) es un
gris azulado muy bajo, no negro puro, porque el negro puro sobre OLED
produce halos alrededor del texto claro y cansa de noche, que es cuando
uno cuadra las cuentas del día.

---

## 8. Movimiento

Prácticamente no hay. Transiciones de 120ms en cambios de estado de
controles y de 200ms en la entrada de la hoja modal. Nada más se anima,
y todo se apaga bajo `prefers-reduced-motion: reduce`.

Los gráficos **no tienen animación de entrada**: si el número tarda en
llegar a su sitio, no se puede leer de un vistazo.

---

## 9. Prohibiciones explícitas

Copiadas del brief, y ninguna se ha relajado:

- ❌ Fondo crema (~#F4F1EA) con acento terracota (~#D97757).
- ❌ Fondo casi negro con acento verde ácido o bermellón.
- ❌ Trocear el contenido en tarjetas redondeadas idénticas con la misma
  sombra gris suave.
- ❌ Etiquetas en MAYÚSCULAS con tracking sobre cada título.
- ❌ Cadenas de metadatos unidas con puntos medios (`A · B · C`).
- ❌ Flechas `→` pegadas al texto de botones y enlaces.
- ❌ Monoespaciada para etiquetas pequeñas.
- ❌ Resaltar una sola palabra del título en otro color o cursiva.

---

## 10. Autocrítica del plan

El prompt pedía revisar el plan y cambiar toda parte que fuera lo que se
produciría para cualquier app financiera genérica. Esto es lo que cambió
y por qué.

**1. El fondo era crema.** El primer borrador tenía papel `#FAF9F7`, un
blanco cálido. Está a un paso del crema prohibido y, sobre todo, era la
elección obvia: "papel → cálido". Cambiado a un neutro de tono 210°, frío.
El resultado es más honesto con lo que la app es —un registro de oficina,
no un diario personal— y deja al azul Prusia funcionando como tinta sobre
papel en vez de compitiendo con un fondo amarillento.

**2. El acento era azul de producto.** Empecé con un `#2F6FE4` que es el
azul que sale solo en cualquier framework. Cambiado a azul Prusia
`#1F4B6B`: mucho más oscuro y desaturado, se lee como tinta y no como
"botón de app". Baja la tentación de usarlo de adorno, porque en grande
resulta severo.

**3. Verde y rojo para ingreso y gasto.** Era lo primero que escribí y el
brief lo prohíbe con razón: obliga a distinguir dos cifras por color, que
es la peor manera de codificar el dato más importante de la pantalla.
Sustituido por signo más peso tipográfico. Efecto lateral bueno: las
transferencias, que no son ni ingreso ni gasto, dejaron de necesitar un
tercer color y ahora se distinguen por **ausencia** de signo.

**4. Todo iba en tarjetas.** El borrador tenía cada grupo de día en una
tarjeta con `border-radius: 12px` y sombra suave, que es literalmente la
plantilla que el brief nombra. Se eliminaron por completo: filas sobre el
papel separadas por reglas de un píxel. Como efecto lateral, la columna
de montos vuelve a ser una columna real de borde a borde, que es el punto
de todo el sistema.

**5. Radio uniforme.** Tenía 12px en todo. Ahora el radio es una señal de
elevación: 0 para lo que está impreso en el papel, 6px para lo que se
puede pulsar, 14px solo para lo que flota. Un valor repetido en todo no
comunica nada.

**6. Iba a cargar Inter desde Google Fonts.** Es el reflejo automático, y
en una app que debe abrir sin conexión es además un error técnico.
Cambiado a la familia del sistema, que ya está instalada, no parpadea, y
en iOS trae mejores cifras tabulares que la alternativa.

**7. La segunda línea de cada fila era `Comida · Efectivo · 14:32`.** El
brief prohíbe esa cadena, y tenía razón: no se puede escanear una columna
de puntos medios. Ahora son dos columnas alineadas con el resto de la
maquetación, y la hora se eliminó porque nadie decide nada con ella.

**Lo que decidí NO cambiar:** el gris azulado se parece a la paleta
neutra de muchos productos. Es cierto. La diferencia de esta app no la
va a hacer un tinte de fondo exótico, sino la estructura —el rayado, la
columna de cifras, la ausencia de tarjetas— y el aguante de un solo
acento oscuro. Un fondo de color con personalidad habría sido decoración
compitiendo con las cifras, que son lo único que importa aquí.
