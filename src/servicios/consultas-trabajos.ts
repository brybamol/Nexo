// Consultas de trabajos con marcas calculadas. Tarea 1.6.
// Las marcas (atrasado, en riesgo) no se guardan: salen de calcularMarcas(instantánea) en cada consulta.
import { asc } from 'drizzle-orm';
import { notas, type Db } from '@/db/esquema';
import { cargarInstantaneaVisible } from '@/db/instantanea';
import type { Marcas, Persona } from '@/dominio/tipos';
import { confianzaDe } from '@/motor/confianza';
import { calcularMarcas } from '@/motor/marcas';
import { cadenaDependientes, nombrador, porId, type Instantanea } from '@/motor/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';
import type { PersonaBreve, TrabajoVista } from '@/servicios/vistas';

const SIN_MARCAS: Marcas = { atrasado: false, enRiesgo: false, causas: [] };

function breve(p: Persona): PersonaBreve {
  return { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area };
}

/**
 * Todas las vistas de trabajo (ordenadas por plazo y luego por id) junto con la instantánea de la que salen.
 * La reutilizan proyectos.ts y, más adelante, las demás consultas; una sola carga y un solo cálculo de marcas.
 * Reformas v2 (regla 18): `inst` es la instantánea VISIBLE para `verComo` (null = vista general, sin propuestos).
 */
