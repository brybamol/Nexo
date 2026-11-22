// Lectura de correo dentro del reloj y servicio de correo (docs/08 regla 10, §5.4, §6, V1, V2, V4, V5; tarea R6a).
// Contra PGlite en memoria con los 8 buzones de la demo conectados (`prepararDemo({ correo: true })`).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENSAJES_BASE, type MensajeBase } from '@/correo/ejemplo/buzones';
import { acciones, avisos, buzones, mensajesLeidos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type ResumenLectura } from '@/dominio/tipos';
import { confianzaDe } from '@/motor/confianza';
import { calcularEsperas } from '@/motor/esperas';
import { planLectura } from '@/motor/ingesta';
import { instantaneaVisible, nombrador } from '@/motor/instantanea';
import { tick } from '@/motor/seguimiento';
import { conectarBuzon, leerCorreo, obtenerVistaCorreo, siguienteCorreo } from '@/servicios/correo';
import { reiniciarDemo } from '@/servicios/demo';
import { avanzarReloj, fijarReloj, irAlSiguienteEvento, obtenerAhora } from '@/servicios/reloj';
import { obtenerTasaCorreccion } from '@/servicios/tasa';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

vi.mock('@/motor/ingesta', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/ingesta')>();
  return { ...real, planLectura: vi.fn(real.planLectura) };
});
vi.mock('@/motor/seguimiento', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/seguimiento')>();
  return { ...real, tick: vi.fn(real.tick) };
});

const A_LAS = (h: string) => enCR('2026-11-25', h);
const RESUMEN_V1: ResumenLectura = {
  leidos: 23,
  laborales: 8,
  descartados: 4,
  creados: [],
  propuestos: ['M01', 'M02'],
  reconocidos: ['T27', 'T17', 'T28', 'T22'],
  entregas: ['M01'],
  sinConvertir: 0,
};
const VACIO: ResumenLectura = { leidos: 0, laborales: 0, descartados: 0, creados: [], propuestos: [], reconocidos: [], entregas: [], sinConvertir: 0 };

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '07:00', correo: true });
});
afterEach(async () => {
  await demo.cerrar();
  vi.mocked(planLectura).mockClear();
  vi.mocked(tick).mockClear();
});

const db = () => demo.ctx.db;
const filasLeidas = async () => db().select().from(mensajesLeidos);
const todasLasAcciones = async () => (await db().select().from(acciones)).sort((a, b) => a.id - b.id);
const lecturas = async () => (await todasLasAcciones()).filter((a) => a.tipo === 'leer_correo');

