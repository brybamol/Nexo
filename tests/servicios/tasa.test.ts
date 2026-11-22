// Cuánto se equivoca Nexo: tasa de corrección y casos de prueba (docs/08 regla 22; V14 y paso 13 del guion). Tarea R6b.
import { afterEach, describe, expect, it } from 'vitest';
import { cargarRevisiones } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import type { CampoCorregible, RevisionPropuesta, ResultadoRevision } from '@/dominio/tipos';
import { calcularTasaCorreccion, casoDePrueba } from '@/motor/tasa';
import { capturar, responderCaptura } from '@/servicios/captura';
import { exportarCasosDePrueba, obtenerTasaCorreccion } from '@/servicios/tasa';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const JUE = '2026-11-26';
const VIE = '2026-11-27';
const C10 = 'Alguien tiene que revisar el camión, hace un ruido raro';

let siguienteId = 1;
function rev(
  trabajoId: string | null,
  resultado: ResultadoRevision,
  campos: CampoCorregible[] = [],
  extra: Partial<RevisionPropuesta> = {},
): RevisionPropuesta {
  const propuesto = { titulo: `Propuesta ${trabajoId ?? ''}`, responsableId: 'diego-rojas', plazo: enCR(VIE, '17:00'), proyectoId: 'P4' };
  return {
    id: siguienteId++,
    en: enCR(MIE, '08:21'),
    personaId: 'ricardo-brenes',
    origen: 'correo',
    trabajoId,
    capturaId: null,
    resultado,
    campos,
    propuesto,
    final: resultado === 'descartada' ? null : { ...propuesto, ...(campos.includes('plazo') ? { plazo: enCR(JUE, '17:00') } : {}) },
    entrada: { cita: 'Diego, ¿puedes enviarme las guías…?', deId: 'ricardo-brenes', enviado: enCR('2026-11-23', '15:00') },
    motivo: null,
    ...extra,
  };
}

const VACIA = {
  inferidos: 0,
  revisadas: 0,
  confirmadas: 0,
  corregidas: 0,
  descartadas: 0,
  porCampo: { titulo: 0, responsable: 0, plazo: 0, proyecto: 0 },
  confirmadasPorFuentes: 0,
  sinRevisar: 0,
  tasa: null,
};

