// Puente entre la base y el motor. Tarea 1.5.
//
// Convenciones de persistirEfectos (las usan las tareas 2.3, 3.x y 4.x):
//  - Los efectos se aplican EN ORDEN. `en` de las notas y de los eventos derivados = reloj.ahora de la base.
//  - Eventos derivados (no hace falta emitir un efecto `evento` para ellos), con actor = el `actorId`/`autorId` del efecto:
//      crear_trabajo      → trabajo_creado
//      actualizar_trabajo → estado_cambiado (si cambia el estado) y plazo_cambiado (si cambia el plazo)
//      agregar_nota       → nota_agregada
//      actualizar_repuesto→ existencia_corregida (si cambia la existencia) y faltante_reportado (si se marca el faltante)
//    Todos los demás eventos (decision_creada, decision_aprobada, decision_rechazada, respuesta_seguimiento…)
//    se emiten con un efecto `evento` explícito.
//  - Un efecto `accion` inserta la acción y, si trae `aviso`, su aviso (personaId = destinatario de la acción).
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  acciones,
  avisos,
  decisiones,
  dependencias,
  eventos,
  necesidadesRepuesto,
  notas,
  opcionesDecision,
  personas,
  proyectos,
  reloj,
  repuestos,
  seguimientos,
  trabajos,
  type CambioFechaJson,
  type Db,
  type LineaOpcionJson,
} from '@/db/esquema';
import { ErrorDominio } from '@/dominio/tipos';
import type { EventoNuevo, OpcionCalculada, TipoEvento } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