describe('V1 · avanzarReloj(5) desde las 7:00 lee el correo antes del tick', () => {
  it('lectura exacta, el tick da solo pedir_estado de T15 y T21 y ningún otro aviso', async () => {
    const r = await avanzarReloj(demo.ctx, 5);
    expect(r.ahora).toBe(A_LAS('07:05').toISOString());
    expect(r.lectura).toEqual(RESUMEN_V1);
    expect(r.acciones.map((a) => [a.tipo, a.destinatario?.id, a.trabajoIds])).toEqual([
      ['pedir_estado', 'lucia-mora', ['T15']],
      ['pedir_estado', 'diego-rojas', ['T21']],
    ]);
    const filasAvisos = await db().select().from(avisos);
    expect(filasAvisos.map((a) => [a.personaId, a.trabajoIds])).toEqual([
      ['lucia-mora', ['T15']],
      ['diego-rojas', ['T21']],
    ]);
  });

  it('una sola acción leer_correo, antes de las del tick; las de la lectura sin captura y sin ids internos', async () => {
    await avanzarReloj(demo.ctx, 5);
    const todas = await todasLasAcciones();
    const leer = todas.filter((a) => a.tipo === 'leer_correo');
    expect(leer).toHaveLength(1);
    const pedir = todas.filter((a) => a.tipo === 'pedir_estado');
    expect(pedir.every((p) => p.id > leer[0]!.id)).toBe(true);
    const deLectura = todas.filter((a) => a.id <= leer[0]!.id);
    expect(new Set(deLectura.map((a) => a.tipo))).toEqual(new Set(['reconocer_correo', 'proponer_trabajo', 'registrar_entrega', 'leer_correo']));
    expect(deLectura.every((a) => a.capturaId === null && a.en.getTime() === A_LAS('07:05').getTime())).toBe(true);
    expect(deLectura.flatMap((a) => idsInternosEn(`${a.motivo} ${a.hechoOrigen}`))).toEqual([]);
  });

  it('M01 y M02 propuestos con su dueño y referencia; T27 con la evidencia de los dos buzones', async () => {
    await avanzarReloj(demo.ctx, 5);
    const inst = await cargarInstantanea(db());
    const nombres = nombrador(inst);
    const m01 = inst.trabajos.find((t) => t.id === 'M01')!;
    expect(m01).toMatchObject({ confirmacion: 'propuesto', duenoPropuestaId: 'ricardo-brenes', origen: 'correo' });
    expect(m01.entrega?.porId).toBe('diego-rojas');
    expect(nombres.referencia('M01')).toBe('PEDIDOS-13');
    expect(confianzaDe(m01, inst.evidencias)).toBe('una_fuente');
    expect(inst.trabajos.find((t) => t.id === 'M02')).toMatchObject({ confirmacion: 'propuesto', duenoPropuestaId: 'esteban-castro' });
    expect(nombres.referencia('M02')).toBe('TRIGAL-7');
    const t27 = inst.evidencias.filter((e) => e.trabajoId === 'T27');
    expect(t27.map((e) => e.tipo)).toEqual(['pedido']);
    expect(t27[0]!.buzones).toEqual(expect.arrayContaining(['andres-vargas', 'ricardo-brenes']));
    expect(inst.seguimientos.filter((s) => s.tipo === 'propuesta').map((s) => s.trabajoId)).toEqual(['M01', 'M02']);
  });

  it('guarda las 23 copias con la hora de la lectura (§5.4)', async () => {
    await avanzarReloj(demo.ctx, 5);
    const filas = await filasLeidas();
    expect(filas).toHaveLength(23);
    expect(filas.every((f) => f.leidoEn.getTime() === A_LAS('07:05').getTime())).toBe(true);
    const porPersona = new Map<string, number>();
    for (const f of filas) porPersona.set(f.personaId, (porPersona.get(f.personaId) ?? 0) + 1);
    expect(Object.fromEntries(porPersona)).toEqual({
      'marcela-solis': 1,
      'andres-vargas': 3,
      'ricardo-brenes': 5,
      'paola-herrera': 3,
      'sofia-navarro': 3,
      'karla-jimenez': 3,
      'lucia-mora': 3,
      'esteban-castro': 2,
    });
  });
});

describe('V2 · nada se lee dos veces', () => {
  it('avanzarReloj(0) tras V1: sin filas nuevas, sin leer_correo, lectura null', async () => {
    await avanzarReloj(demo.ctx, 5);
    const r = await avanzarReloj(demo.ctx, 0);
    expect(r.lectura).toBeNull();
    expect(await filasLeidas()).toHaveLength(23);
    expect(await lecturas()).toHaveLength(1);
  });

  it('avanzando varias veces solo vuelve a leer cuando llega un mensaje nuevo (H5 a las 8:20)', async () => {
    expect((await avanzarReloj(demo.ctx, 5)).lectura).toEqual(RESUMEN_V1);
    expect((await avanzarReloj(demo.ctx, 30)).lectura).toBeNull();
    expect((await avanzarReloj(demo.ctx, 30)).lectura).toBeNull(); // 8:05
    const r = await avanzarReloj(demo.ctx, 20); // 8:25
    expect(r.lectura).toEqual({ ...VACIO, leidos: 2, laborales: 1, creados: ['M03'] });
    expect((await avanzarReloj(demo.ctx, 60)).lectura).toBeNull();
    expect(await filasLeidas()).toHaveLength(25);
    expect(await lecturas()).toHaveLength(2);
  });

  it('leerCorreo sin nada nuevo devuelve null y no toca la base', async () => {
    await avanzarReloj(demo.ctx, 5);
    const antes = (await todasLasAcciones()).length;
    expect(await leerCorreo(db(), A_LAS('07:05'))).toBeNull();
    expect((await todasLasAcciones()).length).toBe(antes);
  });
});

