// Revisión de las propuestas de Nexo por servicio (docs/08 reglas 14a, 16 y 18; casos V7–V10). Tarea R6b.
// El estado de partida es el de V1 (lectura de las 7:05: M01 de Ricardo entregado por Diego, M02 de Esteban), sembrado
// con persistirEfectos para no depender de la lectura del correo (R5/R6a): lo que se prueba aquí es la revisión.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos, eventos, seguimientos } from '@/db/esquema';
import { cargarInstantanea, cargarRevisiones, persistirEfectos } from '@/db/instantanea';
import { TRABAJOS_SEMILLA } from '@/db/semilla/datos';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type Trabajo } from '@/dominio/tipos';
import type { Interpretacion, InterpreteIA } from '@/ia/interprete';
import { seguimientoDePropuesta } from '@/motor/propuestas';
import { capturar } from '@/servicios/captura';
import { cambiarEstado, confirmarRecepcion, declararEntrega } from '@/servicios/estado-trabajos';
import { revisarPropuesta } from '@/servicios/propuestas';
import { avanzarReloj } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const LUN = '2026-11-23';
const MAR = '2026-11-24';
const MIE = '2026-11-25';
const JUE = '2026-11-26';
const VIE = '2026-11-27';

const CITA_M01 =
  'Diego, ¿puedes enviarme las guías de entrega firmadas de los pedidos 1041 y 1042? Las necesito antes del 27 de noviembre para facturar.';
const ENTREGA_M01 = 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.';

function propuesto(extra: Partial<Trabajo> & Pick<Trabajo, 'id' | 'proyectoId' | 'numero' | 'titulo' | 'responsableId'>): Trabajo {
  const base = TRABAJOS_SEMILLA.find((t) => t.id === 'T28') as Trabajo;
  return {
    ...structuredClone(base),
    estado: 'abierto',
    urgente: false,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: null,
    cantidadRepuesto: null,
    etiqueta: null,
    relacionados: [],
    origen: 'correo',
    capturaId: null,
    decisionId: null,
    creadoEn: enCR(MIE, '07:05'),
    resueltoEn: null,
    plazo: enCR(VIE, '17:00'),
    confirmacion: 'propuesto',
    confirmadoPorId: null,
    entrega: null,
    solicitadoPorId: null,
    duenoPropuestaId: null,
    ...extra,
  };
}

/** Como tras V1 (a las 7:05, sin correo): M01 y M02 propuestos con su evidencia y su seguimiento `propuesta`. */
async function sembrarPropuestas(demo: Demo, cambios: { m01?: Partial<Trabajo> } = {}): Promise<void> {
  const db = demo.ctx.db;
  const m01 = propuesto({
    id: 'M01',
    proyectoId: 'P4',
    numero: 13,
    titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
    responsableId: 'diego-rojas',
    solicitadoPorId: 'ricardo-brenes',
    duenoPropuestaId: 'ricardo-brenes',
    entrega: { en: enCR(MAR, '16:30'), porId: 'diego-rojas', nota: ENTREGA_M01, enlace: null, fuente: 'correo' },
    ...cambios.m01,
  });
  const m02 = propuesto({
    id: 'M02',
    proyectoId: 'P2',
    numero: 7,
    titulo: 'Enviar las fotos del mantenimiento de Heredia y Alajuela',
    responsableId: 'daniela-quesada',
    solicitadoPorId: 'esteban-castro',
    duenoPropuestaId: 'esteban-castro',
  });
  const ev = (trabajoId: string, tipo: 'pedido' | 'entrega', autorId: string, en: Date, cita: string, buzones: string[]) => ({
    tipo: 'agregar_evidencia' as const,
    evidencia: { trabajoId, tipo, fuente: 'correo' as const, compromisoClave: `c-${trabajoId}`, mensajeId: `<${trabajoId}-${tipo}@friodelvalle.cr>`, buzones, enlaces: {}, autorId, en, cita },
  });
  await persistirEfectos(db, [
    { tipo: 'crear_trabajo', trabajo: m01, necesidades: [], actorId: null },
    { tipo: 'crear_trabajo', trabajo: m02, necesidades: [], actorId: null },
    ev('M01', 'pedido', 'ricardo-brenes', enCR(LUN, '15:00'), CITA_M01, [m01.duenoPropuestaId ?? 'ricardo-brenes']),
    ev('M01', 'entrega', 'diego-rojas', enCR(MAR, '16:30'), ENTREGA_M01, [m01.duenoPropuestaId ?? 'ricardo-brenes']),
    ev('M02', 'pedido', 'esteban-castro', enCR(MAR, '17:00'), 'Daniela, ¿puedes enviarme las fotos del mantenimiento de Heredia y Alajuela?', ['esteban-castro']),
  ]);
  await persistirEfectos(db, seguimientoDePropuesta(await cargarInstantanea(db), 'M01'));
  await persistirEfectos(db, seguimientoDePropuesta(await cargarInstantanea(db), 'M02'));
}

