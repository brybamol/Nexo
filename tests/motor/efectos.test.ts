// aplicarEnMemoria: puro, no modifica la instantánea de entrada. Tarea 1.5.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Decision, Seguimiento, Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const AHORA = enCR('2026-11-25', '07:00');

function trabajoNuevo(id: string): Trabajo {
  const base = instantaneaDesdeSemilla().trabajos[0] as Trabajo;
  return { ...base, id, estado: 'abierto', resueltoEn: null, origen: 'captura' };
}

const seguimiento: Seguimiento = {
  id: 'S1',
  trabajoId: 'T15',
  plazoReferencia: AHORA,
  nivel: 0,
  destinatarioId: 'lucia-mora',
  urgente: false,
  proximoEn: AHORA,
  estado: 'pendiente',
  iniciadoEn: AHORA,
  escaladosA: [],
  tipo: 'estado',
};

const decision: Decision = {
  id: 'D01',
  creadaEn: AHORA,
  proyectoId: 'P1',
  numero: 1,
  proponenteId: 'lucia-mora',
  decisorId: 'marcela-solis',
  capturaId: null,
  repuestoId: 'compresor-2hp',
  cantidad: 3,
  contexto: 'c',
  afectados: { trabajoIds: [], personaIds: [] },
  opcionPropuesta: null,
  estado: 'pendiente',
  opcionElegida: null,
  decididaEn: null,
  motivoRechazo: null,
  opciones: [],
};

