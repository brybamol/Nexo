// Las tres cifras de la demo. Tarea 4.4.
import { acciones, eventos, preguntas } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { ROL_GERENTE } from '@/dominio/constantes';
import { ErrorDominio } from '@/dominio/tipos';
import { calcularCifras } from '@/motor/cifras';
import type { ContextoServicio } from '@/servicios/contexto';
import type { Cifras } from '@/servicios/vistas';

export async function obtenerCifras(ctx: ContextoServicio): Promise<Cifras> {
  const inst = await cargarInstantanea(ctx.db);
  const gerente = inst.personas.find((p) => p.rol === ROL_GERENTE);
  if (!gerente) throw new ErrorDominio('No hay gerente general en la base.');
  const filasEventos = await ctx.db.select().from(eventos);
  const filasAcciones = await ctx.db.select().from(acciones);
  const filasPreguntas = await ctx.db.select({ id: preguntas.id }).from(preguntas);
  return calcularCifras({
    trabajos: inst.trabajos,
    eventos: filasEventos,
    acciones: filasAcciones,
    preguntasRespondidas: filasPreguntas.length,
    gerenteId: gerente.id,
  });
}