export async function cargarVistasTrabajos(db: Db, verComo: string | null = null): Promise<{ inst: Instantanea; vistas: TrabajoVista[] }> {
  const inst = await cargarInstantaneaVisible(db, verComo);
  const marcas = calcularMarcas(inst);
  const filasNotas = await db.select().from(notas).orderBy(asc(notas.en), asc(notas.id));

  const personas = porId(inst.personas);
  const proyectos = porId(inst.proyectos);
  const trabajos = porId(inst.trabajos);
  const persona = (id: string): Persona => {
    const p = personas.get(id);
    if (!p) throw new Error(`Persona desconocida en la base: ${id}`);
    return p;
  };
  const noResuelto = (id: string): boolean => trabajos.get(id)?.estado !== 'resuelto';
  const nombres = nombrador(inst);

  const vistas = inst.trabajos.map((t): TrabajoVista => {
    const proyecto = proyectos.get(t.proyectoId);
    const bloqueante = t.bloqueadoPorId ? trabajos.get(t.bloqueadoPorId) : undefined;

    // bloquea: lo que queda parado por este trabajo. Si está bloqueado, su cadena de dependientes;
    // si bloquea a otros, esos trabajos bloqueados y sus cadenas. Solo trabajos no resueltos.
    const bloquea = new Set<string>();
    if (t.estado !== 'resuelto') {
      if (t.estado === 'bloqueado') for (const id of cadenaDependientes(inst, t.id)) bloquea.add(id);
      for (const o of inst.trabajos) {
        if (o.bloqueadoPorId === t.id && o.estado === 'bloqueado') {
          bloquea.add(o.id);
          for (const id of cadenaDependientes(inst, o.id)) bloquea.add(id);
        }
      }
    }

    const seguimientoPendiente = inst.seguimientos
      .filter((s) => s.trabajoId === t.id && s.estado === 'pendiente')
      .sort((a, b) => b.iniciadoEn.getTime() - a.iniciadoEn.getTime())[0];

    const bloqueaIds = [...bloquea].filter(noResuelto);
    const dependeDe = inst.dependencias.filter((d) => d.trabajoId === t.id).map((d) => d.dependeDeId);
    return {
      id: t.id,
      titulo: t.titulo,
      referencia: nombres.referencia(t.id),
      proyecto: { id: t.proyectoId, nombre: proyecto?.nombre ?? t.proyectoId },
      responsable: breve(persona(t.responsableId)),
      solicitadoPor: t.solicitadoPorId ? breve(persona(t.solicitadoPorId)) : null,
      estado: t.estado,
      plazo: t.plazo,
      urgente: t.urgente,
      conCostoProbable: t.conCostoProbable,
      marcas: marcas.get(t.id) ?? SIN_MARCAS,
      bloqueadoPor: bloqueante ? nombres.ref(bloqueante.id) : null,
      fechaSolucion: t.fechaSolucion,
      bloquea: bloqueaIds,
      dependeDe,
      bloqueaTrabajos: nombres.refs(bloqueaIds),
      dependeDeTrabajos: nombres.refs(dependeDe),
      causasTrabajos: Object.fromEntries(
        (marcas.get(t.id)?.causas ?? []).flatMap((c) => (c.trabajoId ? [[c.trabajoId, nombres.ref(c.trabajoId)]] : [])),
      ),
      causasRepuestos: Object.fromEntries(
        (marcas.get(t.id)?.causas ?? []).flatMap((c) =>
          c.repuestoId ? [[c.repuestoId, inst.repuestos.find((r) => r.id === c.repuestoId)?.nombre ?? 'un repuesto']] : [],
        ),
      ),
      necesita: inst.necesidades
        .filter((n) => n.trabajoId === t.id && !n.atendida)
        .map((n) => ({ repuesto: inst.repuestos.find((r) => r.id === n.repuestoId)?.nombre ?? n.repuestoId, cantidad: n.cantidad })),
      seguimiento: seguimientoPendiente ? { nivel: seguimientoPendiente.nivel, desde: seguimientoPendiente.iniciadoEn } : null,
      notas: filasNotas
        .filter((n) => n.trabajoId === t.id)
        .map((n) => ({ en: n.en, autor: n.autorId ? (personas.get(n.autorId)?.nombre ?? n.autorId) : 'Nexo', texto: n.texto })),
      // Reformas v2 (regla 18): confianza calculada; evidencias por fecha; el enlace solo para quien tiene el mensaje.
      origen: t.origen,
      confirmacion: t.confirmacion,
      confianza: confianzaDe(t, inst.evidencias),
      dueno: t.duenoPropuestaId ? breve(persona(t.duenoPropuestaId)) : null,
      confirmadoPor: t.confirmadoPorId ? breve(persona(t.confirmadoPorId)) : null,
      entrega: t.entrega
        ? { en: t.entrega.en, por: breve(persona(t.entrega.porId)), nota: t.entrega.nota, enlace: t.entrega.enlace }
        : null,
      evidencias: inst.evidencias
        .filter((e) => e.trabajoId === t.id)
        .sort((a, b) => a.en.getTime() - b.en.getTime() || a.id - b.id)
        .map((e) => {
          const autor = e.autorId ? personas.get(e.autorId) : undefined;
          return {
            tipo: e.tipo,
            cita: e.cita,
            autor: autor ? breve(autor) : null,
            en: e.en,
            enlace: verComo ? (e.enlaces[verComo] ?? null) : null,
          };
        }),
    };
  });

  vistas.sort((a, b) => a.plazo.getTime() - b.plazo.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { inst, vistas };
}

/** `verComo` (reformas v2): la persona que mira; sin ella, vista general (un propuesto da null). */
export async function obtenerTrabajo(ctx: ContextoServicio, id: string, verComo?: string): Promise<TrabajoVista | null> {
  const { vistas } = await cargarVistasTrabajos(ctx.db, verComo ?? null);
  return vistas.find((v) => v.id === id) ?? null;
}

/** Por plazo ascendente (empate: id). Filtros opcionales por proyecto y por responsable; `verComo` como obtenerTrabajo. */
export async function listarTrabajos(
  ctx: ContextoServicio,
  f?: { proyectoId?: string; responsableId?: string; verComo?: string },
): Promise<TrabajoVista[]> {
  const { vistas } = await cargarVistasTrabajos(ctx.db, f?.verComo ?? null);
  return vistas.filter(
    (v) => (!f?.proyectoId || v.proyecto.id === f.proyectoId) && (!f?.responsableId || v.responsable.id === f.responsableId),
  );
}
