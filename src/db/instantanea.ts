// Puente entre la base y el motor. Tarea 1.5.
//
// Convenciones de persistirEfectos (las usan las tareas 2.3, 3.x y 4.x):
//  - Los efectos se aplican EN ORDEN. `en` de las notas y de los eventos derivados = reloj.ahora de la base.
//  - Eventos derivados (no hace falta emitir un efecto `evento` para ellos), con actor = el `actorId`/`autorId` del efecto:
//      crear_trabajo      → trabajo_creado
//      actualizar_trabajo → estado_cambiado (si cambia el estado) y plazo_cambiado (si cambia el plazo)
//      agregar_nota       → nota_agregada
//      actualizar_repuesto→ existencia_corregida (si cambia la existencia) y faltante_reportado (si se marca el faltante)
//      crear_dependencia  → dependencia_creada (reformas v2)
//      agregar_evidencia  → evidencia_agregada (reformas v2; actor = autor si la fuente no es el correo, si no Nexo)
//    Todos los demás eventos (decision_creada, decision_aprobada, decision_rechazada, respuesta_seguimiento,
//    propuesta_revisada, entrega_registrada, recepcion_confirmada, entrega_rechazada…) se emiten con un efecto
//    `evento` explícito. Cambiar `confirmacion`, `entrega`, `titulo`, `proyectoId` o `numero` no deriva eventos.
//  - Un efecto `accion` inserta la acción y, si trae `aviso`, su aviso (personaId = destinatario de la acción).
//  - registrar_mensajes inserta en mensajes_leidos (una copia repetida es un error: Nexo nunca lee dos veces);
//    registrar_revision inserta en revisiones.
//  - agregar_evidencia: el id provisional (máximo + 1, como aplicarEnMemoria) se traduce al real para los
//    actualizar_evidencia siguientes del mismo lote.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  acciones,
  avisos,
  buzones,
  decisiones,
  dependencias,
  eventos,
  evidencias,
  mensajesLeidos,
  necesidadesRepuesto,
  notas,
  opcionesDecision,
  personas,
  proyectos,
  reloj,
  repuestos,
  revisiones,
  seguimientos,
  trabajos,
  type CambioFechaJson,
  type Db,
  type EntradaRevisionJson,
  type EntregaJson,
  type LineaOpcionJson,
  type ValoresPropuestaJson,
} from '@/db/esquema';
import { ErrorDominio } from '@/dominio/tipos';
import type {
  BuzonConectado,
  EntradaRevision,
  Entrega,
  EventoNuevo,
  MensajeLeido,
  OpcionCalculada,
  RevisionPropuesta,
  TipoEvento,
  Trabajo,
  ValoresPropuesta,
} from '@/dominio/tipos';
import { siguienteIdEvidencia, type Efecto } from '@/motor/efectos';
import { instantaneaVisible, type Instantanea } from '@/motor/instantanea';