describe('calcularTasaCorreccion (pura, regla 22)', () => {
  it('cero propuestas: no divide por cero, tasa null («todavía no lo sé»)', () => {
    expect(calcularTasaCorreccion([], [])).toEqual(VACIA);
  });

  it('propuestos sin revisar: inferidos y sinRevisar, pero la tasa sigue siendo null', () => {
    const t = calcularTasaCorreccion([], [
      { id: 'M01', confirmacion: 'propuesto', confirmadoPorId: null },
      { id: 'M02', confirmacion: 'propuesto', confirmadoPorId: null },
    ]);
    expect(t).toMatchObject({ inferidos: 2, revisadas: 0, sinRevisar: 2, tasa: null });
  });

  it('paso 13 del guion: 1 confirmada, 1 corregida (plazo), 1 por dos fuentes → tasa 50', () => {
    const t = calcularTasaCorreccion(
      [rev('M01', 'confirmada'), rev('M02', 'corregida', ['plazo'], { personaId: 'esteban-castro', en: enCR(MIE, '08:22') })],
      [
        { id: 'M01', confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes' },
        { id: 'M02', confirmacion: 'confirmado', confirmadoPorId: 'esteban-castro' },
        { id: 'M03', confirmacion: 'confirmado', confirmadoPorId: null },
      ],
    );
    expect(t).toEqual({
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
  });

  it('solo cuenta la PRIMERA revisión humana de cada trabajo o captura (por fecha y luego id, sin importar el orden recibido)', () => {
    const primera = rev('M03', 'confirmada', [], { en: enCR(MIE, '08:30') });
    const segunda = rev('M03', 'corregida', ['titulo'], { en: enCR(MIE, '09:00') });
    const t = calcularTasaCorreccion([segunda, primera], [{ id: 'M03', confirmacion: 'confirmado', confirmadoPorId: 'andres-vargas' }]);
    expect(t).toMatchObject({ revisadas: 1, confirmadas: 1, corregidas: 0, confirmadasPorFuentes: 0, tasa: 0 });
    // Una revisada no cuenta como «por dos fuentes» aunque su confirmadoPorId sea null.
    expect(calcularTasaCorreccion([primera], [{ id: 'M03', confirmacion: 'confirmado', confirmadoPorId: null }]).confirmadasPorFuentes).toBe(0);
  });

  it('descartadas cuentan como error; una corrección suma en cada campo que cambió; redondeo entero', () => {
    const t = calcularTasaCorreccion(
      [rev('M01', 'descartada'), rev('M02', 'corregida', ['titulo', 'responsable', 'proyecto']), rev('M04', 'confirmada')],
      [
        { id: 'M01', confirmacion: 'descartado', confirmadoPorId: null },
        { id: 'M02', confirmacion: 'confirmado', confirmadoPorId: 'esteban-castro' },
        { id: 'M04', confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes' },
      ],
    );
    expect(t).toMatchObject({ inferidos: 3, revisadas: 3, confirmadas: 1, corregidas: 1, descartadas: 1, tasa: 67 });
    expect(t.porCampo).toEqual({ titulo: 1, responsable: 1, plazo: 0, proyecto: 1 });
  });

  it('las revisiones de captura cuentan en revisadas (por captura) pero no en inferidos', () => {
    const c = rev('T31', 'corregida', ['responsable'], { origen: 'captura', capturaId: 7, entrada: { texto: C10 } });
    const otra = rev('T31', 'confirmada', [], { origen: 'captura', capturaId: 7, en: enCR(MIE, '09:00') });
    expect(calcularTasaCorreccion([c, otra], [])).toMatchObject({ inferidos: 0, revisadas: 1, corregidas: 1, tasa: 100, porCampo: { responsable: 1 } });
  });

  it('casoDePrueba: { entrada, propuesto, esperado: final, resultado }, sin compartir objetos con la revisión', () => {
    const r = rev('M02', 'corregida', ['plazo']);
    const caso = casoDePrueba(r);
    expect(caso).toEqual({ entrada: r.entrada, propuesto: r.propuesto, esperado: r.final, resultado: 'corregida' });
    expect(caso.propuesto).not.toBe(r.propuesto);
    expect(casoDePrueba(rev('M01', 'descartada')).esperado).toBeNull();
  });
});

describe('V14 · servicio de la tasa con correo apagado', () => {
  let demo: Demo;
  afterEach(async () => {
    await demo.cerrar();
  });

  it('sin propuestas: todo en cero y tasa null; sin casos de prueba', async () => {
    demo = await prepararDemo();
    expect(await obtenerTasaCorreccion(demo.ctx)).toEqual(VACIA);
    expect(await exportarCasosDePrueba(demo.ctx)).toEqual([]);
  });

  it('C10 y responderCaptura con la propuesta (Lucía) → revisión confirmada de captura: revisadas 1, tasa 0', async () => {
    demo = await prepararDemo();
    const p = await capturar(demo.ctx, 'andres-vargas', C10);
    expect(p.estado).toBe('pregunta');
    const r = await responderCaptura(demo.ctx, p.capturaId, 'lucia-mora');
    expect(r.estado).toBe('aplicada');
    const [revision] = await cargarRevisiones(demo.ctx.db);
    expect(revision).toMatchObject({
      origen: 'captura',
      capturaId: p.capturaId,
      personaId: 'andres-vargas',
      resultado: 'confirmada',
      campos: [],
      trabajoId: 'T31',
      entrada: { texto: C10 },
    });
    expect(revision?.final?.responsableId).toBe('lucia-mora');
    expect(await obtenerTasaCorreccion(demo.ctx)).toMatchObject({ inferidos: 0, revisadas: 1, confirmadas: 1, tasa: 0 });
    expect(await exportarCasosDePrueba(demo.ctx)).toEqual([
      { entrada: { texto: C10 }, propuesto: revision?.propuesto, esperado: revision?.final, resultado: 'confirmada' },
    ]);
  });

  it('C10 respondida con otra persona (Diego) → corregida [responsable]: tasa 100', async () => {
    demo = await prepararDemo();
    const p = await capturar(demo.ctx, 'andres-vargas', C10);
    await responderCaptura(demo.ctx, p.capturaId, 'diego-rojas');
    const [revision] = await cargarRevisiones(demo.ctx.db);
    expect(revision).toMatchObject({ resultado: 'corregida', campos: ['responsable'] });
    expect([revision?.propuesto.responsableId, revision?.final?.responsableId]).toEqual(['lucia-mora', 'diego-rojas']);
    expect(await obtenerTasaCorreccion(demo.ctx)).toMatchObject({ revisadas: 1, corregidas: 1, porCampo: { responsable: 1 }, tasa: 100 });
  });

  it('una respuesta no válida no guarda revisión (la captura sigue esperando); las preguntas de cantidad no son propuestas', async () => {
    demo = await prepararDemo();
    const p = await capturar(demo.ctx, 'andres-vargas', C10);
    expect((await responderCaptura(demo.ctx, p.capturaId, 'nadie')).estado).toBe('error');
    expect(await cargarRevisiones(demo.ctx.db)).toEqual([]);
    const c06 = await capturar(demo.ctx, 'lucia-mora', 'No hay compresores de 2 HP. Propongo comprar de urgencia al proveedor local');
    if (c06.estado === 'pregunta') await responderCaptura(demo.ctx, c06.capturaId, '3');
    expect(await cargarRevisiones(demo.ctx.db)).toEqual([]);
  });
});
