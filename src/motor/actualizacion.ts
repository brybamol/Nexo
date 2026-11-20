// Efectos de una actualización: notas con problema, liberación, reprogramación (§4.2 reglas 3, 5–7). Puro. Tarea 2.3.
// Las acciones salen con capturaId = null: servicios/aplicar.ts les pone la captura de origen.
import { formatearFecha } from '@/dominio/formato';
import type { PlanActualizacion, Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { dependientesDirectos, porId, type Instantanea } from '@/motor/instantanea';
import { registrarRespuesta } from '@/motor/seguimiento';

const ESTADO_TEXTO: Record<Trabajo['estado'], string> = {
  abierto: 'abierto',
  en_curso: 'en curso',
  bloqueado: 'bloqueado',
  resuelto: 'resuelto',
};

/** R5: todo lo que un mismo hecho le cambia a una persona va en un solo aviso. Excluye al autor. */
class AvisosPorPersona {
  private readonly porPersona = new Map<string, { trabajoIds: string[]; lineas: string[] }>();
  constructor(private readonly autorId: string) {}

  agregar(personaId: string, trabajoIds: string[], linea: string): void {
    if (personaId === this.autorId) return;
    let g = this.porPersona.get(personaId);
    if (!g) {
      g = { trabajoIds: [], lineas: [] };
      this.porPersona.set(personaId, g);
    }
    for (const id of trabajoIds) if (!g.trabajoIds.includes(id)) g.trabajoIds.push(id);
    if (!g.lineas.includes(linea)) g.lineas.push(linea);
  }

  entradas() {
    return [...this.porPersona.entries()];
  }
}

export function efectosActualizacion(inst: Instantanea, plan: PlanActualizacion, autorId: string): Efecto[] {
  const trabajos = porId(inst.trabajos);
  const personas = porId(inst.personas);
  const proyectos = porId(inst.proyectos);
  const x = trabajos.get(plan.trabajoId);
  if (!x) return [];
  const autor = personas.get(autorId)?.nombre ?? autorId;
  const ahora = inst.ahora;

  const efectos: Efecto[] = [];
  const tocados: string[] = [x.id];
  const tocar = (id: string) => {
    if (!tocados.includes(id)) tocados.push(id);
  };
  const avisos = new AvisosPorPersona(autorId);
  const cambiosTexto: string[] = [];

  // Regla 3: la actualización del responsable (o de un destinatario de la cadena) responde al seguimiento.
  efectos.push(...registrarRespuesta(inst, x.id, autorId));

  /** Regla 5: X pasó a resuelto o salió de bloqueado → avisar a los responsables de sus dependientes directos. */
  const liberar = (t: Trabajo, como: string) => {
    for (const depId of dependientesDirectos(inst, t.id)) {
      const d = trabajos.get(depId);
      if (!d || d.estado === 'resuelto') continue;
      avisos.agregar(d.responsableId, [d.id], `${t.id} «${t.titulo}» ${como}: ${d.id} «${d.titulo}» puede avanzar.`);
    }
  };

  // Cambio de estado. Un trabajo bloqueado por otro que sigue sin resolver no sale de bloqueado por una respuesta
  // («sigo con…»): lo libera resolver su bloqueante (regla 5). Resolverlo directamente sí se permite.
  const pedido = plan.nuevoEstado && plan.nuevoEstado !== x.estado ? plan.nuevoEstado : null;
  const bloqueante = x.estado === 'bloqueado' && x.bloqueadoPorId ? trabajos.get(x.bloqueadoPorId) : undefined;
  const sigueBloqueado = pedido !== null && pedido !== 'resuelto' && bloqueante !== undefined && bloqueante.estado !== 'resuelto';
  const nuevo = sigueBloqueado ? null : pedido;
  if (sigueBloqueado && bloqueante) {
    cambiosTexto.push(`${x.id} sigue bloqueado por ${bloqueante.id} «${bloqueante.titulo}»: no cambió su estado`);
  }
  if (nuevo) {
    const saleDeBloqueo = x.estado === 'bloqueado';
    efectos.push({
      tipo: 'actualizar_trabajo',
      trabajoId: x.id,
      cambios: {
        estado: nuevo,
        ...(nuevo === 'resuelto' ? { resueltoEn: ahora } : {}),
        ...(saleDeBloqueo ? { bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null } : {}),
      },
      actorId: autorId,
    });
    cambiosTexto.push(`${x.id} pasó a ${ESTADO_TEXTO[nuevo]}`);
    if (nuevo === 'resuelto') liberar(x, 'quedó resuelto');
    else if (saleDeBloqueo) liberar(x, 'ya no está bloqueado');

    if (nuevo === 'resuelto') {
      // Regla 5: resuelto el bloqueante → los trabajos bloqueados por X vuelven a en curso (avisando a su responsable,
      // dependiente directo de X) y, si X conseguía un repuesto, su necesidad de ese repuesto queda atendida.
      for (const t of inst.trabajos) {
        if (t.bloqueadoPorId !== x.id || t.estado !== 'bloqueado') continue;
        efectos.push({
          tipo: 'actualizar_trabajo',
          trabajoId: t.id,
          cambios: { estado: 'en_curso', bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null },
          actorId: autorId,
        });
        avisos.agregar(t.responsableId, [t.id], `${x.id} «${x.titulo}» quedó resuelto: ${t.id} «${t.titulo}» ya no está bloqueado.`);
        for (const n of inst.necesidades) {
          if (x.repuestoId && n.trabajoId === t.id && n.repuestoId === x.repuestoId && !n.atendida) {
            efectos.push({ tipo: 'actualizar_necesidad', trabajoId: t.id, repuestoId: n.repuestoId, cambios: { atendida: true } });
          }
        }
        tocar(t.id);
        cambiosTexto.push(`${t.id} vuelve a en curso`);
        liberar(t, 'ya no está bloqueado');
      }
    }

    if (nuevo === 'resuelto') {
      // Resolver un trabajo cierra sus seguimientos (los que registrarRespuesta no haya cerrado ya).
      const despues = aplicarEnMemoria(inst, efectos);
      for (const s of despues.seguimientos) {
        if (s.trabajoId === x.id && s.estado === 'pendiente') {
          efectos.push({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } });
        }
      }
    }
  }

  // Nota en el propio trabajo.
  if (plan.nota) {
    efectos.push({ tipo: 'agregar_nota', trabajoId: x.id, autorId, texto: plan.nota });
    cambiosTexto.push(`nota en ${x.id}`);
  }

  // Regla 6: nota con problema.
  if (plan.hayProblema) {
    const detalle = plan.nota ? `: «${plan.nota}»` : '.';
    for (const dep of inst.dependencias) {
      if (dep.trabajoId !== x.id) continue;
      const p = trabajos.get(dep.dependeDeId);
      if (!p || p.estado === 'resuelto') continue;
      avisos.agregar(p.responsableId, [x.id, p.id], `${autor} reportó un problema en ${x.id} «${x.titulo}», que depende de ${p.id} «${p.titulo}»${detalle}`);
    }
    for (const depId of dependientesDirectos(inst, x.id)) {
      const d = trabajos.get(depId);
      if (!d || d.estado === 'resuelto') continue;
      const responsableProyecto = proyectos.get(d.proyectoId)?.responsableId;
      if (!responsableProyecto) continue;
      avisos.agregar(
        responsableProyecto,
        [x.id, d.id],
        `${autor} reportó un problema en ${x.id} «${x.titulo}»; de él depende ${d.id} «${d.titulo}»${detalle}`,
      );
    }
  }

  // Regla 7: reprogramación por alguien que no es el responsable → aviso al responsable.
  for (const r of plan.reprogramar) {
    const t = trabajos.get(r.trabajoId);
    if (!t || t.plazo.getTime() === r.plazo.getTime()) continue;
    efectos.push({ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { plazo: r.plazo }, actorId: autorId });
    tocar(t.id);
    cambiosTexto.push(`plazo de ${t.id} a ${formatearFecha(r.plazo)}`);
    if (t.responsableId !== autorId) {
      avisos.agregar(
        t.responsableId,
        [t.id],
        `${autor} movió el plazo de ${t.id} «${t.titulo}» de ${formatearFecha(t.plazo)} a ${formatearFecha(r.plazo)}.`,
      );
    }
  }

  // Notas en trabajos relacionados: no avisan.
  for (const n of plan.notasRelacionadas) {
    efectos.push({ tipo: 'agregar_nota', trabajoId: n.trabajoId, autorId, texto: n.nota });
    tocar(n.trabajoId);
    cambiosTexto.push(`nota en ${n.trabajoId}`);
  }

  const hechoOrigen = `${autor} actualizó ${x.id} «${x.titulo}»${plan.nota ? `: «${plan.nota}»` : ''}`;

  // R10: registro de lo que hizo Nexo con la actualización.
  efectos.push({
    tipo: 'accion',
    accion: {
      en: ahora,
      tipo: 'actualizar_trabajo',
      motivo: `${autor} informó un cambio: ${cambiosTexto.join('; ')}.`,
      hechoOrigen,
      trabajoIds: tocados,
      decisionId: null,
      destinatarioId: null,
      capturaId: null,
    },
    aviso: null,
  });

  for (const [personaId, g] of avisos.entradas()) {
    const cuerpo = g.lineas.join(' ');
    efectos.push({
      tipo: 'accion',
      accion: {
        en: ahora,
        tipo: 'aviso',
        motivo: cuerpo,
        hechoOrigen,
        trabajoIds: g.trabajoIds,
        decisionId: null,
        destinatarioId: personaId,
        capturaId: null,
      },
      aviso: { personaId, en: ahora, titulo: `${autor} actualizó ${x.id}`, cuerpo, trabajoIds: g.trabajoIds },
    });
  }

  return efectos;
}