/** Intérprete de prueba que siempre propone `valor` (la IA solo propone; la validación decide). */
function iaFija(valor: Interpretacion): InterpreteIA {
  const r = <T>(v: T) => Promise.resolve({ valor: v, implementacion: 'local' as const, modelo: null, respaldo: false });
  return {
    nombre: 'local',
    interpretar: () => r(valor),
    clasificarPregunta: () => Promise.reject(new Error('no se usa')),
    redactarRespuesta: () => Promise.reject(new Error('no se usa')),
  };
}

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo(); // 7:05, correo apagado
  await sembrarPropuestas(demo);
});
afterEach(async () => {
  await demo.cerrar();
});

const trabajo = async (id: string) => (await cargarInstantanea(demo.ctx.db)).trabajos.find((t) => t.id === id);
const avisosA = async (personaId: string) => (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === personaId);

describe('V7 · Ricardo confirma M01 y luego confirma que lo recibió', () => {
  it('confirmar: confirmado por Ricardo, revisión confirmada [], seguimiento propuesta respondido, sin aviso', async () => {
    await avanzarReloj(demo.ctx, 0); // el tick de las 7:05 (pide el estado de T15 y T21)
    const antes = (await demo.ctx.db.select().from(avisos)).length;
    await revisarPropuesta(demo.ctx, 'M01', 'ricardo-brenes', { tipo: 'confirmar' });

    expect(await trabajo('M01')).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes', estado: 'abierto' });
    const revs = await cargarRevisiones(demo.ctx.db);
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ personaId: 'ricardo-brenes', origen: 'correo', trabajoId: 'M01', resultado: 'confirmada', campos: [] });
    expect(revs[0]?.entrada).toMatchObject({ cita: CITA_M01, deId: 'ricardo-brenes', enviado: enCR(LUN, '15:00') });
    expect((await demo.ctx.db.select().from(avisos)).length).toBe(antes);
    const segs = (await demo.ctx.db.select().from(seguimientos)).filter((s) => s.trabajoId === 'M01');
    expect(segs.map((s) => [s.tipo, s.estado])).toEqual([
      ['propuesta', 'respondido'],
      ['recepcion', 'pendiente'],
    ]);
    const accs = (await demo.ctx.db.select().from(acciones)).filter((a) => a.tipo === 'revisar_propuesta');
    expect(accs).toHaveLength(1);
    expect(accs[0]?.destinatarioId).toBeNull();
    expect(idsInternosEn(`${accs[0]?.motivo} ${accs[0]?.hechoOrigen}`)).toEqual([]);
    const ev = (await demo.ctx.db.select().from(eventos)).find((e) => e.tipo === 'propuesta_revisada');
    expect(ev).toMatchObject({ actorId: 'ricardo-brenes', trabajoId: 'M01', datos: { resultado: 'confirmada', campos: [] } });
  });

  it('recibir: resuelto, aviso a Diego, evento recepcion_confirmada con actor Ricardo', async () => {
    await revisarPropuesta(demo.ctx, 'M01', 'ricardo-brenes', { tipo: 'confirmar' });
    await confirmarRecepcion(demo.ctx, 'M01', 'ricardo-brenes');
    const m01 = await trabajo('M01');
    expect(m01?.estado).toBe('resuelto');
    expect(m01?.resueltoEn).toEqual(enCR(MIE, '07:05'));
    const aDiego = (await avisosA('diego-rojas')).filter((a) => a.trabajoIds.includes('M01'));
    expect(aDiego).toHaveLength(1);
    expect(idsInternosEn(`${aDiego[0]?.titulo} ${aDiego[0]?.cuerpo}`)).toEqual([]);
    const ev = (await demo.ctx.db.select().from(eventos)).find((e) => e.tipo === 'recepcion_confirmada');
    expect(ev).toMatchObject({ actorId: 'ricardo-brenes', trabajoId: 'M01' });
    expect((await demo.ctx.db.select().from(seguimientos)).filter((s) => s.trabajoId === 'M01' && s.estado === 'pendiente')).toEqual([]);
  });
});