/** Orden natural de ids tipo 'S2' < 'S10' (por longitud y luego texto). */
function porIdNatural<T extends { id: string }>(a: T, b: T): number {
  return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

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

/**
 * Lee todo lo que necesita el motor (incluido reloj.ahora y las opciones de cada decisión). Reformas v2: los trabajos
 * descartados van a `descartados` (id, proyecto y número) y sus dependencias, necesidades y seguimientos no se cargan;
 * las evidencias se cargan todas, por id. Es la instantánea COMPLETA: la usan las mutaciones (ver cargarInstantaneaVisible).
 */
export async function cargarInstantanea(db: Db): Promise<Instantanea> {
  const [filaReloj] = await db.select().from(reloj).where(eq(reloj.id, 1));
  if (!filaReloj) throw new ErrorDominio('El reloj de la demo no está inicializado: falta cargar la semilla.');

  // Personas y proyectos nunca se modifican: se leen en el orden de la semilla (inserción).
  const filasPersonas = await db.select().from(personas);
  const filasProyectos = await db.select().from(proyectos);
  const todosTrabajos = (await db.select().from(trabajos)).map(trabajoDesdeFila);
  const descartadosIds = new Set(todosTrabajos.filter((t) => t.confirmacion === 'descartado').map((t) => t.id));
  const vivo = (id: string) => !descartadosIds.has(id);
  const filasTrabajos = todosTrabajos.filter((t) => vivo(t.id));
  const filasDependencias = (await db.select().from(dependencias)).filter((d) => vivo(d.trabajoId) && vivo(d.dependeDeId));
  const filasRepuestos = await db.select().from(repuestos);
  const filasNecesidades = (await db.select().from(necesidadesRepuesto)).filter((n) => vivo(n.trabajoId));
  const filasSeguimientos = (await db.select().from(seguimientos)).filter((s) => vivo(s.trabajoId));
  const filasDecisiones = await db.select().from(decisiones);
  const filasOpciones = await db.select().from(opcionesDecision);
  const filasEvidencias = await db.select().from(evidencias).orderBy(asc(evidencias.id));

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
    evidencias: filasEvidencias,
    descartados: todosTrabajos
      .filter((t) => !vivo(t.id))
      .sort(porIdNatural)
      .map((t) => ({ id: t.id, proyectoId: t.proyectoId, numero: t.numero })),
  };
}

/**
 * La instantánea que ve `personaId` (null = vista general: sin propuestos). Para LEER: vistas, marcas, Preguntar.
 * Las mutaciones usan cargarInstantanea (completa). Ver instantaneaVisible en motor/instantanea.ts.
 */
export async function cargarInstantaneaVisible(db: Db, personaId: string | null): Promise<Instantanea> {
  return instantaneaVisible(await cargarInstantanea(db), personaId);
}

// ─── Conversión fila ↔ dominio de los jsonb con fechas ────────────────────────

type FilaTrabajo = typeof trabajos.$inferSelect;

function entregaDesdeJson(j: EntregaJson | null): Entrega | null {
  return j ? { en: new Date(j.en), porId: j.porId, nota: j.nota, enlace: j.enlace, fuente: j.fuente } : null;
}

function entregaAJson(e: Entrega | null): EntregaJson | null {
  return e ? { en: e.en.toISOString(), porId: e.porId, nota: e.nota, enlace: e.enlace, fuente: e.fuente } : null;
}

function trabajoDesdeFila(f: FilaTrabajo): Trabajo {
  return { ...f, entrega: entregaDesdeJson(f.entrega) };
}

/** Lo que se escribe en `trabajos` (insert o update): `entrega` pasa a ISO. */
function trabajoAFila<T extends { entrega?: Entrega | null }>(t: T): Omit<T, 'entrega'> & { entrega?: EntregaJson | null } {
  if (t.entrega === undefined) return t as Omit<T, 'entrega'>;
  return { ...t, entrega: entregaAJson(t.entrega) };
}

function valoresDesdeJson(j: ValoresPropuestaJson): ValoresPropuesta {
  return { ...j, plazo: j.plazo ? new Date(j.plazo) : null };
}

function valoresAJson(v: ValoresPropuesta): ValoresPropuestaJson {
  return { ...v, plazo: v.plazo ? v.plazo.toISOString() : null };
}

function entradaDesdeJson(j: EntradaRevisionJson): EntradaRevision {
  if ('texto' in j) return { texto: j.texto };
  const { enviado, ...resto } = j;
  return enviado === undefined ? resto : { ...resto, enviado: new Date(enviado) };
}

function entradaAJson(e: EntradaRevision): EntradaRevisionJson {
  if ('texto' in e) return { texto: e.texto };
  const { enviado, ...resto } = e;
  return enviado === undefined ? resto : { ...resto, enviado: enviado.toISOString() };
}

// ─── Lecturas de las tablas nuevas (fuera de la instantánea) ──────────────────

/** Buzones conectados, en el orden de la semilla (inserción). */
export async function cargarBuzones(db: Db): Promise<BuzonConectado[]> {
  return db.select().from(buzones);
}

