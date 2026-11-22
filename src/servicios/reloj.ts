// Reloj de la demo: la única fuente de «ahora» (tabla reloj). Tarea 1.5.
// Cada movimiento del reloj es UNA transacción: fija la hora, carga la instantánea, llama a tick y persiste sus efectos.
import { eq } from 'drizzle-orm';
import { cargarInstantanea, leerAcciones, persistirEfectos, tomarTurnoEscritura } from '@/db/instantanea';
import { reloj, type Db } from '@/db/esquema';
import { MIN_SIGUIENTE_EVENTO_POR_DEFECTO } from '@/dominio/constantes';
import { sumarMinutos } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';
import { nombrador } from '@/motor/instantanea';
import { siguienteEvento, tick } from '@/motor/seguimiento';
import type { ContextoServicio } from '@/servicios/contexto';
import { accionAVista } from '@/servicios/registro';
import type { AccionVista, ResultadoTick } from '@/servicios/vistas';

async function leerAhora(db: Db): Promise<Date> {
  const [fila] = await db.select().from(reloj).where(eq(reloj.id, 1));
  if (!fila) throw new ErrorDominio('El reloj de la demo no está inicializado: falta cargar la semilla.');
  return fila.ahora;
}

/** Fija el reloj en `ahora` (sin comprobar nada), ejecuta tick hasta ese instante y persiste lo que produzca. */
async function moverYEjecutarTick(db: Db, ahora: Date): Promise<ResultadoTick> {
  await db.update(reloj).set({ ahora }).where(eq(reloj.id, 1));
  const inst = await cargarInstantanea(db);
  const { accionIds } = await persistirEfectos(db, tick(inst));
  const personas = new Map(inst.personas.map((p) => [p.id, { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area }]));
  const filas = await leerAcciones(db, accionIds);
  const nombres = nombrador(inst); // tick no crea trabajos ni decisiones: la instantánea ya los tiene todos
  const acciones: AccionVista[] = filas.map((a) => accionAVista(a, nombres, personas));
  // Reformas v2. R6a: leerCorreo (servicios/correo.ts) antes del tick, en esta misma transacción (regla 10).
  return { ahora: ahora.toISOString(), acciones, lectura: null };
}

export async function obtenerAhora(ctx: ContextoServicio): Promise<Date> {
  return leerAhora(ctx.db);
}

/** Máximo que el reloj avanza de una vez: 7 días. */
const MAX_MINUTOS_AVANCE = 7 * 24 * 60;

/** Suma `minutos` (0 a 10.080) al reloj y ejecuta tick. Con 0 solo ejecuta tick a la hora actual. */
export async function avanzarReloj(ctx: ContextoServicio, minutos: number): Promise<ResultadoTick> {
  if (!Number.isFinite(minutos) || minutos < 0) {
    throw new ErrorDominio('Los minutos a avanzar deben ser un número no negativo.');
  }
  if (minutos > MAX_MINUTOS_AVANCE) {
    throw new ErrorDominio('El reloj avanza como máximo 7 días (10.080 minutos) de una vez.');
  }
  return ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const ahora = await leerAhora(tx);
    return moverYEjecutarTick(tx, sumarMinutos(ahora, minutos));
  });
}

/**
 * Si a la hora actual queda algo por hacer (pedir estados vencidos, recordar o escalar), lo hace SIN mover el
 * reloj. Si no, va a siguienteEvento (o +30 min si no hay) y ejecuta tick.
 */
export async function irAlSiguienteEvento(ctx: ContextoServicio): Promise<ResultadoTick> {
  return ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    // Solo cierres silenciosos de seguimientos no cuentan: se harán en el tick del destino.
    if (tick(inst).some((e) => e.tipo === 'accion')) return moverYEjecutarTick(tx, inst.ahora);
    const evento = siguienteEvento(inst);
    const destino = evento && evento.getTime() > inst.ahora.getTime() ? evento : sumarMinutos(inst.ahora, MIN_SIGUIENTE_EVENTO_POR_DEFECTO);
    return moverYEjecutarTick(tx, destino);
  });
}

/** Solo pruebas; error si retrocede. Ejecuta tick. */
export async function fijarReloj(ctx: ContextoServicio, ahora: Date): Promise<ResultadoTick> {
  if (Number.isNaN(ahora.getTime())) throw new ErrorDominio('La hora indicada no es válida.');
  return ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const actual = await leerAhora(tx);
    if (ahora.getTime() < actual.getTime()) throw new ErrorDominio('El reloj no puede retroceder.');
    return moverYEjecutarTick(tx, ahora);
  });
}
