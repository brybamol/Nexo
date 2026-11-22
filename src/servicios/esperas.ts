// Cuellos de botella (docs/08 regla 23) para la pantalla Proyectos: quién es el final de varias cadenas de espera y
// cuántas personas esperan detrás. Calcula sobre la instantánea visible para quien mira: lo propuesto solo lo ve su dueño.
import type { PersonaBreve } from '@/dominio/tipos';
import { cargarInstantanea } from '@/db/instantanea';
import { calcularEsperas } from '@/motor/esperas';
import { instantaneaVisible } from '@/motor/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';
import type { EsperasVista } from '@/servicios/vistas';

/** Los cuellos de botella con nombres para quien mira; lista vacía si no hay ninguno. */
export async function obtenerCuellos(ctx: ContextoServicio, personaId: string): Promise<EsperasVista['cuellos']> {
  const completa = await cargarInstantanea(ctx.db);
  const personas = new Map<string, PersonaBreve>(
    completa.personas.map((p) => [p.id, { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area }]),
  );
  const proyectos = new Map(completa.proyectos.map((p) => [p.id, { id: p.id, nombre: p.nombre }]));
  const definidas = <T>(xs: (T | undefined)[]) => xs.filter((x): x is T => x !== undefined);
  return calcularEsperas(instantaneaVisible(completa, personaId)).cuellos.flatMap((c) => {
    const persona = personas.get(c.personaId);
    if (!persona) return [];
    return [
      {
        persona,
        proyectos: definidas(c.proyectoIds.map((id) => proyectos.get(id))),
        esperando: definidas(c.esperando.map((id) => personas.get(id))),
      },
    ];
  });
}