describe('correo apagado (sin buzones conectados)', () => {
  it('el reloj se comporta como siempre: lectura null, nada en mensajes_leidos, siguienteCorreo null', async () => {
    const apagado = await prepararDemo({ hora: '07:00' });
    try {
      const r = await avanzarReloj(apagado.ctx, 5);
      expect(r.lectura).toBeNull();
      expect(r.acciones.map((a) => [a.tipo, a.trabajoIds])).toEqual([
        ['pedir_estado', ['T15']],
        ['pedir_estado', ['T21']],
      ]);
      expect(await apagado.ctx.db.select().from(mensajesLeidos)).toEqual([]);
      expect((await apagado.ctx.db.select().from(acciones)).filter((a) => a.tipo === 'leer_correo')).toEqual([]);
      expect(await siguienteCorreo(apagado.ctx.db, A_LAS('07:05'))).toBeNull();
      expect(await leerCorreo(apagado.ctx.db, A_LAS('07:05'))).toBeNull();
      expect(vi.mocked(planLectura)).not.toHaveBeenCalled();
      // Siguiente evento: el del motor (10:00, T22), sin el correo de las 8:20.
      expect((await irAlSiguienteEvento(apagado.ctx)).ahora).toBe(A_LAS('10:00').toISOString());
    } finally {
      await apagado.cerrar();
    }
  });
});

describe('atomicidad: si la lectura o el tick fallan, el reloj no se mueve', () => {
  it('fallo en la lectura', async () => {
    vi.mocked(planLectura).mockImplementationOnce(() => {
      throw new Error('fallo de la lectura');
    });
    await expect(avanzarReloj(demo.ctx, 5)).rejects.toThrow('fallo de la lectura');
    expect(await obtenerAhora(demo.ctx)).toEqual(A_LAS('07:00'));
    expect(await filasLeidas()).toEqual([]);
    expect(await todasLasAcciones()).toEqual([]);
  });

  it('fallo en el tick después de leer: tampoco queda lo leído', async () => {
    vi.mocked(tick).mockImplementationOnce(() => {
      throw new Error('fallo del motor');
    });
    await expect(avanzarReloj(demo.ctx, 5)).rejects.toThrow('fallo del motor');
    expect(vi.mocked(planLectura)).toHaveBeenCalledTimes(1);
    expect(await obtenerAhora(demo.ctx)).toEqual(A_LAS('07:00'));
    expect(await filasLeidas()).toEqual([]);
    expect(await todasLasAcciones()).toEqual([]);
    expect((await cargarInstantanea(db())).trabajos.some((t) => t.id === 'M01')).toBe(false);
    // Y después funciona con normalidad.
    expect((await avanzarReloj(demo.ctx, 5)).lectura).toEqual(RESUMEN_V1);
  });

  it('la lectura va antes del tick: tick ve ya los trabajos del correo', async () => {
    await avanzarReloj(demo.ctx, 5);
    const inst = vi.mocked(tick).mock.calls.at(-1)?.[0];
    expect(inst?.trabajos.some((t) => t.id === 'M01')).toBe(true);
    expect(inst?.ahora).toEqual(A_LAS('07:05'));
  });
});

describe('V4 · las propuestas solo recuerdan a su dueño', () => {
  it('a las 11:05 recordatorio a Ricardo (M01) y a Esteban (M02); nada a Diego ni Daniela sobre ellos; a las 15:05 nada más', async () => {
    await avanzarReloj(demo.ctx, 5);
    const r = await fijarReloj(demo.ctx, A_LAS('11:05'));
    const sobrePropuestas = (as: typeof r.acciones) => as.filter((a) => a.trabajoIds.some((id) => id === 'M01' || id === 'M02'));
    expect(sobrePropuestas(r.acciones).map((a) => [a.tipo, a.destinatario?.id, a.trabajoIds])).toEqual([
      ['recordatorio', 'ricardo-brenes', ['M01']],
      ['recordatorio', 'esteban-castro', ['M02']],
    ]);
    const todas = await todasLasAcciones();
    expect(todas.filter((a) => (a.destinatarioId === 'diego-rojas' || a.destinatarioId === 'daniela-quesada') && a.trabajoIds.some((id) => id.startsWith('M')))).toEqual([]);
    const r2 = await fijarReloj(demo.ctx, A_LAS('15:05'));
    expect(sobrePropuestas(r2.acciones)).toEqual([]);
  });
});

