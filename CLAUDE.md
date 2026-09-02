# App de finanzas personales — contexto del proyecto

> Este archivo es el contrato de diseño. Las decisiones de abajo ya se
> discutieron y tienen razones. Si algo aquí parece subóptimo, pregunta
> antes de cambiarlo: casi siempre hay un motivo explicado en la misma
> línea.

---

## ⚠️ COMPLETAR ANTES DE EMPEZAR

Dos cosas del stack no están decididas. Rellénalas antes de la primera
sesión de código:

- **Framework frontend:** `[ REACT / VUE / SVELTE / VANILLA ]`
- **Hosting del backend:** `[ RENDER / RAILWAY / FLY / KOYEB ]`

---

## 1. Qué es esto

App web progresiva (PWA) para registrar mis ingresos y gastos
personales desde el celular y ver dashboards de mis hábitos de consumo.

- **Un solo usuario real** (yo) + **un usuario demo** para el portafolio.
- Ecuador, moneda única USD, zona horaria UTC-5 fija sin horario de verano.
- Volumen esperado: ~150 movimientos al mes, ~2.000 filas al año.
  Todo el dataset pesa menos de 1 MB. **Optimiza para simplicidad, no
  para escala.**
- Doble objetivo: que yo la use a diario, y que sirva como proyecto de
  portafolio. Ambos importan.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL en **Neon** (plan gratuito) |
| Migraciones | **Flyway** |
| Backend | **Spring Boot + Java**, JPA/Hibernate |
| Frontend | PWA — Service Worker + IndexedDB |
| Auth | JWT propio (access + refresh) |

---

## 3. Arquitectura: local-first

Esta es la decisión estructural más importante y condiciona todo lo demás.

**IndexedDB en el dispositivo es una réplica completa, no solo una cola
de pendientes.** Todas las lecturas, listados y cálculos de dashboard
salen de IndexedDB. La interfaz **nunca** espera a la red.

- El formulario escribe en IndexedDB y muestra "guardado" de inmediato.
- La sincronización con el backend ocurre después, en segundo plano.
- Si la sincronización falla, no pasa nada: el dato ya está guardado.
  Se muestra un indicador discreto tipo "3 pendientes" y se reintenta.
- El **teléfono es la fuente de verdad para escrituras**. Neon es la
  copia durable y la que sirve al backend.
- Con un solo usuario y un solo dispositivo **no hay conflictos reales**.
  No implementes CRDTs, merges de tres vías ni resolución de conflictos
  sofisticada. Last-write-wins por `actualizado_en` es suficiente.

### Sincronización

- **Los UUID se generan en el cliente**, no en el servidor. Esto hace
  que el POST sea idempotente y se pueda reintentar sin duplicar.
  El endpoint de escritura es un **upsert por id**.
- Patrón outbox: cola de operaciones pendientes en IndexedDB.
- **Disparadores del sync:** al abrir la app (foreground), en el evento
  `window 'online'`, y con un debounce de ~5 segundos después de
  escribir. **No batches diarios** — dejar un día de datos viviendo solo
  en el teléfono es riesgoso (ver §4).
- **Sync delta:** el cliente pide "todo lo que cambió desde
  `actualizado_en > X`". Los índices `*_sync_idx` del esquema existen
  para esto.
- Los registros borrados **también se sincronizan** (borrado suave), el
  cliente necesita enterarse de lo que se borró en otro lado.
- **La Background Sync API es solo de Chromium.** Safari no la soporta y
  tiene posición negativa de estándares. Constrúyela como mejora
  opcional con feature detection; la base es la cola de reintentos en la
  página. Para esta app da igual: uno abre la app justamente para
  registrar un gasto, así que sincronizar al abrir cubre el caso real.

### Por qué no importa el gasto de cómputo

Cada "despertada" de Neon cuesta como máximo 5 min × 0.25 CU ≈ 0.021
CU-hours. Con 100 CU-hours mensuales eso son ~4.800 despertadas al mes.
Sincronizar cada transacción por separado gastaría ~6% del plan. **No
optimices la frecuencia de sincronización.**

---

## 4. Persistencia local frágil

Safari usa desalojo LRU y puede borrar IndexedDB bajo presión de
almacenamiento. Por eso:

