// Captura: frase libre → contexto → IA (propone) → validación → plan → efectos → persistencia. Tarea 2.3.
// La IA se consulta FUERA de la transacción (puede tardar); todo lo que cambia la base va en UNA transacción
// sobre una instantánea recargada dentro de ella. Cada captura deja su fila en `capturas`, también si falla.
import { eq } from 'drizzle-orm';
import { capturas, type Db } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { normalizar } from '@/dominio/texto';
import { ErrorDominio, NoImplementado, type EstadoCaptura } from '@/dominio/tipos';
import { construirContextoCaptura } from '@/ia/contexto';
import { esquemaInterpretacion } from '@/ia/esquema-interpretacion';
import type { Interpretacion } from '@/ia/interprete';
import type { Instantanea } from '@/motor/instantanea';
import { aplicarPlan } from '@/servicios/aplicar';
import type { ContextoServicio } from '@/servicios/contexto';
import { preguntar } from '@/servicios/preguntar';
import { validarInterpretacion } from '@/servicios/validacion';
import type { MetaIA, ResultadoCaptura } from '@/servicios/vistas';

type Contenido = ResultadoCaptura extends infer R ? (R extends unknown ? Omit<R, 'capturaId' | 'ia'> : never) : never;

const META_SIN_IA: MetaIA = { implementacion: 'local', modelo: null, respaldo: false };

interface FilaNueva {
  autorId: string;
  texto: string;
  en: Date;
  meta: MetaIA;
  interpretacion: Interpretacion | null;
}

async function insertarCaptura(db: Db, f: FilaNueva, estado: EstadoCaptura): Promise<number> {
  const [fila] = await db
    .insert(capturas)
    .values({
      autorId: f.autorId,
      texto: f.texto,
      en: f.en,
      implementacion: f.meta.implementacion,
      modelo: f.meta.modelo,
      interpretacion: f.interpretacion,
      estado,
      pregunta: null,
      resultado: null,
    })
    .returning({ id: capturas.id });
  if (!fila) throw new Error('No se pudo registrar la captura.');
  return fila.id;
}

/** Guarda el resultado final en la fila de la captura y lo devuelve. */
async function cerrarCaptura(
  db: Db,
  capturaId: number,
  meta: MetaIA,
  contenido: Contenido,
  interpretacion?: Interpretacion,
): Promise<ResultadoCaptura> {
  const resultado = { capturaId, ia: meta, ...contenido } as ResultadoCaptura;
  await db
    .update(capturas)
    .set({
      estado: contenido.estado,
      pregunta: contenido.estado === 'pregunta' ? contenido.pregunta : null,
      resultado,
      ...(interpretacion ? { interpretacion } : {}),
    })
    .where(eq(capturas.id, capturaId));
  return resultado;
}

/** Valida y aplica una interpretación dentro de la transacción `tx`, sobre la captura ya registrada. */
async function resolverEnTransaccion(
  tx: Db,
  inst: Instantanea,
  interp: Interpretacion,
  autorId: string,
  capturaId: number,
  meta: MetaIA,
): Promise<ResultadoCaptura> {
  const v = validarInterpretacion(inst, interp, autorId);
  if (v.tipo === 'error') return cerrarCaptura(tx, capturaId, meta, { estado: 'error', mensaje: v.mensaje }, interp);
  if (v.tipo === 'pregunta') {
    return cerrarCaptura(tx, capturaId, meta, { estado: 'pregunta', pregunta: v.texto, opciones: v.opciones }, interp);
  }
  const plan = v.plan;
  const r = await aplicarPlan(tx, inst, plan, autorId, capturaId);
  switch (plan.tipo) {
    case 'duplicado': {
      const titulo = inst.trabajos.find((t) => t.id === plan.trabajoId)?.titulo ?? '';
      return cerrarCaptura(tx, capturaId, meta, { estado: 'duplicado', trabajoId: plan.trabajoId, titulo }, interp);
    }
    case 'no_es_trabajo':
      return cerrarCaptura(tx, capturaId, meta, { estado: 'ignorada', motivo: plan.motivo }, interp);
    case 'pregunta':
      // Las preguntas no llegan aquí (capturar las atiende antes); por si acaso, no se aplica nada.
      return cerrarCaptura(tx, capturaId, meta, { estado: 'error', mensaje: 'Esto es una pregunta: hazla en Preguntar.' }, interp);
    default:
      return cerrarCaptura(
        tx,
        capturaId,
        meta,
        {
          estado: 'aplicada',
          resumen: r.resumen,
          trabajosCreados: r.trabajosCreados,
          trabajosActualizados: r.trabajosActualizados,
          decisionId: r.decisionId,
          avisosA: r.avisosA,
        },
        interp,
      );
  }
}

/** Registra una captura fallida en su propia escritura (la transacción que falló ya se deshizo). */
async function registrarError(db: Db, f: FilaNueva, mensaje: string): Promise<ResultadoCaptura> {
  const id = await insertarCaptura(db, f, 'error');
  return cerrarCaptura(db, id, f.meta, { estado: 'error', mensaje });
}