describe('V5 · «Siguiente evento» y la llegada del correo', () => {
  it('desde las 8:14 va a las 8:20 (H5) antes que al siguiente evento del motor, y crea M03 confirmado por dos fuentes', async () => {
    await avanzarReloj(demo.ctx, 5);
    await fijarReloj(demo.ctx, A_LAS('08:14'));
    expect(await siguienteCorreo(db(), A_LAS('08:14'))).toEqual(A_LAS('08:20'));
    const avisosAntes = (await db().select().from(avisos)).length;
    const r = await irAlSiguienteEvento(demo.ctx);
    expect(r.ahora).toBe(A_LAS('08:20').toISOString());
    expect(r.acciones).toEqual([]);
    expect(r.lectura).toEqual({ ...VACIO, leidos: 2, laborales: 1, creados: ['M03'] });
    expect((await db().select().from(avisos)).length).toBe(avisosAntes);

    const inst = await cargarInstantanea(db());
    const m03 = inst.trabajos.find((t) => t.id === 'M03')!;
    expect(m03).toMatchObject({ confirmacion: 'confirmado', duenoPropuestaId: null, responsableId: 'ricardo-brenes', solicitadoPorId: 'andres-vargas' });
    expect(confianzaDe(m03, inst.evidencias)).toBe('dos_fuentes');
    expect(nombrador(inst).referencia('M03')).toBe('PEDIDOS-14');
    expect(inst.dependencias).toContainEqual({ trabajoId: 'M03', dependeDeId: 'T28' });

    // Ya no queda correo por llegar: el siguiente es el del motor (10:00, T22).
    expect(await siguienteCorreo(db(), A_LAS('08:20'))).toBeNull();
    const r2 = await irAlSiguienteEvento(demo.ctx);
    expect(r2.ahora).toBe(A_LAS('10:00').toISOString());
    expect(r2.lectura).toBeNull();
  });

  it('a las 7:00 recién reiniciada lee y pide los estados vencidos sin mover el reloj; luego salta a las 8:20', async () => {
    const r = await irAlSiguienteEvento(demo.ctx);
    expect(r.ahora).toBe(A_LAS('07:00').toISOString());
    expect(r.lectura).toEqual(RESUMEN_V1);
    expect(r.acciones.map((a) => [a.tipo, a.trabajoIds])).toEqual([
      ['pedir_estado', ['T15']],
      ['pedir_estado', ['T21']],
    ]);
    const r2 = await irAlSiguienteEvento(demo.ctx);
    expect(r2.ahora).toBe(A_LAS('08:20').toISOString());
    expect(r2.lectura?.creados).toEqual(['M03']);
  });

  it('con correo sin leer a la hora actual (un buzón recién conectado) lee sin mover el reloj', async () => {
    await avanzarReloj(demo.ctx, 5);
    await conectarBuzon(demo.ctx, 'daniela-quesada', 'daniela.quesada@friodelvalle.cr', 'gmail');
    const r = await irAlSiguienteEvento(demo.ctx);
    expect(r.ahora).toBe(A_LAS('07:05').toISOString());
    expect(r.lectura).not.toBeNull();
    expect(r.lectura!.leidos).toBeGreaterThan(0);
  });
});

describe('reiniciar la demo y volver a leer', () => {
  it('reiniciarDemo borra lo leído y deja los 8 buzones: la siguiente lectura es otra vez V1', async () => {
    await avanzarReloj(demo.ctx, 5);
    await reiniciarDemo(demo.ctx);
    expect(await filasLeidas()).toEqual([]);
    expect(await db().select().from(buzones)).toHaveLength(8);
    expect(await obtenerAhora(demo.ctx)).toEqual(A_LAS('07:00'));
    const r = await avanzarReloj(demo.ctx, 5);
    expect(r.lectura).toEqual(RESUMEN_V1);
    expect(await lecturas()).toHaveLength(1);
  });
});