describe('aplicarEnMemoria', () => {
  it('sin efectos devuelve una instantánea equivalente', () => {
    const inst = instantaneaDesdeSemilla();
    expect(aplicarEnMemoria(inst, [])).toEqual(inst);
  });

  it('no modifica la instantánea original', () => {
    const inst = instantaneaDesdeSemilla();
    const copia = structuredClone(inst);
    aplicarEnMemoria(inst, [
      { tipo: 'crear_trabajo', trabajo: trabajoNuevo('T31'), necesidades: [], actorId: null },
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado' }, actorId: null },
      { tipo: 'actualizar_repuesto', repuestoId: 'compresor-2hp', cambios: { existencia: 0 }, actorId: null },
      { tipo: 'crear_seguimiento', seguimiento },
    ]);
    expect(inst).toEqual(copia);
  });

  it('crear_trabajo agrega el trabajo y sus necesidades', () => {
    const inst = instantaneaDesdeSemilla();
    const nec = { trabajoId: 'T31', repuestoId: 'compresor-2hp', cantidad: 2, fechaDisponible: null, atendida: false };
    const res = aplicarEnMemoria(inst, [{ tipo: 'crear_trabajo', trabajo: trabajoNuevo('T31'), necesidades: [nec], actorId: null }]);
    expect(res.trabajos).toHaveLength(inst.trabajos.length + 1);
    expect(res.trabajos.at(-1)?.id).toBe('T31');
    expect(res.necesidades).toContainEqual(nec);
  });

  it('actualizar_trabajo fusiona solo los campos definidos y respeta null', () => {
    const inst = instantaneaDesdeSemilla();
    const plazoAntes = inst.trabajos.find((t) => t.id === 'T04')?.plazo;
    const res = aplicarEnMemoria(inst, [
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', plazo: undefined }, actorId: null },
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { bloqueadoPorId: null }, actorId: null },
    ]);
    const t04 = res.trabajos.find((t) => t.id === 'T04');
    expect(t04).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: null });
    expect(t04?.plazo).toEqual(plazoAntes);
  });

  it('actualiza repuestos y necesidades sin tocar las demás', () => {
    const inst = instantaneaDesdeSemilla();
    const llegada = enCR('2026-11-25', '15:00');
    const res = aplicarEnMemoria(inst, [
      { tipo: 'actualizar_repuesto', repuestoId: 'compresor-2hp', cambios: { existencia: 0, faltanteReportadoEn: AHORA }, actorId: null },
      { tipo: 'actualizar_necesidad', trabajoId: 'T04', repuestoId: 'compresor-2hp', cambios: { fechaDisponible: llegada } },
    ]);
    expect(res.repuestos.find((r) => r.id === 'compresor-2hp')).toMatchObject({ existencia: 0, faltanteReportadoEn: AHORA });
    expect(res.repuestos.find((r) => r.id === 'termostato')).toEqual(inst.repuestos.find((r) => r.id === 'termostato'));
    expect(res.necesidades.find((n) => n.trabajoId === 'T04')?.fechaDisponible).toEqual(llegada);
    expect(res.necesidades.find((n) => n.trabajoId === 'T10')?.fechaDisponible).toBeNull();
  });

  it('seguimientos y decisiones: crear y actualizar', () => {
    const efectos: Efecto[] = [
      { tipo: 'crear_seguimiento', seguimiento },
      { tipo: 'actualizar_seguimiento', seguimientoId: 'S1', cambios: { nivel: 2 } },
      { tipo: 'crear_decision', decision },
      { tipo: 'actualizar_decision', decisionId: 'D01', cambios: { estado: 'aprobada', opcionElegida: 'A' } },
    ];
    const res = aplicarEnMemoria(instantaneaDesdeSemilla(), efectos);
    expect(res.seguimientos).toEqual([{ ...seguimiento, nivel: 2 }]);
    expect(res.decisiones).toEqual([{ ...decision, estado: 'aprobada', opcionElegida: 'A' }]);
  });

  it('reformas v2: crear_dependencia sin repetir; agregar_evidencia con id provisional; actualizar_evidencia', () => {
    const inst = instantaneaDesdeSemilla();
    const evidencia = {
      trabajoId: 'T27',
      tipo: 'pedido' as const,
      fuente: 'correo' as const,
      compromisoClave: 'c-h1-m1',
      mensajeId: '<h1-m1@friodelvalle.cr>',
      buzones: ['andres-vargas'],
      enlaces: {},
      autorId: 'andres-vargas',
      en: AHORA,
      cita: '¿puedes confirmar el pago anticipado del pedido 1047?',
    };
    const res = aplicarEnMemoria(inst, [
      { tipo: 'crear_dependencia', dependencia: { trabajoId: 'T28', dependeDeId: 'T27' }, actorId: null },
      { tipo: 'crear_dependencia', dependencia: { trabajoId: 'T28', dependeDeId: 'T27' }, actorId: null },
      { tipo: 'agregar_evidencia', evidencia },
      { tipo: 'agregar_evidencia', evidencia: { ...evidencia, tipo: 'entrega' } },
      { tipo: 'actualizar_evidencia', evidenciaId: 1, cambios: { buzones: ['andres-vargas', 'ricardo-brenes'] } },
    ]);
    expect(res.dependencias.filter((d) => d.trabajoId === 'T28' && d.dependeDeId === 'T27')).toHaveLength(1);
    expect(res.dependencias).toHaveLength(inst.dependencias.length + 1);
    expect(res.evidencias.map((e) => [e.id, e.tipo, e.buzones])).toEqual([
      [1, 'pedido', ['andres-vargas', 'ricardo-brenes']],
      [2, 'entrega', ['andres-vargas']],
    ]);
  });

  it('reformas v2: descartar mueve el trabajo a descartados y quita sus dependencias, necesidades y seguimientos', () => {
    const inst = instantaneaDesdeSemilla();
    const res = aplicarEnMemoria(inst, [
      { tipo: 'crear_seguimiento', seguimiento: { ...seguimiento, trabajoId: 'T04' } },
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { confirmacion: 'descartado' }, actorId: 'jose-alfaro' },
    ]);
    expect(res.trabajos.some((t) => t.id === 'T04')).toBe(false);
    expect(res.descartados).toEqual([{ id: 'T04', proyectoId: 'P1', numero: 4 }]);
    expect(res.dependencias.some((d) => d.trabajoId === 'T04' || d.dependeDeId === 'T04')).toBe(false); // T04>T03 y T05>T04
    expect(res.dependencias).toHaveLength(inst.dependencias.length - 2);
    expect(res.necesidades.some((n) => n.trabajoId === 'T04')).toBe(false);
    expect(res.seguimientos).toEqual([]);
    expect(inst.trabajos.some((t) => t.id === 'T04')).toBe(true); // puro
  });

  it('reformas v2: registrar_mensajes y registrar_revision no cambian la instantánea', () => {
    const inst = instantaneaDesdeSemilla();
    const res = aplicarEnMemoria(inst, [
      { tipo: 'registrar_mensajes', mensajes: [] },
      {
        tipo: 'registrar_revision',
        revision: {
          en: AHORA,
          personaId: 'lucia-mora',
          origen: 'captura',
          trabajoId: null,
          capturaId: 1,
          resultado: 'confirmada',
          campos: [],
          propuesto: { titulo: 't', responsableId: 'lucia-mora', plazo: null, proyectoId: 'OD' },
          final: { titulo: 't', responsableId: 'lucia-mora', plazo: null, proyectoId: 'OD' },
          entrada: { texto: 'x' },
          motivo: null,
        },
      },
    ]);
    expect(res).toEqual(inst);
  });

  it('notas, acciones y eventos no cambian la instantánea; ids inexistentes se ignoran', () => {
    const inst = instantaneaDesdeSemilla();
    const res = aplicarEnMemoria(inst, [
      { tipo: 'agregar_nota', trabajoId: 'T04', autorId: null, texto: 'x' },
      { tipo: 'accion', accion: { en: AHORA, tipo: 'aviso', motivo: 'm', hechoOrigen: 'h', trabajoIds: [], decisionId: null, destinatarioId: null, capturaId: null }, aviso: null },
      { tipo: 'evento', evento: { en: AHORA, actorId: null, tipo: 'estado_cambiado', trabajoId: null, decisionId: null, datos: {} } },
      { tipo: 'actualizar_trabajo', trabajoId: 'T99', cambios: { estado: 'resuelto' }, actorId: null },
    ]);
    expect(res).toEqual(inst);
  });
});