- Llamar a `navigator.storage.persist()` al iniciar.
- Empujar la instalación en pantalla de inicio.
- **Nunca dejar datos viviendo solo en el dispositivo por horas.**
- Nombrar la base local por usuario: `finanzas_<uuid_usuario>`, y
  **borrarla al cerrar sesión**. Si no, el usuario demo lee mis
  transacciones reales cacheadas en el mismo navegador.

---

## 5. Restricciones de Neon (plan gratuito) — CRÍTICO

100 CU-hours/mes, 0.5 GB, y el cómputo se suspende tras 5 minutos de
inactividad (no se puede desactivar en el plan gratuito).

**La suspensión ocurre incluso con clientes conectados.** El pool queda
con conexiones muertas. Por lo tanto:

```properties
# Conexiones que mueren solas antes de que Neon las mate
spring.datasource.hikari.max-lifetime=240000
spring.datasource.hikari.minimum-idle=0
spring.datasource.hikari.idle-timeout=60000
spring.datasource.hikari.connection-timeout=30000

# NO habilitar keepalive-time: mantendría el cómputo despierto 24/7
# y quemaría las 100 CU-hours cerca del día 16 de cada mes.

# El health check NO debe tocar la base de datos, por lo mismo.
management.health.db.enabled=false
```

Además:
- Reintento en la primera consulta tras inactividad (cold start de unos
  cientos de milisegundos).
- **Nada de jobs programados que consulten la base periódicamente**, con
  la única excepción del reseteo nocturno del usuario demo.
- Cadena de conexión **directa** para el backend y las migraciones. La
  que lleva `-pooler` es para runtimes serverless.
- SSL obligatorio (`sslmode=require`).

---

## 6. Esquema de base de datos

Está en `src/main/resources/db/migration/V1__esquema_inicial.sql`.
**Léelo antes de escribir entidades JPA.** Puntos que no son obvios:

- **No existe `saldo_actual`.** Hay `saldo_inicial` en `cuentas` y la
  vista `v_saldos` recalcula el saldo vivo. Nunca se desincroniza.
- **Transferencias:** una sola fila con `id_cuenta` (origen) y
  `id_cuenta_destino`. Se eligió sobre el patrón de dos filas para que
  cada transacción sea una unidad atómica de sincronización. La vista
  `v_movimientos` la parte en dos movimientos con signo.
- **FK compuestas:** `categorias` tiene `UNIQUE (id, tipo)` para que la
  FK `(id_padre, tipo) → (id, tipo)` obligue a la subcategoría a heredar
  el tipo del padre. La misma técnica en `transacciones` impide guardar
  un GASTO con categoría de INGRESO. Es una restricción de base de
  datos, no de aplicación. **No la elimines.**
- **Borrado suave en todas partes** (`eliminado_en`). Con sync offline un
  DELETE duro es irrecuperable.
- `actualizado_en` lo mantiene un trigger de Postgres, **no la
  aplicación**. En JPA mapéalo como `@Column(insertable=false,
  updatable=false)` + `@Generated`, o refresca la entidad tras escribir.
- **`fecha` (DATE, día contable) es distinto de `creado_en`
  (TIMESTAMPTZ, cuándo se registró).** Registrar el almuerzo de ayer es
  el caso normal, no la excepción.

### Migraciones

- Flyway desde el primer commit. **Jamás `hibernate.ddl-auto=update`.**
  Usar `validate`.
- Para migraciones destructivas, probarlas primero en un **branch de
  Neon** antes de tocar la rama principal.

---

## 7. Dinero y tipos

- Postgres: `NUMERIC(12,2)`. Java: `BigDecimal`. **Nunca `double`,
  `float` ni `Double`.**
- En JavaScript, manejar montos como **enteros de centavos** y formatear
  solo para mostrar. Si no, aparece `$0.30000000000000004`.
- El signo lo determina `tipo` (INGRESO/GASTO), no el monto. Hay un
  `CHECK (monto > 0)`.
- Moneda fija USD. **No implementes lógica multi-divisa**, el campo
  existe solo por higiene del esquema.

---

## 8. Autenticación

