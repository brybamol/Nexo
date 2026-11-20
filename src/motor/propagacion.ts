// Propagación del bloqueo y avisos agrupados: R4, R5 (§4.2 regla 4). Puro. Tarea 3.2.
// Las acciones salen con capturaId = null: servicios/aplicar.ts les pone la captura de origen.
import { ETIQUETA_CONCILIACION } from '@/dominio/constantes';
import type { CausaRiesgo, HechoBloqueo, Marcas, Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { porId, type Instantanea } from '@/motor/instantanea';
import { calcularMarcas } from '@/motor/marcas';

export type { HechoBloqueo };

/** Estado bloqueado, faltante reportado, R4 y R5. `inst` ya contiene el trabajo bloqueante. */
export function efectosBloqueo(inst: Instantanea, hecho: HechoBloqueo): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === hecho.trabajoBloqueadoId);
  if (!t || t.estado === 'resuelto') return [];
  const efectos: Efecto[] = [];

  if (t.estado !== 'bloqueado' || t.bloqueadoPorId !== hecho.bloqueanteId || t.fechaSolucion !== null) {
    efectos.push({
      tipo: 'actualizar_trabajo',
      trabajoId: t.id,
      cambios: { estado: 'bloqueado', bloqueadoPorId: hecho.bloqueanteId, motivoBloqueo: hecho.motivo, fechaSolucion: null },
      actorId: hecho.autorId,
    });
  }
  const repuesto = hecho.repuestoFaltanteId ? inst.repuestos.find((r) => r.id === hecho.repuestoFaltanteId) : undefined;
  if (repuesto && repuesto.faltanteReportadoEn === null) {
    efectos.push({
      tipo: 'actualizar_repuesto',
      repuestoId: repuesto.id,
      cambios: { faltanteReportadoEn: inst.ahora, faltanteReportadoPor: hecho.autorId },
      actorId: hecho.autorId,
    });
  }

  const despues = aplicarEnMemoria(inst, efectos);
  const autor = inst.personas.find((p) => p.id === hecho.autorId)?.nombre ?? hecho.autorId;
  const motivo = hecho.motivo.charAt(0).toLowerCase() + hecho.motivo.slice(1);
  let encabezado = `${autor} reportó que ${t.id} «${t.titulo}» quedó bloqueado: ${motivo}.`;
  const causa = repuesto ? causaCitada(inst, repuesto.id) : null;
  if (repuesto && causa) {
    const c = inst.trabajos.find((x) => x.id === causa) as Trabajo;
    const atrasada = calcularMarcas(inst).get(causa)?.atrasado ? ', atrasado' : '';
    encabezado += ` El sistema decía que había ${repuesto.existencia} en existencia, pero el conteo no está conciliado: ${c.id} «${c.titulo}»${atrasada}.`;
  }
  efectos.push(...avisosRiesgo(inst, despues, { hecho: hecho.descripcion, encabezado, excluir: hecho.autorId, causa }));
  return efectos;
}

/** R4 y R5 genéricos: aviso agrupado por persona a los responsables de los trabajos que pasan a en riesgo. */
export function avisosPorRiesgoNuevo(antes: Instantanea, despues: Instantanea, hecho: string): Efecto[] {
  return avisosRiesgo(antes, despues, { hecho, encabezado: hecho, excluir: null, causa: null });
}

/** 'T15' si hay un trabajo no resuelto con etiqueta de conciliación y el repuesto tenía existencia > 0. */
export function causaCitada(inst: Instantanea, repuestoId: string): string | null {
  const r = inst.repuestos.find((x) => x.id === repuestoId);
  if (!r || r.existencia <= 0) return null;
  return inst.trabajos.find((t) => t.etiqueta === ETIQUETA_CONCILIACION && t.estado !== 'resuelto')?.id ?? null;
}

// ─── Interno ──────────────────────────────────────────────────────────────────

function porQue(causas: CausaRiesgo[], inst: Instantanea): string {
  const repuestos = porId(inst.repuestos);
  const partes = causas.map((c) => {
    switch (c.tipo) {
      case 'repuesto':
        return `necesita ${(repuestos.get(c.repuestoId ?? '')?.nombre ?? c.repuestoId ?? 'un repuesto').toLowerCase()}`;
      case 'bloqueado':
        return `depende de ${c.trabajoId}, bloqueado`;
      case 'atrasado':
        return `depende de ${c.trabajoId}, atrasado`;
      case 'cadena':
        return `depende de ${c.trabajoId}, en riesgo`;
    }
  });
  return [...new Set(partes)].join('; ');
}

function avisosRiesgo(
  antes: Instantanea,
  despues: Instantanea,
  o: { hecho: string; encabezado: string; excluir: string | null; causa: string | null },
): Efecto[] {
  const mAntes = calcularMarcas(antes);
  const mDespues = calcularMarcas(despues);
  const proyectos = porId(despues.proyectos);
  const personas = porId(despues.personas);
  const nuevos = despues.trabajos.filter((t) => mDespues.get(t.id)?.enRiesgo && !mAntes.get(t.id)?.enRiesgo);

  const grupos = new Map<string, Trabajo[]>();
  for (const t of nuevos) {
    if (t.responsableId === o.excluir) continue;
    grupos.set(t.responsableId, [...(grupos.get(t.responsableId) ?? []), t]);
  }

  const efectos: Efecto[] = [];
  for (const [personaId, ts] of grupos) {
    const ids = ts.map((t) => t.id);
    const lineas = ts.map((t) => {
      const m = mDespues.get(t.id) as Marcas;
      return `${t.id} «${t.titulo}» (${proyectos.get(t.proyectoId)?.nombre ?? t.proyectoId}): ${porQue(m.causas, despues)}.`;
    });
    const cuerpo = `${o.encabezado} Quedan en riesgo: ${lineas.join(' ')}`;
    const nombre = personas.get(personaId)?.nombre ?? personaId;
    const enumerar = ids.length === 1 ? ids[0] : `${ids.slice(0, -1).join(', ')} y ${ids[ids.length - 1]}`;
    efectos.push({
      tipo: 'accion',
      accion: {
        en: despues.ahora,
        tipo: 'aviso',
        motivo: `R4/R5: ${enumerar} de ${nombre} ${ids.length === 1 ? 'pasa' : 'pasan'} a en riesgo${o.causa ? `; causa citada: ${o.causa}` : ''}.`,
        hechoOrigen: o.hecho,
        trabajoIds: ids,
        decisionId: null,
        destinatarioId: personaId,
        capturaId: null,
      },
      aviso: {
        personaId,
        en: despues.ahora,
        titulo: `${enumerar} en riesgo`,
        cuerpo,
        trabajoIds: ids,
      },
    });
  }
  return efectos;
}
