// Integración del guion (§6.3 de docs/05; guion de 03 §4). Tarea 4.5; guion ampliado: reformas v2 (docs/08 §7.2, R8).
// Un solo prepararDemo a las 7:00 y los pasos del guion EN ORDEN, solo con los servicios que llama la interfaz,
// contra PGlite en memoria y sin simulaciones. El reloj se mueve como lo haría el presentador: «+5 min» y
// «Siguiente evento» (avanzarReloj / irAlSiguienteEvento, que ejecutan tick), nunca escribiendo en la tabla.
// Las pruebas de cada recorrido dependen unas de otras: cada `it` es un paso y parte del estado del anterior.
//
// El guion se recorre dos veces:
// - con el correo APAGADO (pasos 0–9 y la comprobación de textos): el guion original de 05 §6.3, intacto;
// - con el correo ENCENDIDO (los 8 buzones de la demo, como la demo real tras «Reiniciar»): los pasos 0–9 con el
//   MISMO resultado (docs/08 §7.2), más los pasos 10–13 del correo y la comprobación de textos (paso 14). En cada paso
//   0–9 se comprueba además que las propuestas leídas del correo (M01, M02) no cambian lo que ven las demás personas
//   ni las cifras de seguimiento.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acciones, avisos, capturas, eventos, notas, preguntas, revisiones, seguimientos as tablaSeguimientos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import type { ResumenLectura } from '@/dominio/tipos';
import { capturar } from '@/servicios/captura';
import { obtenerCifras } from '@/servicios/cifras';
import { listarTrabajos, obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { obtenerVistaCorreo } from '@/servicios/correo';
import { aprobarDecision, listarDecisiones } from '@/servicios/decisiones';
import { confirmarRecepcion, obtenerPermisosActuar } from '@/servicios/estado-trabajos';
import { obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import { preguntar } from '@/servicios/preguntar';
import { revisarPropuesta } from '@/servicios/propuestas';
import { listarProyectos } from '@/servicios/proyectos';
import { listarAcciones } from '@/servicios/registro';
import { avanzarReloj, irAlSiguienteEvento, obtenerAhora } from '@/servicios/reloj';
import { obtenerTasaCorreccion } from '@/servicios/tasa';
import type { AccionVista } from '@/servicios/vistas';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';
const C13 = '¿Cómo vamos con los pedidos de la semana?';
const MARCELA = 'marcela-solis';
const RICARDO = 'ricardo-brenes';
const ESTEBAN = 'esteban-castro';
const DIEGO = 'diego-rojas';
const DANIELA = 'daniela-quesada';
const RIESGO_E3 = ['T05', 'T06', 'T07', 'T10', 'T11', 'T13', 'T16', 'T17', 'T18'];
/** Lectura de las 7:05 (docs/08 V1 y §5.4). */
const LECTURA_V1: ResumenLectura = {
  leidos: 23,
  laborales: 8,
  descartados: 4,
  creados: [],
  propuestos: ['M01', 'M02'],
  reconocidos: ['T27', 'T17', 'T28', 'T22'],
  entregas: ['M01'],
  sinConvertir: 0,
};

const hora = (hhmm: string) => enCR(MIE, hhmm);
const dia = (fecha: string, hhmm: string) => enCR(fecha, hhmm);
const resumen = (as: AccionVista[]) => as.map((a) => [a.tipo, a.destinatario?.id ?? null, a.trabajoIds]);
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe.each([
  { modo: 'correo apagado', correo: false },
  { modo: 'correo encendido (8 buzones)', correo: true },
])('guion completo de la demo, $modo (servicios reales, PGlite en memoria)', ({ correo }) => {
  let demo: Demo;
  beforeAll(async () => {
    demo = await prepararDemo({ hora: '07:00', correo });
  });
  afterAll(async () => {
    await demo.cerrar();
  });

  const seguimientos = async () => (await obtenerCifras(demo.ctx)).seguimientos;
  async function marcas() {
    const ts = await listarTrabajos(demo.ctx);
    return {
      atrasados: ts.filter((t) => t.marcas.atrasado).map((t) => t.id).sort(),
      enRiesgo: ts.filter((t) => t.marcas.enRiesgo).map((t) => t.id).sort(),
    };
  }

  /**
   * Pasos 1–9 con el correo encendido: M01 (dueño Ricardo) y M02 (dueño Esteban) son propuestas y solo las ven sus
   * dueños (reglas 15 y 18). Nadie más las ve, ningún aviso las cita y no abren seguimientos de estado.
   */
  async function propuestasAisladas() {
    if (!correo) return;
    expect(ids(await listarTrabajos(demo.ctx)).filter((id) => id.startsWith('M'))).toEqual([]);
    expect(ids((await obtenerMiDia(demo.ctx, RICARDO)).propuestas)).toEqual(['M01']);
    expect(ids((await obtenerMiDia(demo.ctx, ESTEBAN)).propuestas)).toEqual(['M02']);
    for (const [p, m] of [
      [DIEGO, 'M01'],
      [DANIELA, 'M02'],
    ] as const) {
      const d = await obtenerMiDia(demo.ctx, p);
      expect(d.propuestas).toEqual([]);
      expect([...ids(d.debo), ...ids(d.esperoDeOtros), ...ids(d.porConfirmarRecibido)].filter((id) => id.startsWith('M'))).toEqual([]);
      expect(await obtenerTrabajo(demo.ctx, m, p)).toBeNull();
    }
    for (const p of [MARCELA, 'lucia-mora', 'jose-alfaro', 'andres-vargas']) expect((await obtenerMiDia(demo.ctx, p)).propuestas).toEqual([]);
    const filasAvisos = await demo.ctx.db.select().from(avisos);
    expect(filasAvisos.filter((a) => a.trabajoIds.some((id) => id.startsWith('M')))).toEqual([]);
    const segs = await demo.ctx.db.select().from(tablaSeguimientos);
    expect(segs.filter((s) => s.trabajoId.startsWith('M')).map((s) => [s.trabajoId, s.tipo, s.estado])).toEqual([
      ['M01', 'propuesta', 'pendiente'],
      ['M02', 'propuesta', 'pendiente'],
    ]);
  }

  it('paso 0 · 7:00, estado inicial: atrasados {T15, T21}; en riesgo {T16, T17, T18}; nada hecho por Nexo', async () => {
    expect(await obtenerAhora(demo.ctx)).toEqual(hora('07:00'));
    expect(await marcas()).toEqual({ atrasados: ['T15', 'T21'], enRiesgo: ['T16', 'T17', 'T18'] });
    expect(await listarAcciones(demo.ctx)).toEqual([]);
    expect(await seguimientos()).toBe(0);
  });

  it('paso 1 · «+5 min» → 7:05: Nexo lee el correo (si está encendido) y pide el estado de T15 a Lucía y de T21 a Diego', async () => {
    const r = await avanzarReloj(demo.ctx, 5);
    expect(new Date(r.ahora)).toEqual(hora('07:05'));
    expect(r.lectura).toEqual(correo ? LECTURA_V1 : null);
    expect(resumen(r.acciones)).toEqual([
      ['pedir_estado', 'lucia-mora', ['T15']],
      ['pedir_estado', 'diego-rojas', ['T21']],
    ]);
    expect(await seguimientos()).toBe(2);
    expect(await marcas()).toEqual({ atrasados: ['T15', 'T21'], enRiesgo: ['T16', 'T17', 'T18'] });
    // La lectura es UNA acción sin aviso; los dos únicos avisos son los pedidos de estado.
    const registro = await listarAcciones(demo.ctx);
    expect(registro.filter((a) => a.tipo === 'leer_correo')).toHaveLength(correo ? 1 : 0);
    expect((await demo.ctx.db.select().from(avisos)).map((a) => a.personaId).sort()).toEqual(['diego-rojas', 'lucia-mora']);
    if (correo) {
      const m01 = await obtenerTrabajo(demo.ctx, 'M01', RICARDO);
      expect(m01).toMatchObject({
        referencia: 'PEDIDOS-13',
        confirmacion: 'propuesto',
        confianza: 'una_fuente',
        dueno: { id: RICARDO },
        responsable: { id: DIEGO },
        solicitadoPor: { id: RICARDO },
        plazo: dia('2026-11-27', '17:00'),
        entrega: { por: { id: DIEGO } },
      });
      expect(await obtenerTrabajo(demo.ctx, 'M02', ESTEBAN)).toMatchObject({
        referencia: 'TRIGAL-7',
        confirmacion: 'propuesto',
        dueno: { id: ESTEBAN },
        responsable: { id: DANIELA },
        plazo: dia('2026-11-27', '17:00'),
      });
    }
    await propuestasAisladas();
  });

  it('paso 2 · 7:05 José escribe C01: T31 para Lucía, T04 bloqueado, propagación de E3 (8 seguimientos)', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(r.ia).toEqual({ implementacion: 'local', modelo: null, respaldo: false });
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosCreados).toEqual(['T31']);
    expect(r.avisosA).toContain('lucia-mora');
    // El resumen nombra el trabajo nuevo por su título y su referencia (siguiente número de La Colina) y el que bloquea.
    expect(r.resumen).toBe(
      'Creé «Conseguir compresor de 2 HP» (COLINA-8) para Lucía Mora, plazo mié 25 nov, 12:00, urgente. ' +
        '«Instalar unidad condensadora y compresor» (COLINA-4) queda bloqueado.',
    );

    const t31 = await obtenerTrabajo(demo.ctx, 'T31');
    expect(t31).toMatchObject({
      proyecto: { id: 'P1' },
      responsable: { id: 'lucia-mora' },
      solicitadoPor: { id: 'jose-alfaro' },
      plazo: hora('12:00'),
      urgente: true,
      seguimiento: { nivel: 0 },
    });
    expect(await obtenerTrabajo(demo.ctx, 'T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPor: { id: 'T31' } });
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.repuestos.find((x) => x.id === 'compresor-2hp')).toMatchObject({ faltanteReportadoPor: 'jose-alfaro', faltanteReportadoEn: hora('07:05') });
    expect(inst.seguimientos.find((s) => s.trabajoId === 'T31')).toMatchObject({ nivel: 0, estado: 'pendiente', proximoEn: hora('07:35') });

    // E3: en riesgo exactamente los nueve; 5 avisos de propagación, uno por persona, todos citan T15.
    expect((await marcas()).enRiesgo).toEqual(RIESGO_E3);
    const propagacion = (await listarAcciones(demo.ctx)).filter((a) => a.tipo === 'aviso' && a.destinatario?.id !== 'lucia-mora');
    expect(Object.fromEntries(propagacion.map((a) => [a.destinatario?.id, a.trabajoIds]))).toEqual({
      'mario-chaves': ['T05', 'T11'],
      'esteban-castro': ['T06'],
      'ricardo-brenes': ['T07'],
      'daniela-quesada': ['T10'],
      'sofia-navarro': ['T13'],
    });
    for (const p of propagacion) {
      const d = await obtenerMiDia(demo.ctx, p.destinatario!.id);
      const aviso = d.avisos.find((a) => a.tipoAccion === 'aviso' && a.trabajoIds.join() === p.trabajoIds.join());
      expect(aviso?.cuerpo).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
    }
    // 2 pedidos de estado + asignación a Lucía + 5 avisos de propagación.
    expect(await seguimientos()).toBe(8);
    await propuestasAisladas();
  });

  it('paso 3 · 7:06 Mi día de Lucía: T31 arriba, pedido por José y bloqueando T04; también T15 atrasado', async () => {
    const r = await avanzarReloj(demo.ctx, 1);
    expect(new Date(r.ahora)).toEqual(hora('07:06'));
    expect(r.acciones).toEqual([]);
    expect(r.lectura).toBeNull();
    const d = await obtenerMiDia(demo.ctx, 'lucia-mora');
    expect(d.ahora).toEqual(hora('07:06'));
    expect(d.debo[0]).toMatchObject({ id: 'T31', solicitadoPor: { id: 'jose-alfaro' } });
    expect(d.debo[0]?.bloquea).toEqual(expect.arrayContaining(['T04']));
    expect(d.debo.find((t) => t.id === 'T15')?.marcas.atrasado).toBe(true);
    await propuestasAisladas();
  });

  it('paso 4 · «Siguiente evento» ×2: 7:35 recordatorio a Lucía; 8:05 escalamiento a Esteban, dueño de La Colina, con el contexto y las tres acciones (10)', async () => {
    let r = await irAlSiguienteEvento(demo.ctx);
    expect(new Date(r.ahora)).toEqual(hora('07:35'));
    expect(resumen(r.acciones)).toEqual([['recordatorio', 'lucia-mora', ['T31']]]);
    expect(r.lectura).toBeNull();

    r = await irAlSiguienteEvento(demo.ctx);
    expect(new Date(r.ahora)).toEqual(hora('08:05'));
    expect(resumen(r.acciones)).toEqual([['escalamiento', 'esteban-castro', ['T31']]]);
    expect(r.lectura).toBeNull();
    const esteban = await obtenerMiDia(demo.ctx, 'esteban-castro');
    const esc = esteban.avisos.find((a) => a.tipoAccion === 'escalamiento');
    // Quién lo pidió, qué bloquea (T04, T05, T06 y T07, por título y referencia) y desde cuándo.
    for (const texto of ['José Alfaro', '«Instalar unidad condensadora y compresor» (COLINA-4)', '«Cableado y tablero de control» (COLINA-5)', '«Prueba de frío y entrega al cliente» (COLINA-6)', '«Facturar la instalación» (COLINA-7)', '7:05']) expect(esc?.cuerpo).toContain(texto);
    // Y lo que puede hacer: Esteban ve T31 en «Nexo te pide» y puede reasignar, mover el plazo o declarar bloqueo.
    for (const texto of ['reasignarlo', 'mover el plazo', 'declararlo bloqueado']) expect(esc?.cuerpo).toContain(texto);
    expect((await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro')).map((t) => t.id)).toEqual(['T31']);
    expect(Object.keys((await obtenerPermisosActuar(demo.ctx, 'esteban-castro', ['T31'])).trabajos)).toEqual(['T31']);
    // El jefe directo de Lucía ya no recibe nada por jerarquía.
    expect((await obtenerMiDia(demo.ctx, 'andres-vargas')).avisos.some((a) => a.tipoAccion === 'escalamiento')).toBe(false);
    expect(await seguimientos()).toBe(10);
    await propuestasAisladas();
  });

  it('paso 5 · 8:06 Mi día de Mario: un solo aviso con T05 y T11 (dos proyectos) que cita T15', async () => {
    const r = await avanzarReloj(demo.ctx, 1);
    expect(new Date(r.ahora)).toEqual(hora('08:06'));
    expect(r.acciones).toEqual([]);
    const d = await obtenerMiDia(demo.ctx, 'mario-chaves');
    expect(d.avisos).toHaveLength(1);
    const [aviso] = d.avisos;
    expect(aviso).toMatchObject({ tipoAccion: 'aviso', trabajoIds: ['T05', 'T11'], leido: false });
    expect(aviso?.cuerpo).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
    const t05 = d.debo.find((t) => t.id === 'T05');
    const t11 = d.debo.find((t) => t.id === 'T11');
    expect(t05?.marcas.enRiesgo).toBe(true);
    expect(t11?.marcas.enRiesgo).toBe(true);
    expect(t05?.proyecto.id).not.toBe(t11?.proyecto.id);
    await propuestasAisladas();
  });

  it('paso 6 · 8:10 Lucía escribe C11: D01 para Marcela, existencia 0, seguimiento de T31 respondido (11)', async () => {
    const t = await avanzarReloj(demo.ctx, 4);
    expect(new Date(t.ahora)).toEqual(hora('08:10'));
    expect(t.acciones).toEqual([]);

    const r = await capturar(demo.ctx, 'lucia-mora', C11);
    expect(r.ia.implementacion).toBe('local');
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01', trabajosCreados: [] });
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.decisiones.find((d) => d.id === 'D01')).toMatchObject({ decisorId: MARCELA, proponenteId: 'lucia-mora', estado: 'pendiente' });
    expect(inst.repuestos.find((x) => x.id === 'compresor-2hp')?.existencia).toBe(0);
    expect(inst.seguimientos.find((s) => s.trabajoId === 'T31')).toMatchObject({ nivel: 2, estado: 'respondido' });
    expect(await seguimientos()).toBe(11);
    await propuestasAisladas();
  });

  it('paso 7 · 8:12 Marcela abre Decisiones y aprueba A: T32 para Karla, riesgo retirado, T04 con solución 15:00 (19)', async () => {
    const t = await avanzarReloj(demo.ctx, 2);
    expect(new Date(t.ahora)).toEqual(hora('08:12'));
    expect(t.acciones).toEqual([]);

    const bandeja = await listarDecisiones(demo.ctx, { decisorId: MARCELA });
    expect(bandeja.map((d) => d.id)).toEqual(['D01']);
    expect(bandeja[0]?.opciones.map((o) => [o.letra, o.costo, o.costoTexto])).toEqual([
      ['A', 1_380_000, '₡1.380.000'],
      ['B', 1_140_000, '₡1.140.000'],
      ['C', 1_220_000, '₡1.220.000'],
    ]);
    expect((await obtenerMiDia(demo.ctx, MARCELA)).decisionesPendientes.map((d) => d.id)).toEqual(['D01']);

    const r = await aprobarDecision(demo.ctx, 'D01', 'A', MARCELA);
    expect(r.trabajosCreados).toEqual(['T32']);
    expect([...r.avisosA].sort()).toEqual(
      ['daniela-quesada', 'esteban-castro', 'jose-alfaro', 'karla-jimenez', 'lucia-mora', 'mario-chaves', 'ricardo-brenes', 'sofia-navarro'],
    );
    expect(await obtenerTrabajo(demo.ctx, 'T32')).toMatchObject({
      titulo: 'Comprar 3 compresores de 2 HP al proveedor local',
      responsable: { id: 'karla-jimenez' },
      solicitadoPor: { id: MARCELA },
      plazo: hora('15:00'),
    });
    expect(await obtenerTrabajo(demo.ctx, 'T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPor: { id: 'T31' }, fechaSolucion: hora('15:00') });
    expect(await obtenerTrabajo(demo.ctx, 'T31')).toMatchObject({ estado: 'en_curso', plazo: hora('15:00') });
    expect((await marcas()).enRiesgo).toEqual(['T16', 'T17', 'T18']);
    expect((await listarDecisiones(demo.ctx, { decisorId: MARCELA, estado: 'pendiente' }))).toEqual([]);
    expect(await seguimientos()).toBe(19);
    await propuestasAisladas();
  });

  it('paso 8 · 8:13 Marcela pregunta C13: 7 pedidos con sus cifras, enlaces y el motivo del atraso de 1043', async () => {
    const t = await avanzarReloj(demo.ctx, 1);
    expect(new Date(t.ahora)).toEqual(hora('08:13'));
    expect(t.acciones).toEqual([]);
    const antes = (await listarTrabajos(demo.ctx)).length;

    const r = await preguntar(demo.ctx, MARCELA, C13);
    expect(r.tema).toBe('pedidos_semana');
    expect(r.ia).toMatchObject({ implementacion: 'local', respaldo: false });
    expect(r.datos).toMatchObject({ total: 7, entregados: [1041, 1042], enRutaHoy: [1044], atrasados: [1043], pendientes: [1045, 1046, 1047] });
    expect(r.fuentes.map((f) => f.trabajoId)).toEqual(['T19', 'T20', 'T21', 'T23', 'T24', 'T25', 'T26']);
    expect(r.texto).toContain('Sofía Navarro');
    expect(r.texto).toMatch(/pago/);
    expect(r.texto).toMatch(/cliente estaba cerrado/i);
    expect((await listarTrabajos(demo.ctx)).length).toBe(antes);
    await propuestasAisladas();
  });

  it('paso 9 · 8:14 proyectos y registro: 6 de 8 (75 %), 19 seguimientos, 3,4 h; ningún escalamiento a Marcela', async () => {
    const t = await avanzarReloj(demo.ctx, 1);
    expect(new Date(t.ahora)).toEqual(hora('08:14'));
    expect(t.acciones).toEqual([]);

    expect(await obtenerCifras(demo.ctx)).toEqual({
      resueltosSinGerente: 6,
      resueltosTotal: 8,
      porcentaje: 75,
      seguimientos: 19,
      preguntasRespondidas: 1,
      minutosAhorrados: 205,
      horasAhorradas: 3.4,
    });

    const proyectos = await listarProyectos(demo.ctx);
    expect(proyectos).toHaveLength(5);
    const suma = (k: 'atrasados' | 'enRiesgo' | 'bloqueados' | 'resueltos' | 'total') => proyectos.reduce((n, p) => n + p[k], 0);
    expect([suma('total'), suma('resueltos'), suma('bloqueados'), suma('atrasados'), suma('enRiesgo')]).toEqual([32, 8, 1, 2, 3]);

    const registro = await listarAcciones(demo.ctx);
    const tiempos = registro.map((a) => a.en.getTime());
    expect(tiempos).toEqual([...tiempos].sort((a, b) => b - a));
    expect(registro.filter((a) => a.tipo === 'escalamiento' && a.destinatario?.id === MARCELA)).toEqual([]);
    expect(registro.filter((a) => a.tipo === 'escalamiento').map((a) => a.destinatario?.id)).toEqual(['esteban-castro']);
    const cuenta = (tipo: string) => registro.filter((a) => a.tipo === tipo).length;
    expect({
      pedir_estado: cuenta('pedir_estado'),
      recordatorio: cuenta('recordatorio'),
      escalamiento: cuenta('escalamiento'),
      aviso: cuenta('aviso'),
      crear_decision: cuenta('crear_decision'),
      aplicar_decision: cuenta('aplicar_decision'),
    }).toEqual({ pedir_estado: 2, recordatorio: 1, escalamiento: 1, aviso: 15, crear_decision: 1, aplicar_decision: 1 });
    // La pregunta de C13 no es una acción del registro: se guarda en `preguntas` y cuenta en la cifra 3.
    if (correo) {
      expect({
        leer_correo: cuenta('leer_correo'),
        reconocer_correo: cuenta('reconocer_correo'),
        proponer_trabajo: cuenta('proponer_trabajo'),
        registrar_entrega: cuenta('registrar_entrega'),
      }).toEqual({ leer_correo: 1, reconocer_correo: 4, proponer_trabajo: 2, registrar_entrega: 1 });
    }
    await propuestasAisladas();
  });

  // ─── Pasos del correo (docs/08 §7.2): solo con los buzones conectados ────────────

  it.runIf(correo)('paso 10 · «Siguiente evento» desde 8:14 → 8:20: llega el correo de la proforma y Nexo crea M03 (PEDIDOS-14), confirmado por los dos buzones y dependiente de T28', async () => {
    const r = await irAlSiguienteEvento(demo.ctx);
    expect(new Date(r.ahora)).toEqual(hora('08:20')); // el próximo correo, antes que el siguiente evento del motor (10:00)
    expect(r.acciones).toEqual([]);
    expect(r.lectura).toEqual({
      leidos: 2,
      laborales: 1,
      descartados: 0,
      creados: ['M03'],
      propuestos: [],
      reconocidos: [],
      entregas: [],
      sinConvertir: 0,
    });
    const m03 = await obtenerTrabajo(demo.ctx, 'M03'); // vista general: ya es de todos
    expect(m03).toMatchObject({
      referencia: 'PEDIDOS-14',
      titulo: 'Emitir la factura proforma de la cámara fría del Hotel Mirador',
      origen: 'correo',
      confirmacion: 'confirmado',
      confianza: 'dos_fuentes',
      confirmadoPor: null,
      dueno: null,
      responsable: { id: RICARDO },
      solicitadoPor: { id: 'andres-vargas' },
      plazo: dia('2026-11-27', '17:00'),
      dependeDe: ['T28'],
      estado: 'abierto',
    });
    // Sin aviso: el responsable ya tiene el correo; sin seguimiento (no está vencido).
    expect((await demo.ctx.db.select().from(avisos)).filter((a) => a.trabajoIds.includes('M03'))).toEqual([]);
    expect(await seguimientos()).toBe(19);
    const registro = await listarAcciones(demo.ctx);
    expect(registro.filter((a) => a.tipo === 'crear_trabajo' && a.trabajoIds.includes('M03'))).toHaveLength(1);
    expect(registro.filter((a) => a.tipo === 'leer_correo')).toHaveLength(2);
    // Las demás marcas no cambian, y las propuestas siguen siendo solo de sus dueños.
    expect(await marcas()).toEqual({ atrasados: ['T15', 'T21'], enRiesgo: ['T16', 'T17', 'T18'] });
    expect(ids(await listarTrabajos(demo.ctx)).filter((id) => id.startsWith('M'))).toEqual(['M03']);
    expect(await obtenerTrabajo(demo.ctx, 'M01', DIEGO)).toBeNull();
  });

  it.runIf(correo)('paso 11 · 8:21 Ricardo confirma la propuesta de las guías y da por recibida la entrega de Diego: M01 resuelto, aviso a Diego (20)', async () => {
    const t = await avanzarReloj(demo.ctx, 1);
    expect(new Date(t.ahora)).toEqual(hora('08:21'));
    expect(t.acciones).toEqual([]);
    expect(t.lectura).toBeNull();

    const d = await obtenerMiDia(demo.ctx, RICARDO);
    expect(ids(d.propuestas)).toEqual(['M01']);
    expect(d.propuestas[0]).toMatchObject({ confianza: 'una_fuente', entrega: { por: { id: DIEGO }, en: dia('2026-11-24', '16:30') } });
    expect(d.debo.find((x) => x.id === 'M03')).toMatchObject({ confianza: 'dos_fuentes', referencia: 'PEDIDOS-14' });
    expect(d.porConfirmarRecibido).toEqual([]);

    const avisosAntes = (await demo.ctx.db.select().from(avisos)).length;
    await revisarPropuesta(demo.ctx, 'M01', RICARDO, { tipo: 'confirmar' });
    // Confirmar no avisa a nadie: tiene entrega y quien revisa es quien la pidió (seguimiento de recepción en silencio).
    expect((await demo.ctx.db.select().from(avisos)).length).toBe(avisosAntes);
    expect(await seguimientos()).toBe(19);
    expect(await obtenerTrabajo(demo.ctx, 'M01')).toMatchObject({ confirmacion: 'confirmado', confirmadoPor: { id: RICARDO }, confianza: 'persona', estado: 'abierto' });
    const tras = await obtenerMiDia(demo.ctx, RICARDO);
    expect(tras.propuestas).toEqual([]);
    expect(ids(tras.porConfirmarRecibido)).toEqual(['M01']);
    // Ya confirmado, Diego lo ve como entregado y sin pedir estado.
    expect(await obtenerTrabajo(demo.ctx, 'M01', DIEGO)).toMatchObject({ entrega: { por: { id: DIEGO } } });

    await confirmarRecepcion(demo.ctx, 'M01', RICARDO);
    expect(await obtenerTrabajo(demo.ctx, 'M01')).toMatchObject({ estado: 'resuelto', entrega: { por: { id: DIEGO } } });
    const nuevos = (await demo.ctx.db.select().from(avisos)).slice(avisosAntes);
    expect(nuevos.map((a) => [a.personaId, a.trabajoIds])).toEqual([[DIEGO, ['M01']]]);
    expect(nuevos[0]?.cuerpo).toContain('Ricardo Brenes');
    const ev = (await demo.ctx.db.select().from(eventos)).filter((e) => e.tipo === 'recepcion_confirmada');
    expect(ev.map((e) => [e.trabajoId, e.actorId])).toEqual([['M01', RICARDO]]);
    expect((await obtenerMiDia(demo.ctx, RICARDO)).porConfirmarRecibido).toEqual([]);
    expect(await seguimientos()).toBe(20);
  });

  it.runIf(correo)('paso 12 · 8:22 Esteban corrige el plazo de la propuesta de las fotos (jue 26 17:00): aviso de asignación a Daniela (21)', async () => {
    const t = await avanzarReloj(demo.ctx, 1);
    expect(new Date(t.ahora)).toEqual(hora('08:22'));
    expect(t.acciones).toEqual([]);

    const d = await obtenerMiDia(demo.ctx, ESTEBAN);
    expect(ids(d.propuestas)).toEqual(['M02']);
    const avisosAntes = (await demo.ctx.db.select().from(avisos)).length;
    await revisarPropuesta(demo.ctx, 'M02', ESTEBAN, { tipo: 'corregir', cambios: { plazo: dia('2026-11-26', '17:00') } });

    expect(await obtenerTrabajo(demo.ctx, 'M02')).toMatchObject({
      referencia: 'TRIGAL-7',
      confirmacion: 'confirmado',
      confirmadoPor: { id: ESTEBAN },
      responsable: { id: DANIELA },
      plazo: dia('2026-11-26', '17:00'),
    });
    const rev = (await demo.ctx.db.select().from(revisiones)).filter((x) => x.trabajoId === 'M02');
    expect(rev).toHaveLength(1);
    expect(rev[0]).toMatchObject({ personaId: ESTEBAN, resultado: 'corregida', campos: ['plazo'] });
    expect(new Date(rev[0]!.propuesto.plazo!)).toEqual(dia('2026-11-27', '17:00'));
    expect(new Date(rev[0]!.final!.plazo!)).toEqual(dia('2026-11-26', '17:00'));
    const nuevos = (await demo.ctx.db.select().from(avisos)).slice(avisosAntes);
    expect(nuevos.map((a) => [a.personaId, a.trabajoIds])).toEqual([[DANIELA, ['M02']]]);
    const segs = (await demo.ctx.db.select().from(tablaSeguimientos)).filter((s) => s.trabajoId === 'M02');
    expect(segs.map((s) => [s.tipo, s.estado])).toEqual([['propuesta', 'respondido']]);
    // Ahora Daniela lo tiene en «Lo que debo» y Esteban ya no tiene propuestas.
    expect(ids((await obtenerMiDia(demo.ctx, DANIELA)).debo)).toContain('M02');
    expect((await obtenerMiDia(demo.ctx, ESTEBAN)).propuestas).toEqual([]);
    expect(await seguimientos()).toBe(21);
  });

  it.runIf(correo)('paso 13 · 8:23 Marcela: 7 de 9 (78 %), 21 seguimientos, 3,8 h; tasa de corrección 50 %; Lucía Mora es el cuello de botella', async () => {
    const t = await avanzarReloj(demo.ctx, 1);
    expect(new Date(t.ahora)).toEqual(hora('08:23'));
    expect(t.acciones).toEqual([]);

    expect(await obtenerCifras(demo.ctx)).toEqual({
      resueltosSinGerente: 7,
      resueltosTotal: 9,
      porcentaje: 78,
      seguimientos: 21,
      preguntasRespondidas: 1,
      minutosAhorrados: 225,
      horasAhorradas: 3.8,
    });
    expect(await obtenerTasaCorreccion(demo.ctx)).toEqual({
      inferidos: 3,
      revisadas: 2,
      confirmadas: 1,
      corregidas: 1,
      descartadas: 0,
      porCampo: { titulo: 0, responsable: 0, plazo: 1, proyecto: 0 },
      confirmadasPorFuentes: 1,
      sinRevisar: 0,
      tasa: 50,
    });

    const proyectos = await listarProyectos(demo.ctx);
    const suma = (k: 'atrasados' | 'enRiesgo' | 'bloqueados' | 'resueltos' | 'total') => proyectos.reduce((n, p) => n + p[k], 0);
    expect([suma('total'), suma('resueltos'), suma('bloqueados'), suma('atrasados'), suma('enRiesgo')]).toEqual([35, 9, 1, 2, 3]);

    const vista = await obtenerVistaCorreo(demo.ctx, MARCELA);
    expect(vista.esperas.cuellos.map((c) => [c.persona.id, c.proyectos.map((p) => p.id)])).toEqual([['lucia-mora', ['P1', 'P3']]]);
    expect(vista.esperas.cuellos[0]?.esperando).toHaveLength(6);
    expect(vista.tasa.tasa).toBe(50);

    const registro = await listarAcciones(demo.ctx);
    expect(registro.filter((a) => a.tipo === 'escalamiento' && a.destinatario?.id === MARCELA)).toEqual([]);
    const cuenta = (tipo: string) => registro.filter((a) => a.tipo === tipo).length;
    const tipos = [...new Set(registro.map((a) => a.tipo))];
    expect(Object.fromEntries(tipos.sort().map((k) => [k, cuenta(k)]))).toEqual({
      aplicar_decision: 1,
      aviso: 17,
      confirmar_recepcion: 1,
      corregir_existencia: 1, // C11 (paso 6): existencia del compresor a 0; ya estaba en el guion original
      crear_decision: 1,
      crear_trabajo: 2,
      escalamiento: 1,
      leer_correo: 2,
      pedir_estado: 2,
      proponer_trabajo: 2,
      reconocer_correo: 4,
      recordatorio: 1,
      registrar_entrega: 1,
      revisar_propuesta: 2,
    });
  });

  // ─── Textos (antiguo paso 10; paso 14 con el correo) ────────────

  it(`paso ${correo ? 14 : 10} · ningún texto que generó Nexo en el guion lleva un id interno suelto (T04, M01, D01…)`, async () => {
    const { db } = demo.ctx;
    const textos: [string, string][] = [];
    const agregar = (donde: string, t: string | null | undefined) => {
      if (t) textos.push([donde, t]);
    };
    for (const a of await db.select().from(avisos)) {
      agregar('aviso.titulo', a.titulo);
      agregar('aviso.cuerpo', a.cuerpo);
    }
    for (const a of await db.select().from(acciones)) {
      agregar('accion.motivo', a.motivo);
      agregar('accion.hechoOrigen', a.hechoOrigen);
    }
    for (const c of await db.select().from(capturas)) {
      const r = c.resultado as { resumen?: string; mensaje?: string; pregunta?: string } | null;
      agregar('captura.resumen', r?.resumen);
      agregar('captura.mensaje', r?.mensaje);
      agregar('captura.pregunta', c.pregunta);
    }
    for (const n of await db.select().from(notas)) if (n.autorId === null) agregar('nota de Nexo', n.texto);
    for (const q of await db.select().from(preguntas)) {
      agregar('pregunta.respuesta', q.respuesta);
      for (const f of q.fuentes) agregar('pregunta.fuente', f.etiqueta);
    }
    for (const d of await listarDecisiones(demo.ctx)) {
      agregar('decision.titulo', d.titulo);
      agregar('decision.contexto', d.contexto);
      for (const o of d.opciones) {
        agregar('opcion.descripcion', o.descripcion);
        agregar('opcion.consecuencia', o.consecuencia);
      }
    }
    if (correo) {
      // La pantalla Correo de cada persona con buzón: citas, trabajos enlazados, sin convertir y quién espera a quién.
      for (const p of [MARCELA, 'andres-vargas', RICARDO, 'paola-herrera', 'sofia-navarro', 'karla-jimenez', 'lucia-mora', ESTEBAN]) {
        const v = await obtenerVistaCorreo(demo.ctx, p);
        expect(v.lineas.length).toBeGreaterThan(0);
        for (const l of v.lineas) {
          agregar('correo.cita', l.cita);
          for (const r of l.trabajos) agregar('correo.trabajo', `${r.titulo} ${r.referencia}`);
        }
        for (const s of v.sinConvertir) agregar('correo.sinConvertir', s.cita);
        for (const c of v.esperas.cadenas) for (const r of c.trabajos) agregar('correo.cadena', `${r.titulo} ${r.referencia}`);
      }
    }
    expect(textos.length).toBeGreaterThan(correo ? 60 : 40);
    expect(textos.filter(([, t]) => idsInternosEn(t).length > 0)).toEqual([]);

    // Referencias de lo creado en el guion: cada proyecto lleva su cuenta.
    expect((await obtenerTrabajo(demo.ctx, 'T31'))?.referencia).toBe('COLINA-8');
    expect((await obtenerTrabajo(demo.ctx, 'T32'))?.referencia).toBe('COLINA-9');
    if (correo) {
      expect((await obtenerTrabajo(demo.ctx, 'M01'))?.referencia).toBe('PEDIDOS-13');
      expect((await obtenerTrabajo(demo.ctx, 'M02'))?.referencia).toBe('TRIGAL-7');
      expect((await obtenerTrabajo(demo.ctx, 'M03'))?.referencia).toBe('PEDIDOS-14');
    }
    expect((await listarDecisiones(demo.ctx)).map((d) => [d.titulo, d.referencia])).toEqual([['Compra de 3 compresores de 2 HP', 'COLINA-D1']]);
  });
});
