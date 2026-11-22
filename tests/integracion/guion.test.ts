// Integración del guion (§6.3 de docs/05; guion de 03 §4). Tarea 4.5.
// Un solo prepararDemo a las 7:00 y los pasos del guion EN ORDEN, solo con los servicios que llama la interfaz,
// contra PGlite en memoria y sin simulaciones. El reloj se mueve como lo haría el presentador: «+5 min» y
// «Siguiente evento» (avanzarReloj / irAlSiguienteEvento, que ejecutan tick), nunca escribiendo en la tabla.
// Las pruebas de este archivo dependen unas de otras: cada `it` es un paso y parte del estado del anterior.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acciones, avisos, capturas, notas, preguntas } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import { capturar } from '@/servicios/captura';
import { obtenerCifras } from '@/servicios/cifras';
import { listarTrabajos, obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { aprobarDecision, listarDecisiones } from '@/servicios/decisiones';
import { obtenerPermisosActuar } from '@/servicios/estado-trabajos';
import { obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import { preguntar } from '@/servicios/preguntar';
import { listarProyectos } from '@/servicios/proyectos';
import { listarAcciones } from '@/servicios/registro';
import { avanzarReloj, irAlSiguienteEvento, obtenerAhora } from '@/servicios/reloj';
import type { AccionVista } from '@/servicios/vistas';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';
const C13 = '¿Cómo vamos con los pedidos de la semana?';
const MARCELA = 'marcela-solis';
const RIESGO_E3 = ['T05', 'T06', 'T07', 'T10', 'T11', 'T13', 'T16', 'T17', 'T18'];

let demo: Demo;
beforeAll(async () => {
  demo = await prepararDemo({ hora: '07:00' });
});
afterAll(async () => {
  await demo.cerrar();
});

const hora = (hhmm: string) => enCR(MIE, hhmm);
const resumen = (as: AccionVista[]) => as.map((a) => [a.tipo, a.destinatario?.id ?? null, a.trabajoIds]);
const seguimientos = async () => (await obtenerCifras(demo.ctx)).seguimientos;
async function marcas() {
  const ts = await listarTrabajos(demo.ctx);
  return {
    atrasados: ts.filter((t) => t.marcas.atrasado).map((t) => t.id).sort(),
    enRiesgo: ts.filter((t) => t.marcas.enRiesgo).map((t) => t.id).sort(),
  };
}

describe('guion completo de la demo (servicios reales, PGlite en memoria)', () => {
  it('paso 0 · 7:00, estado inicial: atrasados {T15, T21}; en riesgo {T16, T17, T18}; nada hecho por Nexo', async () => {
    expect(await obtenerAhora(demo.ctx)).toEqual(hora('07:00'));
    expect(await marcas()).toEqual({ atrasados: ['T15', 'T21'], enRiesgo: ['T16', 'T17', 'T18'] });
    expect(await listarAcciones(demo.ctx)).toEqual([]);
    expect(await seguimientos()).toBe(0);
  });

  it('paso 1 · «+5 min» → 7:05: Nexo pide el estado de T15 a Lucía y de T21 a Diego', async () => {
    const r = await avanzarReloj(demo.ctx, 5);
    expect(new Date(r.ahora)).toEqual(hora('07:05'));
    expect(resumen(r.acciones)).toEqual([
      ['pedir_estado', 'lucia-mora', ['T15']],
      ['pedir_estado', 'diego-rojas', ['T21']],
    ]);
    expect(await seguimientos()).toBe(2);
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
  });

  it('paso 3 · 7:06 Mi día de Lucía: T31 arriba, pedido por José y bloqueando T04; también T15 atrasado', async () => {
    const r = await avanzarReloj(demo.ctx, 1);
    expect(new Date(r.ahora)).toEqual(hora('07:06'));
    expect(r.acciones).toEqual([]);
    const d = await obtenerMiDia(demo.ctx, 'lucia-mora');
    expect(d.ahora).toEqual(hora('07:06'));
    expect(d.debo[0]).toMatchObject({ id: 'T31', solicitadoPor: { id: 'jose-alfaro' } });
    expect(d.debo[0]?.bloquea).toEqual(expect.arrayContaining(['T04']));
    expect(d.debo.find((t) => t.id === 'T15')?.marcas.atrasado).toBe(true);
  });

  it('paso 4 · «Siguiente evento» ×2: 7:35 recordatorio a Lucía; 8:05 escalamiento a Esteban, dueño de La Colina, con el contexto y las tres acciones (10)', async () => {
    let r = await irAlSiguienteEvento(demo.ctx);
    expect(new Date(r.ahora)).toEqual(hora('07:35'));
    expect(resumen(r.acciones)).toEqual([['recordatorio', 'lucia-mora', ['T31']]]);

    r = await irAlSiguienteEvento(demo.ctx);
    expect(new Date(r.ahora)).toEqual(hora('08:05'));
    expect(resumen(r.acciones)).toEqual([['escalamiento', 'esteban-castro', ['T31']]]);
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
  });

  it('paso 10 · ningún texto que generó Nexo en el guion lleva un id interno suelto (T04, D01…)', async () => {
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
    expect(textos.length).toBeGreaterThan(40);
    expect(textos.filter(([, t]) => idsInternosEn(t).length > 0)).toEqual([]);

    // Referencias de lo creado en el guion: cada proyecto lleva su cuenta.
    expect((await obtenerTrabajo(demo.ctx, 'T31'))?.referencia).toBe('COLINA-8');
    expect((await obtenerTrabajo(demo.ctx, 'T32'))?.referencia).toBe('COLINA-9');
    expect((await listarDecisiones(demo.ctx)).map((d) => [d.titulo, d.referencia])).toEqual([['Compra de 3 compresores de 2 HP', 'COLINA-D1']]);
  });
});