describe('conectarBuzon', () => {
  it('conectar el buzón de Diego confirma M01 por dos fuentes y, como ya está entregado, pide a Ricardo que confirme el recibido', async () => {
    await avanzarReloj(demo.ctx, 5);
    await conectarBuzon(demo.ctx, 'diego-rojas', 'diego.rojas@friodelvalle.cr', 'gmail');
    const filaBuzon = (await db().select().from(buzones)).find((b) => b.personaId === 'diego-rojas');
    expect(filaBuzon).toMatchObject({ direccion: 'diego.rojas@friodelvalle.cr', proveedor: 'gmail', conectadoEn: A_LAS('07:05') });
    // Conectar no lee: lee el siguiente movimiento del reloj.
    expect(await filasLeidas()).toHaveLength(23);

    const r = await avanzarReloj(demo.ctx, 1);
    expect(r.lectura).toMatchObject({ creados: [], propuestos: [], entregas: [] });
    const inst = await cargarInstantanea(db());
    const m01 = inst.trabajos.find((t) => t.id === 'M01')!;
    expect(m01).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: null });
    expect(confianzaDe(m01, inst.evidencias)).toBe('dos_fuentes');
    expect(inst.seguimientos.filter((s) => s.trabajoId === 'M01').map((s) => [s.tipo, s.estado, s.destinatarioId])).toEqual([
      ['propuesta', 'respondido', 'ricardo-brenes'],
      ['recepcion', 'pendiente', 'ricardo-brenes'],
    ]);
    const avisosM01 = (await db().select().from(avisos)).filter((a) => a.trabajoIds.includes('M01'));
    expect(avisosM01.map((a) => a.personaId)).toEqual(['ricardo-brenes']);
    expect(inst.trabajos.filter((t) => t.origen === 'correo').map((t) => t.id)).toEqual(['M01', 'M02']);
  });

  it('un buzón de Outlook también se lee: Daniela confirma M02 por dos fuentes', async () => {
    await avanzarReloj(demo.ctx, 5);
    await conectarBuzon(demo.ctx, 'daniela-quesada', 'daniela.quesada@friodelvalle.cr', 'outlook');
    await avanzarReloj(demo.ctx, 1);
    const inst = await cargarInstantanea(db());
    expect(inst.trabajos.find((t) => t.id === 'M02')).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: null });
    const ev = inst.evidencias.find((e) => e.trabajoId === 'M02' && e.tipo === 'pedido')!;
    expect([...ev.buzones].sort()).toEqual(['daniela-quesada', 'esteban-castro']);
  });

  it('volver a conectar actualiza el proveedor sin duplicar el buzón', async () => {
    await conectarBuzon(demo.ctx, 'ricardo-brenes', 'ricardo.brenes@friodelvalle.cr', 'outlook');
    const filas = await db().select().from(buzones);
    expect(filas).toHaveLength(8);
    expect(filas.find((b) => b.personaId === 'ricardo-brenes')?.proveedor).toBe('outlook');
    // El mismo correo con otro proveedor da el mismo resultado.
    expect((await avanzarReloj(demo.ctx, 5)).lectura).toEqual(RESUMEN_V1);
  });

  it('CC14: rechaza direcciones de otro dominio, personas que no existen y proveedores desconocidos', async () => {
    await expect(conectarBuzon(demo.ctx, 'paola-herrera', 'paola@gmail.com', 'gmail')).rejects.toBeInstanceOf(ErrorDominio);
    await expect(conectarBuzon(demo.ctx, 'diego-rojas', 'diego.rojas@friodelvalle.cr.evil.com', 'gmail')).rejects.toBeInstanceOf(ErrorDominio);
    await expect(conectarBuzon(demo.ctx, 'nadie', 'nadie@friodelvalle.cr', 'gmail')).rejects.toBeInstanceOf(ErrorDominio);
    await expect(conectarBuzon(demo.ctx, 'diego-rojas', 'diego.rojas@friodelvalle.cr', 'yahoo' as 'gmail')).rejects.toBeInstanceOf(ErrorDominio);
    expect(await db().select().from(buzones)).toHaveLength(8);
  });
});

