/**
 * Preparación del entorno de pruebas.
 *
 * `fake-indexeddb/auto` instala un IndexedDB en memoria sobre el objeto
 * global, de modo que Dexie funciona en Node sin navegador. Se carga
 * aquí y no en cada prueba para que ninguna se olvide.
 */
import 'fake-indexeddb/auto'
