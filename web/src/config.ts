/**
 * Interruptores de la app.
 */

/**
 * Si existe un backend contra el que sincronizar.
 *
 * En la Fase 1 es `false` a propósito, y de eso depende el indicador de
 * sincronización. Con la cola de salida escribiéndose desde el primer
 * día pero nadie drenándola, un contador de "pendientes" mostraría el
 * total histórico de movimientos y diría algo falso y alarmante. La app
 * dice la verdad: los datos viven solo en este dispositivo.
 *
 * La Fase 2 pone esto en `true` y el indicador empieza a significar lo
 * que su nombre dice, sin tocar ninguna pantalla.
 */
export const HAY_BACKEND = false

/** Nombre visible del producto. */
export const NOMBRE_APP = 'Saldus'