describe('obtenerVistaCorreo · la fuente vista por una persona', () => {
  it('buzones: las 12 personas con sus conteos (§5.4); los no conectados en cero', async () => {
    await avanzarReloj(demo.ctx, 5);
    const v = await obtenerVistaCorreo(demo.ctx, 'ricardo-brenes');
    expect(v.ahora).toEqual(A_LAS('07:05'));
    expect(v.buzones).toHaveLength(12);
    const conteo = Object.fromEntries(v.buzones.map((b) => [b.persona.id, [b.conectado, b.proveedor, b.leidos, b.laborales, b.personales, b.boletines]]));
    expect(conteo).toEqual({
      'marcela-solis': [true, 'gmail', 1, 1, 0, 0],
      'andres-vargas': [true, 'gmail', 3, 3, 0, 0],
      'ricardo-brenes': [true, 'gmail', 5, 4, 0, 1],
      'paola-herrera': [true, 'gmail', 3, 3, 0, 0],
      'sofia-navarro': [true, 'gmail', 3, 2, 1, 0],
      'karla-jimenez': [true, 'gmail', 3, 2, 1, 0],
      'lucia-mora': [true, 'gmail', 3, 2, 0, 1],
      'esteban-castro': [true, 'gmail', 2, 2, 0, 0],
      'diego-rojas': [false, null, 0, 0, 0, 0],
      'jose-alfaro': [false, null, 0, 0, 0, 0],
      'daniela-quesada': [false, null, 0, 0, 0, 0],
      'mario-chaves': [false, null, 0, 0, 0, 0],
    });
    expect(v.buzones[0]!.persona).toEqual({ id: 'marcela-solis', nombre: 'Marcela Solís', rol: 'Gerente general', area: 'Gerencia' });
  });

  it('qué entendió Nexo en el buzón de Ricardo: reconoció, propuso y registró la entrega, con cita y enlace propio', async () => {
    await avanzarReloj(demo.ctx, 5);
    const v = await obtenerVistaCorreo(demo.ctx, 'ricardo-brenes');
    expect(v.lineas.map((l) => [l.en, l.de.persona?.id ?? l.de.correo, l.resultado, l.trabajos.map((t) => t.referencia)])).toEqual([
      [enCR('2026-11-23', '09:00'), 'andres-vargas', 'reconocio', ['PEDIDOS-9']],
      [enCR('2026-11-23', '10:00'), 'paola-herrera', 'sin_compromisos', []],
      [enCR('2026-11-23', '15:00'), 'ricardo-brenes', 'propuso', ['PEDIDOS-13']],
      [enCR('2026-11-24', '16:30'), 'diego-rojas', 'entrega', ['PEDIDOS-13']],
    ]);
    const entrega = v.lineas[3]!;
    expect(entrega.cita).toBe('Ricardo, te adjunto las guías firmadas de 1041 y 1042.');
    expect(entrega.de).toMatchObject({ nombre: 'Diego Rojas', correo: 'diego.rojas@friodelvalle.cr' });
    expect(entrega.para.map((p) => p.id)).toEqual(['ricardo-brenes']);
    expect(entrega.trabajos[0]).toEqual({ id: 'M01', titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042', referencia: 'PEDIDOS-13' });
    expect(v.lineas.every((l) => typeof l.enlace === 'string' && l.enlace.length > 0 && l.cita.length > 0)).toBe(true);
    expect(v.lineas[0]!.para.map((p) => p.id)).toEqual(['ricardo-brenes', 'paola-herrera']);
    expect(v.sinConvertir).toEqual([]);
  });

  it('cada persona solo ve las líneas de su buzón; quien no está conectado no ve ninguna; nunca un trabajo que no ve', async () => {
    await avanzarReloj(demo.ctx, 5);
    const diego = await obtenerVistaCorreo(demo.ctx, 'diego-rojas');
    expect(diego.lineas).toEqual([]);
    const esteban = await obtenerVistaCorreo(demo.ctx, 'esteban-castro');
    expect(esteban.lineas.find((l) => l.resultado === 'propuso')?.trabajos.map((t) => t.referencia)).toEqual(['TRIGAL-7']);
    const sofia = await obtenerVistaCorreo(demo.ctx, 'sofia-navarro');
    expect(sofia.lineas.map((l) => [l.resultado, l.trabajos.map((t) => t.referencia)])).toEqual([
      ['sin_compromisos', []],
      ['reconocio', ['PEDIDOS-4']],
    ]);
    for (const quien of ['andres-vargas', 'paola-herrera', 'sofia-navarro', 'karla-jimenez', 'lucia-mora', 'marcela-solis']) {
      const v = await obtenerVistaCorreo(demo.ctx, quien);
      expect(v.lineas.flatMap((l) => l.trabajos.map((t) => t.id)).filter((id) => id === 'M01' || id === 'M02')).toEqual([]);
    }
  });

  it('de lo personal y los boletines no muestra nunca asunto ni remitente', async () => {
    await avanzarReloj(demo.ctx, 5);
    const externos = MENSAJES_BASE.filter((m) => !m.de.endsWith('@friodelvalle.cr') && !m.borrador);
    expect(externos.length).toBeGreaterThanOrEqual(4);
    for (const quien of ['ricardo-brenes', 'karla-jimenez', 'sofia-navarro', 'lucia-mora']) {
      const texto = JSON.stringify(await obtenerVistaCorreo(demo.ctx, quien));
      for (const m of externos) {
        expect(texto).not.toContain(m.de);
        expect(texto).not.toContain(m.asunto);
      }
    }
  });

  it('sin convertir: un pedido sin plazo aparece con su autor y su cita en los buzones de las partes', async () => {
    const extra: MensajeBase = {
      clave: 'z1-m1',
      hilo: 'Z1',
      asunto: 'Arqueo de caja',
      de: 'ricardo.brenes@friodelvalle.cr',
      para: ['karla.jimenez@friodelvalle.cr'],
      fecha: '2026-11-24',
      hora: '09:00',
      texto: 'Karla, ¿puedes revisar el arqueo de caja chica?',
    };
    MENSAJES_BASE.push(extra);
    try {
      const r = await avanzarReloj(demo.ctx, 5);
      expect(r.lectura?.sinConvertir).toBe(1);
      for (const quien of ['ricardo-brenes', 'karla-jimenez']) {
        const v = await obtenerVistaCorreo(demo.ctx, quien);
        expect(v.sinConvertir).toEqual([
          { en: enCR('2026-11-24', '09:00'), de: expect.objectContaining({ correo: 'ricardo.brenes@friodelvalle.cr' }), cita: 'Karla, ¿puedes revisar el arqueo de caja chica?' },
        ]);
        expect(v.lineas.find((l) => l.resultado === 'sin_plazo')?.trabajos).toEqual([]);
      }
      expect((await obtenerVistaCorreo(demo.ctx, 'andres-vargas')).sinConvertir).toEqual([]);
    } finally {
      MENSAJES_BASE.splice(MENSAJES_BASE.indexOf(extra), 1);
    }
  });

  it('esperas y tasa: la cadena de quién espera a quién con nombres y la tasa de corrección', async () => {
    await avanzarReloj(demo.ctx, 5);
    const v = await obtenerVistaCorreo(demo.ctx, 'marcela-solis');
    expect(v.tasa).toEqual(await obtenerTasaCorreccion(demo.ctx));
    expect(v.tasa).toMatchObject({ inferidos: 2, sinRevisar: 2, tasa: null });
    // Regla 23 sobre lo que ve quien mira, con nombres (el cuello de V17 aparece en el paso 13 del guion).
    const esperado = calcularEsperas(instantaneaVisible(await cargarInstantanea(db()), 'marcela-solis'));
    expect(v.esperas.cadenas.map((c) => c.trabajos.map((t) => t.id))).toEqual(esperado.cadenas.map((c) => c.trabajoIds));
    expect(v.esperas.cadenas.map((c) => c.personas.map((p) => p.id))).toEqual(esperado.cadenas.map((c) => c.personaIds));
    expect(v.esperas.cadenas.map((c) => c.proyectos.map((p) => p.id))).toEqual(esperado.cadenas.map((c) => c.proyectoIds));
    expect(v.esperas.cuellos.map((c) => [c.persona.id, c.proyectos.map((p) => p.id), c.esperando.map((p) => p.id)])).toEqual(
      esperado.cuellos.map((c) => [c.personaId, c.proyectoIds, c.esperando]),
    );
    expect(v.esperas.cadenas.length).toBeGreaterThan(0);
    expect(v.esperas.cadenas.flatMap((c) => c.proyectos).every((p) => p.nombre !== '')).toBe(true);
    for (const c of v.esperas.cadenas) {
      expect(c.trabajos.every((t) => t.referencia !== '' && t.titulo !== '')).toBe(true);
      expect(c.trabajos.some((t) => t.id === 'M01' || t.id === 'M02')).toBe(false);
    }
  });

  it('antes de leer, todo en cero; una persona que no existe es un error', async () => {
    const v = await obtenerVistaCorreo(demo.ctx, 'ricardo-brenes');
    expect(v.lineas).toEqual([]);
    expect(v.buzones.find((b) => b.persona.id === 'ricardo-brenes')).toMatchObject({ conectado: true, leidos: 0 });
    await expect(obtenerVistaCorreo(demo.ctx, 'nadie')).rejects.toBeInstanceOf(ErrorDominio);
  });
});