describe('V8 · Esteban corrige el plazo de M02', () => {
  it('plazo jue 26 17:00; revisión corregida [plazo]; aviso de asignación a Daniela; seguimiento propuesta respondido', async () => {
    await revisarPropuesta(demo.ctx, 'M02', 'esteban-castro', { tipo: 'corregir', cambios: { plazo: enCR(JUE, '17:00') } });
    expect(await trabajo('M02')).toMatchObject({ plazo: enCR(JUE, '17:00'), confirmacion: 'confirmado', confirmadoPorId: 'esteban-castro' });
    const [rev] = await cargarRevisiones(demo.ctx.db);
    expect(rev).toMatchObject({ resultado: 'corregida', campos: ['plazo'] });
    expect(rev?.propuesto.plazo).toEqual(enCR(VIE, '17:00'));
    expect(rev?.final?.plazo).toEqual(enCR(JUE, '17:00'));
    const aDaniela = (await avisosA('daniela-quesada')).filter((a) => a.trabajoIds.includes('M02'));
    expect(aDaniela).toHaveLength(1);
    expect(idsInternosEn(`${aDaniela[0]?.titulo} ${aDaniela[0]?.cuerpo}`)).toEqual([]);
    const seg = (await demo.ctx.db.select().from(seguimientos)).find((s) => s.trabajoId === 'M02' && s.tipo === 'propuesta');
    expect(seg?.estado).toBe('respondido');
  });

  it('sin cambios reales → ErrorDominio «No cambiaste nada» y nada cambia', async () => {
    await expect(
      revisarPropuesta(demo.ctx, 'M02', 'esteban-castro', { tipo: 'corregir', cambios: { plazo: enCR(VIE, '17:00') } }),
    ).rejects.toThrow('No cambiaste nada');
    expect(await cargarRevisiones(demo.ctx.db)).toEqual([]);
    expect((await trabajo('M02'))?.confirmacion).toBe('propuesto');
  });
});

describe('V9 · Ricardo descarta M01', () => {
  it('sale de la instantánea, queda en descartados; C05 recibe PEDIDOS-14 (el 13 sigue ocupado)', async () => {
    await revisarPropuesta(demo.ctx, 'M01', 'ricardo-brenes', { tipo: 'descartar', motivo: 'Ya las tengo' });
    await avanzarReloj(demo.ctx, 0);
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.some((t) => t.id === 'M01')).toBe(false);
    expect(inst.descartados).toEqual([{ id: 'M01', proyectoId: 'P4', numero: 13 }]);
    const [rev] = await cargarRevisiones(demo.ctx.db);
    expect(rev).toMatchObject({ resultado: 'descartada', final: null, motivo: 'Ya las tengo' });

    const r = await capturar(demo.ctx, 'sofia-navarro', 'La Colina pregunta si se puede adelantar la entrega de las vitrinas al jueves');
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    const creado = (await cargarInstantanea(demo.ctx.db)).trabajos.find((t) => t.id === r.trabajosCreados[0]);
    expect(creado).toMatchObject({ proyectoId: 'P4', numero: 14 });
    // Descartar no se revisa dos veces.
    await expect(revisarPropuesta(demo.ctx, 'M01', 'ricardo-brenes', { tipo: 'confirmar' })).rejects.toThrow(ErrorDominio);
  });
});

describe('V10 y regla 18 · nadie más revisa ni toca una propuesta ajena', () => {
  it('Daniela no puede confirmar M02: ErrorDominio con el nombre del dueño; nada cambia', async () => {
    await expect(revisarPropuesta(demo.ctx, 'M02', 'daniela-quesada', { tipo: 'confirmar' })).rejects.toThrow(
      'Solo Esteban Castro puede revisar',
    );
    expect((await trabajo('M02'))?.confirmacion).toBe('propuesto');
    expect(await cargarRevisiones(demo.ctx.db)).toEqual([]);
  });

  it('Diego no ve M01 mientras es una propuesta de Ricardo: no puede entregarlo ni cambiar su estado', async () => {
    const msg = 'Este trabajo todavía es una propuesta de Nexo para Ricardo Brenes.';
    await expect(declararEntrega(demo.ctx, 'M01', 'diego-rojas', { nota: 'Ya las mandé' })).rejects.toThrow(msg);
    await expect(cambiarEstado(demo.ctx, 'M01', 'diego-rojas', 'en_curso')).rejects.toThrow(msg);
    await expect(revisarPropuesta(demo.ctx, 'M01', 'nadie', { tipo: 'confirmar' })).rejects.toThrow(ErrorDominio);
    await expect(revisarPropuesta(demo.ctx, 'M99', 'ricardo-brenes', { tipo: 'confirmar' })).rejects.toThrow(ErrorDominio);
  });
});