/** Copias ya leídas, por (enviado, persona, id_internet). */
export async function cargarMensajesLeidos(db: Db): Promise<MensajeLeido[]> {
  return db
    .select()
    .from(mensajesLeidos)
    .orderBy(asc(mensajesLeidos.enviado), asc(mensajesLeidos.personaId), asc(mensajesLeidos.idInternet));
}

/** Claves `${personaId}|${idInternet}` de las copias ya leídas: el `yaLeidos` de planLectura. */
export function claveLeido(personaId: string, idInternet: string): string {
  return `${personaId}|${idInternet}`;
}

export async function cargarClavesLeidas(db: Db): Promise<Set<string>> {
  const filas = await db.select({ personaId: mensajesLeidos.personaId, idInternet: mensajesLeidos.idInternet }).from(mensajesLeidos);
  return new Set(filas.map((f) => claveLeido(f.personaId, f.idInternet)));
}

/** Revisiones humanas, por (en, id). */
export async function cargarRevisiones(db: Db): Promise<RevisionPropuesta[]> {
  const filas = await db.select().from(revisiones).orderBy(asc(revisiones.en), asc(revisiones.id));
  return filas.map((f) => ({
    ...f,
    propuesto: valoresDesdeJson(f.propuesto),
    final: f.final ? valoresDesdeJson(f.final) : null,
    entrada: entradaDesdeJson(f.entrada),
  }));
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

  // Ids provisionales de evidencia (como en aplicarEnMemoria) → ids reales de la base.
  let ultimaEvidencia: number | null = null;
  const idReal = new Map<number, number>();

  for (const e of efectos) {
    switch (e.tipo) {
      case 'crear_trabajo': {
        await db.insert(trabajos).values(trabajoAFila(e.trabajo));
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
        await db.update(trabajos).set(trabajoAFila(e.cambios)).where(eq(trabajos.id, e.trabajoId));
        const { estado, plazo, responsableId } = e.cambios;
        if (responsableId !== undefined && responsableId !== antes.responsableId) {
          await evento('responsable_cambiado', e.actorId, e.trabajoId, { de: antes.responsableId, a: responsableId });
        }
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
      case 'crear_dependencia': {
        await db.insert(dependencias).values(e.dependencia).onConflictDoNothing();
        await evento('dependencia_creada', e.actorId, e.dependencia.trabajoId, { dependeDeId: e.dependencia.dependeDeId });
        break;
      }
      case 'agregar_evidencia': {
        if (ultimaEvidencia === null) {
          const filas = await db.select({ id: evidencias.id }).from(evidencias);
          ultimaEvidencia = siguienteIdEvidencia(filas) - 1;
        }
        ultimaEvidencia += 1;
        const [fila] = await db.insert(evidencias).values(e.evidencia).returning({ id: evidencias.id });
        if (!fila) throw new Error('No se pudo registrar la evidencia.');
        idReal.set(ultimaEvidencia, fila.id);
        const ev = e.evidencia;
        await evento('evidencia_agregada', ev.fuente === 'correo' ? null : ev.autorId, ev.trabajoId, {
          evidenciaId: fila.id,
          tipo: ev.tipo,
          fuente: ev.fuente,
        });
        break;
      }
      case 'actualizar_evidencia': {
        const id = idReal.get(e.evidenciaId) ?? e.evidenciaId;
        await db.update(evidencias).set(e.cambios).where(eq(evidencias.id, id));
        break;
      }
      case 'registrar_mensajes': {
        if (e.mensajes.length > 0) await db.insert(mensajesLeidos).values(e.mensajes);
        break;
      }
      case 'registrar_revision': {
        const r = e.revision;
        await db.insert(revisiones).values({
          ...r,
          propuesto: valoresAJson(r.propuesto),
          final: r.final ? valoresAJson(r.final) : null,
          entrada: entradaAJson(r.entrada),
        });
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
