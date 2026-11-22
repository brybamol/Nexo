// cargarInstantanea y persistirEfectos contra PGlite en memoria. Tarea 1.5.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { cargarInstantanea, persistirEfectos } from '@/db/instantanea';
import { acciones, avisos, decisiones, eventos, notas, opcionesDecision, seguimientos } from '@/db/esquema';
import { enCR } from '@/dominio/tiempo';
import type { AccionNueva, Decision, Seguimiento, Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import type { ContextoServicio } from '@/servicios/contexto';
import { instantaneaDesdeSemilla, prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
let ctx: ContextoServicio;

beforeEach(async () => {
  demo = await prepararDemo({ hora: '07:00' });
  ctx = demo.ctx;
});
afterEach(async () => {
  await demo.cerrar();
});

const AHORA = enCR('2026-11-25', '07:00');

function trabajoNuevo(id: string, extra: Partial<Trabajo> = {}): Trabajo {
  return {
    id,
    proyectoId: 'P1',
    numero: 8,
    titulo: 'Conseguir un compresor de 2 HP',
    responsableId: 'lucia-mora',
    solicitadoPorId: 'jose-alfaro',
    plazo: enCR('2026-11-25', '12:00'),
    estado: 'abierto',
    urgente: true,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: null,
    cantidadRepuesto: null,
    etiqueta: null,
    relacionados: [],
    origen: 'captura',
    capturaId: null,
    decisionId: null,
    creadoEn: AHORA,
    resueltoEn: null,
    ...extra,
  };
}

function accionNueva(extra: Partial<AccionNueva> = {}): AccionNueva {
  return {
    en: AHORA,
    tipo: 'aviso',
    motivo: 'prueba',
    hechoOrigen: 'prueba',
    trabajoIds: ['T04'],
    decisionId: null,
    destinatarioId: 'lucia-mora',
    capturaId: null,
    ...extra,
  };
}

function decisionNueva(id = 'D01'): Decision {
  return {
    id,
    creadaEn: AHORA,
    proyectoId: 'P1',
    numero: 1,
    proponenteId: 'lucia-mora',
    decisorId: 'marcela-solis',
    capturaId: null,
    repuestoId: 'compresor-2hp',
    cantidad: 3,
    contexto: 'Falta el compresor',
    afectados: { trabajoIds: ['T04', 'T10'], personaIds: ['jose-alfaro'] },
    opcionPropuesta: null,
    estado: 'pendiente',
    opcionElegida: null,
    decididaEn: null,
    motivoRechazo: null,
    opciones: [
      {
        letra: 'A',
        descripcion: 'Todo local',
        costo: 1_380_000,
        lineas: [{ proveedor: 'local', cantidad: 3, precioUnitario: 460_000, llegada: enCR('2026-11-25', '15:00'), trabajoIds: ['T04'] }],
        cambiosFecha: [{ trabajoId: 'T04', de: enCR('2026-11-25', '17:00'), a: enCR('2026-11-26', '17:00') }],
        consecuencia: 'Todo llega hoy',
      },
      {
        letra: 'B',
        descripcion: 'Todo habitual',
        costo: 1_140_000,
        lineas: [{ proveedor: 'habitual', cantidad: 3, precioUnitario: 380_000, llegada: enCR('2026-12-01', '07:00'), trabajoIds: ['T04'] }],
        cambiosFecha: [],
        consecuencia: 'Llega el 1-dic',
      },
    ],
  };
}

describe('cargarInstantanea', () => {
  it('lee la semilla completa: coincide con instantaneaDesdeSemilla()', async () => {
    const inst = await cargarInstantanea(ctx.db);
    const esperada = instantaneaDesdeSemilla();
    const ordenar = <T>(xs: T[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(inst.ahora).toEqual(AHORA);
    expect(inst.personas).toEqual(esperada.personas);
    expect(inst.proyectos).toEqual(esperada.proyectos);
    expect(inst.trabajos).toEqual(esperada.trabajos);
    expect(inst.repuestos.map((r) => r.id)).toEqual(esperada.repuestos.map((r) => r.id).sort());
    expect(ordenar(inst.repuestos)).toEqual(ordenar(esperada.repuestos));
    expect(ordenar(inst.dependencias)).toEqual(ordenar(esperada.dependencias));
    expect(ordenar(inst.necesidades)).toEqual(ordenar(esperada.necesidades));
    expect(inst.seguimientos).toEqual([]);
    expect(inst.decisiones).toEqual([]);
    expect(inst.trabajos).toHaveLength(30);
  });

  it('ordena los seguimientos de forma natural (S2 antes que S10)', async () => {
    const mk = (n: number): Seguimiento => ({
      id: `S${n}`,
      trabajoId: 'T15',
      plazoReferencia: AHORA,
      nivel: 0,
      destinatarioId: 'lucia-mora',
      urgente: false,
      proximoEn: AHORA,
      estado: 'pendiente',
      iniciadoEn: AHORA,
    });
    await persistirEfectos(ctx.db, [10, 2, 1].map((n) => ({ tipo: 'crear_seguimiento', seguimiento: mk(n) })));
    const inst = await cargarInstantanea(ctx.db);
    expect(inst.seguimientos.map((s) => s.id)).toEqual(['S1', 'S2', 'S10']);
  });

  it('devuelve las decisiones con sus opciones (fechas como Date) en orden A, B', async () => {
    await persistirEfectos(ctx.db, [{ tipo: 'crear_decision', decision: decisionNueva() }]);
    const inst = await cargarInstantanea(ctx.db);
    expect(inst.decisiones).toEqual([decisionNueva()]);
    expect(inst.decisiones[0]?.opciones[0]?.lineas[0]?.llegada).toBeInstanceOf(Date);
  });
});

describe('persistirEfectos', () => {
  it('sin efectos no hace nada', async () => {
    expect(await persistirEfectos(ctx.db, [])).toEqual({ accionIds: [] });
  });

  it('crear_trabajo inserta el trabajo y sus necesidades, y registra trabajo_creado con el actor y la hora del reloj', async () => {
    await persistirEfectos(ctx.db, [
      {
        tipo: 'crear_trabajo',
        trabajo: trabajoNuevo('T31', { repuestoId: 'compresor-2hp', cantidadRepuesto: 1 }),
        necesidades: [{ trabajoId: 'T31', repuestoId: 'compresor-2hp', cantidad: 1, fechaDisponible: null, atendida: false }],
        actorId: 'jose-alfaro',
      },
    ]);
    const inst = await cargarInstantanea(ctx.db);
    expect(inst.trabajos).toHaveLength(31);
    expect(inst.trabajos.find((t) => t.id === 'T31')).toEqual(trabajoNuevo('T31', { repuestoId: 'compresor-2hp', cantidadRepuesto: 1 }));
    expect(inst.necesidades.filter((n) => n.trabajoId === 'T31')).toHaveLength(1);
    const evs = await ctx.db.select().from(eventos).where(eq(eventos.tipo, 'trabajo_creado'));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ actorId: 'jose-alfaro', trabajoId: 'T31', en: AHORA });
  });

  it('actualizar_trabajo cambia columnas, acepta null y emite estado_cambiado / plazo_cambiado solo si hay cambio real', async () => {
    const nuevoPlazo = enCR('2026-11-26', '12:00');
    await persistirEfectos(ctx.db, [
      {
        tipo: 'actualizar_trabajo',
        trabajoId: 'T04',
        cambios: { estado: 'bloqueado', bloqueadoPorId: null, motivoBloqueo: 'falta compresor', plazo: nuevoPlazo },
        actorId: 'jose-alfaro',
      },
      // mismo estado y mismo plazo: sin eventos nuevos
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', plazo: nuevoPlazo }, actorId: 'jose-alfaro' },
    ]);
    const t04 = (await cargarInstantanea(ctx.db)).trabajos.find((t) => t.id === 'T04');
    expect(t04).toMatchObject({ estado: 'bloqueado', motivoBloqueo: 'falta compresor', plazo: nuevoPlazo });
    const evs = await ctx.db.select().from(eventos).where(eq(eventos.trabajoId, 'T04'));
    expect(evs.map((e) => e.tipo).sort()).toEqual(['estado_cambiado', 'plazo_cambiado']);
    expect(evs.find((e) => e.tipo === 'estado_cambiado')).toMatchObject({ actorId: 'jose-alfaro', datos: { de: 'en_curso', a: 'bloqueado' } });
  });

  it('actualizar_trabajo a un id inexistente falla claro', async () => {
    await expect(
      persistirEfectos(ctx.db, [{ tipo: 'actualizar_trabajo', trabajoId: 'T99', cambios: { estado: 'resuelto' }, actorId: null }]),
    ).rejects.toThrow('T99');
  });

  it('agregar_nota guarda la nota (en = ahora) y el evento nota_agregada del autor', async () => {
    await persistirEfectos(ctx.db, [{ tipo: 'agregar_nota', trabajoId: 'T12', autorId: 'daniela-quesada', texto: 'Voy en camino' }]);
    const filas = await ctx.db.select().from(notas).where(eq(notas.trabajoId, 'T12'));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ autorId: 'daniela-quesada', texto: 'Voy en camino', en: AHORA });
    const evs = await ctx.db.select().from(eventos).where(eq(eventos.tipo, 'nota_agregada'));
    // la semilla trae 3 (2 de la gerente y 1 de Diego en T21) + el nuevo
    expect(evs).toHaveLength(4);
    expect(evs.filter((e) => e.actorId === 'daniela-quesada')).toHaveLength(1);
  });

  it('actualizar_repuesto emite existencia_corregida y faltante_reportado', async () => {
    await persistirEfectos(ctx.db, [
      {
        tipo: 'actualizar_repuesto',
        repuestoId: 'compresor-2hp',
        cambios: { existencia: 0, faltanteReportadoEn: AHORA, faltanteReportadoPor: 'jose-alfaro' },
        actorId: 'jose-alfaro',
      },
    ]);
    const r = (await cargarInstantanea(ctx.db)).repuestos.find((x) => x.id === 'compresor-2hp');
    expect(r).toMatchObject({ existencia: 0, faltanteReportadoEn: AHORA, faltanteReportadoPor: 'jose-alfaro' });
    const evs = await ctx.db.select().from(eventos).orderBy(asc(eventos.id));
    const tipos = evs.map((e) => e.tipo);
    expect(tipos).toContain('existencia_corregida');
    expect(tipos).toContain('faltante_reportado');
    expect(evs.find((e) => e.tipo === 'existencia_corregida')?.datos).toEqual({ repuestoId: 'compresor-2hp', de: 3, a: 0 });
  });

  it('actualizar_necesidad y actualizar_seguimiento', async () => {
    const llegada = enCR('2026-11-25', '15:00');
    await persistirEfectos(ctx.db, [
      { tipo: 'actualizar_necesidad', trabajoId: 'T04', repuestoId: 'compresor-2hp', cambios: { fechaDisponible: llegada } },
      { tipo: 'actualizar_necesidad', trabajoId: 'T10', repuestoId: 'compresor-2hp', cambios: { atendida: true } },
      {
        tipo: 'crear_seguimiento',
        seguimiento: {
          id: 'S1',
          trabajoId: 'T15',
          plazoReferencia: AHORA,
          nivel: 0,
          destinatarioId: 'lucia-mora',
          urgente: false,
          proximoEn: AHORA,
          estado: 'pendiente',
          iniciadoEn: AHORA,
        },
      },
      { tipo: 'actualizar_seguimiento', seguimientoId: 'S1', cambios: { nivel: 1, estado: 'respondido' } },
    ]);
    const inst = await cargarInstantanea(ctx.db);
    expect(inst.necesidades.find((n) => n.trabajoId === 'T04')).toMatchObject({ fechaDisponible: llegada, atendida: false });
    expect(inst.necesidades.find((n) => n.trabajoId === 'T10')).toMatchObject({ fechaDisponible: null, atendida: true });
    expect(inst.seguimientos[0]).toMatchObject({ id: 'S1', nivel: 1, estado: 'respondido', destinatarioId: 'lucia-mora' });
  });

  it('crear_decision guarda las opciones; actualizar_decision cambia solo lo indicado', async () => {
    await persistirEfectos(ctx.db, [
      { tipo: 'crear_decision', decision: decisionNueva() },
      { tipo: 'actualizar_decision', decisionId: 'D01', cambios: { estado: 'aprobada', opcionElegida: 'A', decididaEn: AHORA } },
    ]);
    expect(await ctx.db.select().from(opcionesDecision)).toHaveLength(2);
    const [d] = await ctx.db.select().from(decisiones);
    expect(d).toMatchObject({ id: 'D01', estado: 'aprobada', opcionElegida: 'A', decididaEn: AHORA, decisorId: 'marcela-solis', cantidad: 3 });
  });

  it('accion con aviso inserta ambos y devuelve los ids en orden; sin aviso solo la acción', async () => {
    const efectos: Efecto[] = [
      {
        tipo: 'accion',
        accion: accionNueva({ tipo: 'pedir_estado', trabajoIds: ['T15'] }),
        aviso: { personaId: 'lucia-mora', en: AHORA, titulo: '¿Cómo va T15?', cuerpo: 'cuerpo', trabajoIds: ['T15'] },
      },
      { tipo: 'accion', accion: accionNueva({ tipo: 'crear_trabajo', destinatarioId: null }), aviso: null },
      {
        tipo: 'accion',
        accion: accionNueva({ destinatarioId: 'diego-rojas' }),
        aviso: { personaId: 'diego-rojas', en: AHORA, titulo: 't', cuerpo: 'c', trabajoIds: ['T21'] },
      },
    ];
    const { accionIds } = await persistirEfectos(ctx.db, efectos);
    expect(accionIds).toHaveLength(3);
    expect([...accionIds].sort((a, b) => a - b)).toEqual(accionIds);
    expect(await ctx.db.select().from(acciones)).toHaveLength(3);
    const av = await ctx.db.select().from(avisos).orderBy(asc(avisos.id));
    expect(av.map((a) => [a.personaId, a.accionId, a.leidoEn])).toEqual([
      ['lucia-mora', accionIds[0], null],
      ['diego-rojas', accionIds[2], null],
    ]);
  });

  it('evento explícito se inserta tal cual', async () => {
    await persistirEfectos(ctx.db, [
      {
        tipo: 'evento',
        evento: { en: AHORA, actorId: 'marcela-solis', tipo: 'decision_aprobada', trabajoId: null, decisionId: 'D01', datos: { letra: 'A' } },
      },
    ]);
    const evs = await ctx.db.select().from(eventos).where(eq(eventos.tipo, 'decision_aprobada'));
    expect(evs[0]).toMatchObject({ actorId: 'marcela-solis', decisionId: 'D01', datos: { letra: 'A' } });
  });

  it('aplica los efectos en orden: un trabajo creado puede actualizarse en el mismo lote', async () => {
    await persistirEfectos(ctx.db, [
      { tipo: 'crear_trabajo', trabajo: trabajoNuevo('T31'), necesidades: [], actorId: null },
      { tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { estado: 'en_curso' }, actorId: 'lucia-mora' },
    ]);
    expect((await cargarInstantanea(ctx.db)).trabajos.find((t) => t.id === 'T31')?.estado).toBe('en_curso');
  });

  it('dentro de una transacción, un fallo deshace todo el lote', async () => {
    await expect(
      ctx.db.transaction(async (tx) => {
        await persistirEfectos(tx, [
          { tipo: 'agregar_nota', trabajoId: 'T12', autorId: null, texto: 'x' },
          { tipo: 'actualizar_trabajo', trabajoId: 'T99', cambios: { estado: 'resuelto' }, actorId: null },
        ]);
      }),
    ).rejects.toThrow();
    expect(await ctx.db.select().from(notas).where(eq(notas.trabajoId, 'T12'))).toHaveLength(0);
    expect(await ctx.db.select().from(seguimientos)).toHaveLength(0);
  });

  it('coherencia con aplicarEnMemoria: persistir y recargar = aplicar en memoria sobre la instantánea previa', async () => {
    const antes = await cargarInstantanea(ctx.db);
    const efectos: Efecto[] = [
      { tipo: 'crear_trabajo', trabajo: trabajoNuevo('T31', { repuestoId: 'compresor-2hp' }), necesidades: [{ trabajoId: 'T31', repuestoId: 'compresor-2hp', cantidad: 1, fechaDisponible: null, atendida: false }], actorId: 'jose-alfaro' },
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'falta', fechaSolucion: null }, actorId: 'jose-alfaro' },
      { tipo: 'actualizar_repuesto', repuestoId: 'compresor-2hp', cambios: { existencia: 0 }, actorId: 'jose-alfaro' },
      { tipo: 'actualizar_necesidad', trabajoId: 'T04', repuestoId: 'compresor-2hp', cambios: { atendida: true } },
      { tipo: 'crear_decision', decision: decisionNueva() },
      { tipo: 'actualizar_decision', decisionId: 'D01', cambios: { estado: 'rechazada', motivoRechazo: 'caro' } },
      { tipo: 'agregar_nota', trabajoId: 'T04', autorId: null, texto: 'no cambia la instantánea' },
    ];
    await persistirEfectos(ctx.db, efectos);
    const recargada = await cargarInstantanea(ctx.db);
    const enMemoria = aplicarEnMemoria(antes, efectos);
    const ordenar = <T>(xs: T[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(recargada.trabajos).toEqual(enMemoria.trabajos);
    expect(recargada.repuestos).toEqual(enMemoria.repuestos);
    expect(ordenar(recargada.necesidades)).toEqual(ordenar(enMemoria.necesidades));
    expect(recargada.decisiones).toEqual(enMemoria.decisiones);
  });
});