export async function capturar(ctx: ContextoServicio, autorId: string, texto: string): Promise<ResultadoCaptura> {
  const limpio = texto.trim();
  const inicial = await cargarInstantanea(ctx.db);
  const contexto = construirContextoCaptura(inicial, autorId); // ErrorDominio si el autor no existe
  const base = { autorId, texto: limpio, en: inicial.ahora };

  if (limpio === '') {
    return registrarError(ctx.db, { ...base, meta: META_SIN_IA, interpretacion: null }, 'Escribe qué pasó o qué hace falta.');
  }

  // 1. La IA propone (fuera de la transacción).
  let interp: Interpretacion;
  let meta: MetaIA;
  try {
    const r = await ctx.ia.interpretar(limpio, contexto);
    meta = { implementacion: r.implementacion, modelo: r.modelo, respaldo: r.respaldo };
    const comprobada = esquemaInterpretacion.safeParse(r.valor);
    if (!comprobada.success) {
      return registrarError(ctx.db, { ...base, meta, interpretacion: null }, 'No pude interpretar el mensaje. Escríbelo de otra forma.');
    }
    interp = comprobada.data;
  } catch {
    return registrarError(
      ctx.db,
      { ...base, meta: { ...META_SIN_IA, implementacion: ctx.ia.nombre }, interpretacion: null },
      'No pude interpretar el mensaje. Escríbelo de otra forma.',
    );
  }
  const fila: FilaNueva = { ...base, meta, interpretacion: interp };

  // 2. Una pregunta no es un trabajo: se responde con el servicio de preguntas.
  if (interp.tipo === 'pregunta') {
    try {
      const respuesta = await preguntar(ctx, autorId, interp.pregunta);
      const id = await insertarCaptura(ctx.db, fila, 'respuesta');
      return cerrarCaptura(ctx.db, id, meta, { estado: 'respuesta', respuesta });
    } catch (e) {
      if (e instanceof NoImplementado || e instanceof ErrorDominio) {
        return registrarError(ctx.db, fila, 'Entendí una pregunta, pero todavía no puedo responderla desde aquí.');
      }
      throw e;
    }
  }

  // 3. Validación, plan, efectos y persistencia: todo en una transacción.
  try {
    return await ctx.db.transaction(async (tx) => {
      const inst = await cargarInstantanea(tx);
      const capturaId = await insertarCaptura(tx, { ...fila, en: inst.ahora }, 'error');
      return resolverEnTransaccion(tx, inst, interp, autorId, capturaId, meta);
    });
  } catch (e) {
    if (e instanceof ErrorDominio) return registrarError(ctx.db, fila, e.message);
    throw e;
  }
}

/** Aplica la respuesta a la única pregunta pendiente de la interpretación. Devuelve la interpretación completa o un mensaje. */
function completar(inst: Instantanea, interp: Interpretacion, respuesta: string): Interpretacion | string {
  const r = respuesta.trim();
  if (interp.tipo === 'trabajo_nuevo') {
    const n = normalizar(r);
    const persona = inst.personas.find((p) => p.id === r || normalizar(p.nombre) === n);
    if (!persona) return `No reconozco a «${r}». Elige una de las personas propuestas.`;
    return { ...interp, responsableId: persona.id, responsableSeguro: true };
  }
  if (interp.tipo === 'decision') {
    const m = /\d+/.exec(r);
    const cantidad = m ? Number(m[0]) : NaN;
    if (!Number.isInteger(cantidad) || cantidad <= 0) return 'Indica la cantidad con un número mayor que cero.';
    return { ...interp, compra: { ...interp.compra, cantidad } };
  }
  return 'Esta captura no tiene una pregunta pendiente.';
}

/** Responde la única pregunta que hizo Nexo sobre una captura (R9 o cantidad). */
export async function responderCaptura(
  ctx: ContextoServicio,
  capturaId: number,
  respuesta: string,
): Promise<ResultadoCaptura> {
  try {
    return await ctx.db.transaction(async (tx) => {
      const [c] = await tx.select().from(capturas).where(eq(capturas.id, capturaId));
      if (!c) throw new ErrorDominio(`No existe la captura ${capturaId}.`);
      const previo = c.resultado as Partial<ResultadoCaptura> | null;
      const meta: MetaIA = { implementacion: c.implementacion, modelo: c.modelo, respaldo: previo?.ia?.respaldo ?? false };
      const parsed = esquemaInterpretacion.safeParse(c.interpretacion);
      if (c.estado !== 'pregunta' || !parsed.success) {
        return { capturaId, ia: meta, estado: 'error', mensaje: 'Esta captura no tiene una pregunta pendiente.' };
      }
      const inst = await cargarInstantanea(tx);
      const completa = completar(inst, parsed.data, respuesta);
      // Respuesta no válida: la captura sigue esperando su respuesta (no se toca la fila).
      if (typeof completa === 'string') return { capturaId, ia: meta, estado: 'error', mensaje: completa };
      const r = await resolverEnTransaccion(tx, inst, completa, c.autorId, capturaId, meta);
      // R9: una sola pregunta por captura. Si aún faltara algo, no se pregunta otra vez.
      if (r.estado === 'pregunta') throw new ErrorDominio('Con esa respuesta todavía falta información. No creé nada.');
      return r;
    });
  } catch (e) {
    if (e instanceof ErrorDominio) {
      const [c] = await ctx.db.select().from(capturas).where(eq(capturas.id, capturaId));
      const meta: MetaIA = c ? { implementacion: c.implementacion, modelo: c.modelo, respaldo: false } : META_SIN_IA;
      return { capturaId, ia: meta, estado: 'error', mensaje: e.message };
    }
    throw e;
  }
}
