// Resumen y detalle de proyectos. Tarea 1.6.
import type { Persona } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import { cargarVistasTrabajos } from '@/servicios/consultas-trabajos';
import type { ProyectoDetalle, ResumenProyecto, TrabajoVista } from '@/servicios/vistas';

function resumir(
  proyecto: { id: string; clave: string; nombre: string; fecha: Date | null },
  responsable: Persona,
  trabajos: TrabajoVista[],
): ResumenProyecto {
  const cuenta = (e: TrabajoVista['estado']) => trabajos.filter((t) => t.estado === e).length;
  return {
    id: proyecto.id,
    clave: proyecto.clave,
    nombre: proyecto.nombre,
    responsable: { id: responsable.id, nombre: responsable.nombre, rol: responsable.rol, area: responsable.area },
    fecha: proyecto.fecha,
    total: trabajos.length,
    abiertos: cuenta('abierto'),
    enCurso: cuenta('en_curso'),
    bloqueados: cuenta('bloqueado'),
    resueltos: cuenta('resuelto'),
    atrasados: trabajos.filter((t) => t.marcas.atrasado).length,
    enRiesgo: trabajos.filter((t) => t.marcas.enRiesgo).length,
  };
}

/** Un resumen por proyecto, en el orden de la semilla (P1…P4 y Operación diaria). */
export async function listarProyectos(ctx: ContextoServicio): Promise<ResumenProyecto[]> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  return inst.proyectos.map((p) => {
    const responsable = inst.personas.find((x) => x.id === p.responsableId);
    if (!responsable) throw new Error(`Responsable desconocido en la base: ${p.responsableId}`);
    return resumir(p, responsable, vistas.filter((v) => v.proyecto.id === p.id));
  });
}

/** El resumen más sus trabajos (por plazo ascendente); null si el proyecto no existe. */
export async function obtenerProyecto(ctx: ContextoServicio, id: string): Promise<ProyectoDetalle | null> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  const p = inst.proyectos.find((x) => x.id === id);
  if (!p) return null;
  const responsable = inst.personas.find((x) => x.id === p.responsableId);
  if (!responsable) throw new Error(`Responsable desconocido en la base: ${p.responsableId}`);
  const trabajos = vistas.filter((v) => v.proyecto.id === id);
  return { ...resumir(p, responsable, trabajos), trabajos };
}