/** Orden natural de ids tipo 'S2' < 'S10' (por longitud y luego texto). */
function porIdNatural<T extends { id: string }>(a: T, b: T): number {
  return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Lee todo lo que necesita el motor (incluido reloj.ahora y las opciones de cada decisión). */
/** Clave del cerrojo que serializa las mutaciones (cualquier entero fijo; solo lo usa Nexo). */
const CLAVE_TURNO_ESCRITURA = 20261125;

/**
 * Llamar al empezar la transacción de una mutación, ANTES de cargarInstantanea: espera a que termine cualquier otra
 * mutación en curso (cerrojo de Postgres que se suelta al cerrar la transacción). Así dos capturas a la vez con
 * `DATABASE_URL` no calculan el mismo id (T31, D01…) ni aprueban dos veces la misma decisión. En PGlite, que ya
 * serializa las consultas, no cambia nada.
 */
export async function tomarTurnoEscritura(tx: Db): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${CLAVE_TURNO_ESCRITURA})`);
}

export async function cargarInstantanea(db: Db): Promise<Instantanea> {
  const [filaReloj] = await db.select().from(reloj).where(eq(reloj.id, 1));
  if (!filaReloj) throw new ErrorDominio('El reloj de la demo no está inicializado: falta cargar la semilla.');

  // Personas y proyectos nunca se modifican: se leen en el orden de la semilla (inserción).
  const filasPersonas = await db.select().from(personas);
  const filasProyectos = await db.select().from(proyectos);
  const filasTrabajos = await db.select().from(trabajos);
  const filasDependencias = await db.select().from(dependencias);
  const filasRepuestos = await db.select().from(repuestos);
  const filasNecesidades = await db.select().from(necesidadesRepuesto);
  const filasSeguimientos = await db.select().from(seguimientos);
  const filasDecisiones = await db.select().from(decisiones);
  const filasOpciones = await db.select().from(opcionesDecision);

  const opcionesPorDecision = new Map<string, OpcionCalculada[]>();
  for (const o of [...filasOpciones].sort((a, b) => (a.letra < b.letra ? -1 : a.letra > b.letra ? 1 : 0))) {
    const opcion: OpcionCalculada = {
      letra: o.letra,
      descripcion: o.descripcion,
      costo: o.costo,
      lineas: o.lineas.map((l) => ({ ...l, llegada: new Date(l.llegada) })),
      cambiosFecha: o.cambiosFecha.map((c) => ({ trabajoId: c.trabajoId, de: new Date(c.de), a: new Date(c.a) })),
      consecuencia: o.consecuencia,
    };
    const lista = opcionesPorDecision.get(o.decisionId);
    if (lista) lista.push(opcion);
    else opcionesPorDecision.set(o.decisionId, [opcion]);
  }

  return {
    ahora: filaReloj.ahora,
    personas: filasPersonas,
    proyectos: filasProyectos,
    trabajos: [...filasTrabajos].sort(porIdNatural),
    dependencias: filasDependencias,
    repuestos: [...filasRepuestos].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), // alfabético: sus existencias cambian y el orden físico no es estable
    necesidades: filasNecesidades,
    seguimientos: [...filasSeguimientos].sort(porIdNatural),
    decisiones: [...filasDecisiones].sort(porIdNatural).map((d) => ({ ...d, opciones: opcionesPorDecision.get(d.id) ?? [] })),
  };
}

function aLineasJson(o: OpcionCalculada): LineaOpcionJson[] {
  return o.lineas.map((l) => ({ ...l, llegada: l.llegada.toISOString() }));
}

function aCambiosJson(o: OpcionCalculada): CambioFechaJson[] {
  return o.cambiosFecha.map((c) => ({ trabajoId: c.trabajoId, de: c.de.toISOString(), a: c.a.toISOString() }));
}

function iso(v: unknown): unknown {
  return v instanceof Date ? v.toISOString() : v;
}

/** Persiste los efectos en orden. Llamar dentro de la transacción del servicio. Devuelve los ids de las acciones creadas. */
export async function persistirEfectos(db: Db, efectos: Efecto[]): Promise<{ accionIds: number[] }> {
  const accionIds: number[] = [];
  if (efectos.length === 0) return { accionIds };

  const [filaReloj] = await db.select().from(reloj).where(eq(reloj.id, 1));
  if (!filaReloj) throw new ErrorDominio('El reloj de la demo no está inicializado: falta cargar la semilla.');
  const ahora = filaReloj.ahora;

  const evento = async (
    tipo: TipoEvento,
    actorId: string | null,
    trabajoId: string | null,
    datos: Record<string, unknown>,
    decisionId: string | null = null,
  ): Promise<void> => {
    const fila: EventoNuevo = { en: ahora, actorId, tipo, trabajoId, decisionId, datos };
    await db.insert(eventos).values(fila);
  };

  for (const e of efectos) {
    switch (e.tipo) {
      case 'crear_trabajo': {
        await db.insert(trabajos).values(e.trabajo);
        if (e.necesidades.length > 0) await db.insert(necesidadesRepuesto).values(e.necesidades);
        await evento('trabajo_creado', e.actorId, e.trabajo.id, {
          titulo: e.trabajo.titulo,
          proyectoId: e.trabajo.proyectoId,
          responsableId: e.trabajo.responsableId,
        });
        break;
      }
      case 'actualizar_trabajo': {
        const [antes] = await db.select().from(trabajos).where(eq(trabajos.id, e.trabajoId));
        if (!antes) throw new ErrorDominio(`No existe el trabajo ${e.trabajoId}.`);
        await db.update(trabajos).set(e.cambios).where(eq(trabajos.id, e.trabajoId));
        const { estado, plazo } = e.cambios;
        if (estado !== undefined && estado !== antes.estado) {
          await evento('estado_cambiado', e.actorId, e.trabajoId, { de: antes.estado, a: estado });
        }
        if (plazo !== undefined && plazo.getTime() !== antes.plazo.getTime()) {
          await evento('plazo_cambiado', e.actorId, e.trabajoId, { de: iso(antes.plazo), a: iso(plazo) });
        }
        break;
      }
      case 'agregar_nota': {
        await db.insert(notas).values({ trabajoId: e.trabajoId, autorId: e.autorId, en: ahora, texto: e.texto });
        await evento('nota_agregada', e.autorId, e.trabajoId, { texto: e.texto });
        break;
      }
      case 'actualizar_repuesto': {
        const [antes] = await db.select().from(repuestos).where(eq(repuestos.id, e.repuestoId));
        if (!antes) throw new ErrorDominio(`No existe el repuesto ${e.repuestoId}.`);
        await db.update(repuestos).set(e.cambios).where(eq(repuestos.id, e.repuestoId));
        const { existencia, faltanteReportadoEn } = e.cambios;
        if (existencia !== undefined && existencia !== antes.existencia) {
          await evento('existencia_corregida', e.actorId, null, { repuestoId: e.repuestoId, de: antes.existencia, a: existencia });
        }
        if (faltanteReportadoEn) {
          await evento('faltante_reportado', e.actorId, null, { repuestoId: e.repuestoId });
        }
        break;
      }
      case 'actualizar_necesidad': {
        await db
          .update(necesidadesRepuesto)
          .set(e.cambios)
          .where(and(eq(necesidadesRepuesto.trabajoId, e.trabajoId), eq(necesidadesRepuesto.repuestoId, e.repuestoId)));
        break;
      }
      case 'crear_seguimiento': {
        await db.insert(seguimientos).values(e.seguimiento);
        break;
      }
      case 'actualizar_seguimiento': {
        await db.update(seguimientos).set(e.cambios).where(eq(seguimientos.id, e.seguimientoId));
        break;
      }
      case 'crear_decision': {
        const { opciones, ...fila } = e.decision;
        await db.insert(decisiones).values(fila);
        if (opciones.length > 0) {
          await db.insert(opcionesDecision).values(
            opciones.map((o) => ({
              decisionId: fila.id,
              letra: o.letra,
              descripcion: o.descripcion,
              costo: o.costo,
              lineas: aLineasJson(o),
              cambiosFecha: aCambiosJson(o),
              consecuencia: o.consecuencia,
            })),
          );
        }
        break;
      }
      case 'actualizar_decision': {
        await db.update(decisiones).set(e.cambios).where(eq(decisiones.id, e.decisionId));
        break;
      }
      case 'accion': {
        const [fila] = await db.insert(acciones).values(e.accion).returning({ id: acciones.id });
        if (!fila) throw new Error('No se pudo registrar la acción.');
        accionIds.push(fila.id);
        if (e.aviso) {
          await db.insert(avisos).values({ ...e.aviso, accionId: fila.id });
        }
        break;
      }
      case 'evento': {
        await db.insert(eventos).values(e.evento);
        break;
      }
    }
  }
  return { accionIds };
}

/** Lee acciones por id (orden ascendente). Ayudante de los servicios que devuelven AccionVista. */
export async function leerAcciones(db: Db, ids: number[]) {
  if (ids.length === 0) return [];
  const filas = await db.select().from(acciones).where(inArray(acciones.id, ids));
  return filas.sort((a, b) => a.id - b.id);
}