- **Access token** de 15-30 min, en memoria únicamente.
- **Refresh token** de 60-90 días, persistido y **rotado en cada uso**.
- Dónde guardar el refresh:
  - Si frontend y backend comparten dominio raíz (`app.x.com` /
    `api.x.com`): cookie `httpOnly; Secure; SameSite=Lax`. **Preferido.**
  - Si están en dominios distintos: IndexedDB (Safari bloquea cookies de
    terceros).
  - **Nunca localStorage** — el service worker no puede leerlo.

### La regla más importante de auth

**La autenticación protege la sincronización, NO la interfaz.**

Si hay datos locales, la app abre y funciona completa aunque el token
esté vencido o no haya red. Nada de envolver la UI en un guard que
redirija a login. Si haces eso, destruyes el offline que es el punto
central de la app. El login aparece solo la primera vez o si el refresh
fue rechazado explícitamente por el servidor.

### Autorización

**`id_usuario` sale SIEMPRE del contexto de seguridad del backend, nunca
del cuerpo de la petición.** Centralízalo en la capa de servicio para no
depender de acordarse en cada endpoint. Si el cliente manda el id y el
backend confía, cualquiera cambia un UUID y ve mis finanzas reales.

Toda consulta filtra por `id_usuario`. Sin excepción.

---

## 9. Usuario demo

- Botón **"Ver demo"** que hace login automático sin pedir credenciales.
  Nada de usuario/contraseña que haya que copiar a mano.
- Sembrado con ~6 meses de datos plausibles (cuentas, categorías,
  transacciones realistas para Ecuador en USD).
- **Job nocturno que lo resetea** al estado sembrado. Es la única tarea
  programada permitida contra la base (§5).
- Flag `es_demo` en la tabla `usuarios`.

---

## 10. UX de captura — no es opcional

La app muere si registrar un gasto cuesta más esfuerzo que no
registrarlo. **Objetivo: dos toques.**

- Fecha por defecto = hoy.
- Categorías ordenadas por **frecuencia de uso reciente**, no
  alfabéticamente.
- Última cuenta usada preseleccionada.
- `shortcuts` en el manifest para abrir directo el formulario de gasto
  desde el ícono de la pantalla de inicio.
- Montos frecuentes sugeridos.

---

## 11. Orden de construcción

**Fase 1 — Local puro (sin backend).**
CRUD de transacciones, cuentas y categorías funcionando 100% contra
IndexedDB, más la vista de total del mes. Local-first desde el inicio es
más fácil que retrofitearlo después.

**Fase 2 — Backend y sincronización.**
Spring Boot + Neon + Flyway + auth + endpoints de upsert idempotente y
sync delta.

**Fase 3 — Dashboards.**
Calculados localmente sobre IndexedDB. Flujo de caja, variación mensual,
gastos hormiga, 50/30/20.

**Entre la Fase 1 y la 2, usar la app dos semanas con datos reales**
antes de escribir más. Varias suposiciones van a resultar equivocadas.

**Importador de CSV temprano**, para arrancar con historial y que los
dashboards sirvan desde el primer día.

---

## 12. Fuera de alcance (NO implementar todavía)

- Presupuestos, alertas y metas de ahorro.
- Exportación a CSV/Excel.
- Transacciones recurrentes (va en la migración V2).
- Multi-divisa y multi-dispositivo.
- **ETL, star schema, Kimball, tablas de hechos y dimensiones.** Con
  2.000 filas al año, unas vistas SQL bastan. Es sobre-ingeniería.
- Notificaciones push.
- Passkeys / WebAuthn (buena idea, pero después de que funcione).

---

## 13. Respaldos

Neon gratuito tiene retención de historial de solo 24 horas, así que no
hay point-in-time restore como red de seguridad. **Estos son datos
financieros reales.**

GitHub Action semanal que corra `pg_dump` y guarde el resultado. Montar
esto en la Fase 2, no "después".

---

## 14. Resumen de anti-patrones

- ❌ `hibernate.ddl-auto=update`
- ❌ `float`/`double` para dinero
- ❌ `id_usuario` leído del request body
- ❌ Token en localStorage
- ❌ Guard de autenticación bloqueando la UI
- ❌ Borrados duros
- ❌ Hikari `keepalive-time` o health check contra la base
- ❌ Resolución de conflictos compleja
- ❌ Capa de data warehouse
- ❌ Esperar a la red antes de confirmar una escritura al usuario