describe('Regla 14a · escribir en la captura una propuesta de la que uno es parte la confirma', () => {
  const guias: Interpretacion = {
    tipo: 'trabajo_nuevo',
    titulo: 'Enviar las guías firmadas de los pedidos 1041 y 1042',
    proyectoId: 'P4',
    responsableId: 'diego-rojas',
    responsableSeguro: true,
    plazo: { dia: VIE, hora: '17:00' },
    urgente: false,
    conCostoProbable: false,
    relacionados: [],
    bloquea: [],
    repuestoFaltante: null,
  };

  it('el dueño (Ricardo): duplicado, M01 confirmado por él con revisión confirmada; no se crea otro trabajo', async () => {
    const r = await capturar({ ...demo.ctx, ia: iaFija(guias) }, 'ricardo-brenes', 'Diego me tiene que mandar las guías firmadas de 1041 y 1042');
    expect(r).toMatchObject({ estado: 'duplicado', trabajoId: 'M01', referencia: 'PEDIDOS-13' });
    expect(await trabajo('M01')).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes' });
    expect((await cargarRevisiones(demo.ctx.db)).map((x) => [x.trabajoId, x.personaId, x.resultado])).toEqual([['M01', 'ricardo-brenes', 'confirmada']]);
    expect((await cargarInstantanea(demo.ctx.db)).trabajos.filter((t) => t.origen === 'captura')).toEqual([]);
    const acc = (await demo.ctx.db.select().from(acciones)).find((a) => a.tipo === 'revisar_propuesta');
    expect(acc?.capturaId).toBe(r.capturaId);
  });

  it('la otra parte (Diego, que no ve M01): duplicado, confirmado por Diego y aviso «¿Lo recibiste?» a Ricardo', async () => {
    const r = await capturar({ ...demo.ctx, ia: iaFija(guias) }, 'diego-rojas', 'Tengo que mandarle a Ricardo las guías firmadas de 1041 y 1042');
    expect(r).toMatchObject({ estado: 'duplicado', trabajoId: 'M01' });
    expect(await trabajo('M01')).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: 'diego-rojas', duenoPropuestaId: 'ricardo-brenes' });
    const aRicardo = (await avisosA('ricardo-brenes')).filter((a) => a.trabajoIds.includes('M01'));
    expect(aRicardo.map((a) => a.titulo)).toEqual(['Diego Rojas entregó «Enviar las guías de entrega firmadas de los pedidos 1041 y 1042». ¿Lo recibiste?']);
    const rec = (await demo.ctx.db.select().from(seguimientos)).filter((s) => s.trabajoId === 'M01' && s.tipo === 'recepcion');
    expect(rec.map((s) => [s.destinatarioId, s.estado])).toEqual([['ricardo-brenes', 'pendiente']]);
  });

  it('alguien que no es parte (Sofía): no ve la propuesta y se crea un trabajo nuevo; M01 sigue propuesto', async () => {
    const r = await capturar({ ...demo.ctx, ia: iaFija(guias) }, 'sofia-navarro', 'Diego tiene que enviar las guías firmadas de 1041 y 1042');
    expect(r.estado).toBe('aplicada');
    expect((await trabajo('M01'))?.confirmacion).toBe('propuesto');
    expect(await cargarRevisiones(demo.ctx.db)).toEqual([]);
  });

  it('la IA no ve propuestas: citar M01 por su referencia desde otra persona «no existe»', async () => {
    const r = await capturar(
      {
        ...demo.ctx,
        ia: iaFija({ tipo: 'actualizacion', trabajoId: 'PEDIDOS-13', nuevoEstado: 'en_curso', nota: null, hayProblema: false, reprogramar: [], notasRelacionadas: [] }),
      },
      'diego-rojas',
      'Ya empecé con las guías',
    );
    expect(r).toMatchObject({ estado: 'error' });
    expect((await trabajo('M01'))?.estado).toBe('abierto');
  });
});
