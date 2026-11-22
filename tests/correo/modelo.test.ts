// Casos de control del giro a correo (docs/06 §9), sobre el flujo puro con los buzones de la demo (Gmail).
import { describe, expect, it } from 'vitest';
import { construirBuzonesEjemplo } from '@/correo/ejemplo/buzones';
import { EMPRESA_ALTAVISTA } from '@/correo/ejemplo/empresa';
import { esperaDesdeTexto, plazoDesdeTexto, tituloDesdePedido } from '@/correo/extraccion';
import { calcularModeloCorreo, personasDeCadena } from '@/correo/modelo';
import { clasificarMensaje } from '@/correo/privacidad';
import type { CorreccionCorreo, ModeloCorreo } from '@/correo/tipos';
import { unirBuzones } from '@/correo/union';
import { enCR } from '@/dominio/tiempo';

const SIETE = enCR('2026-11-25', '07:00');

function modelo(correcciones: CorreccionCorreo[] = [], ahora = SIETE): ModeloCorreo {
  return calcularModeloCorreo({ empresa: EMPRESA_ALTAVISTA, buzones: construirBuzonesEjemplo(), correcciones, ahora });
}

function porCodigo(m: ModeloCorreo, codigo: string) {
  const c = m.compromisos.find((x) => x.codigo === codigo);
  if (!c) throw new Error(`No existe ${codigo}`);
  return c;
}

describe('extracción: piezas', () => {
  it('saca el título en infinitivo, sin pronombre ni monto', () => {
    expect(tituloDesdePedido('enviarme los estados financieros auditados 2025 firmados')).toBe('Enviar los estados financieros auditados 2025 firmados');
    expect(tituloDesdePedido('aprobar el presupuesto de la campaña de Navidad por ₡18.000.000')).toBe('Aprobar el presupuesto de la campaña de Navidad');
    expect(tituloDesdePedido('dar de alta a TransLog como proveedor en el ERP')).toBe('Dar de alta a TransLog como proveedor en el ERP');
  });

  it('lee plazos en hora de Costa Rica y dice «no lo sé» sin señal', () => {
    const enviado = enCR('2026-11-24', '17:05');
    expect(plazoDesdeTexto('Los necesito mañana antes de las 10:00.', enviado)).toEqual(enCR('2026-11-25', '10:00'));
    expect(plazoDesdeTexto('antes del viernes 20 de noviembre', enviado)).toEqual(enCR('2026-11-20', '17:00'));
    expect(plazoDesdeTexto('antes del 4 de diciembre', enviado)).toEqual(enCR('2026-12-04', '17:00'));
    expect(plazoDesdeTexto('cuando puedas', enviado)).toBeNull();
  });

  it('separa quién, qué y el pronombre en una espera', () => {
    expect(esperaDesdeTexto('lo reviso en cuanto Finanzas confirme la garantía bancaria. Sin eso no.', 'bloqueo')).toMatchObject({
      actor: 'Finanzas',
      objeto: 'la garantía bancaria',
    });
    expect(esperaDesdeTexto('La solicito en cuanto Pablo me los envíe.', 'bloqueo')).toMatchObject({ actor: 'Pablo', objeto: '' });
    expect(esperaDesdeTexto('Se puede hacer cuando firmemos el contrato con TransLog.', 'dependencia')).toMatchObject({
      actor: null,
      objeto: 'el contrato con TransLog',
    });
  });
});

describe('CC1 a CC9: compromisos, cadenas y cuellos de botella', () => {
  const m = modelo();

  it('CC1: 7 compromisos, ninguno del ruido', () => {
    expect(m.compromisos.map((c) => c.codigo)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
    expect(m.compromisos.every((c) => !c.hiloId.startsWith('hilo-r-'))).toBe(true);
  });

  it('CC2: C1 presupuesto, atrasado y con una insistencia', () => {
    expect(porCodigo(m, 'C1')).toMatchObject({
      titulo: 'Aprobar el presupuesto de la campaña de Navidad',
      solicitanteId: 'sergio-vargas',
      responsableId: 'carla-fernandez',
      plazo: enCR('2026-11-20', '17:00'),
      monto: 18_000_000,
      estado: 'abierto',
      insistencias: 1,
      marcas: { atrasado: true, enRiesgo: false },
    });
  });

  it('CC3: C2 garantía, bloqueada por C7, sin marcas a las 7:00', () => {
    const c = porCodigo(m, 'C2');
    expect(c).toMatchObject({ responsableId: 'carla-fernandez', monto: 25_000_000, estado: 'bloqueado', marcas: { atrasado: false, enRiesgo: false } });
    expect(c.esperaA?.compromisoId).toBe(porCodigo(m, 'C7').id);
  });

  it('CC4: C3 bases legales, resuelto el sáb 21 nov', () => {
    expect(porCodigo(m, 'C3')).toMatchObject({ responsableId: 'luis-mendez', estado: 'resuelto', resueltoEn: enCR('2026-11-21', '11:30') });
  });

  it('CC5: C4 contrato, bloqueado por C2 y en riesgo', () => {
    const c = porCodigo(m, 'C4');
    expect(c).toMatchObject({ titulo: 'Revisar el contrato de TransLog', estado: 'bloqueado', plazo: enCR('2026-12-04', '17:00') });
    expect(c.esperaA?.compromisoId).toBe(porCodigo(m, 'C2').id);
    expect(c.marcas.causas).toContainEqual({ tipo: 'espera', compromisoId: porCodigo(m, 'C2').id, motivo: 'bloqueado' });
  });

  it('CC6: C5 textos finales, bloqueado por C1 atrasado', () => {
    const c = porCodigo(m, 'C5');
    expect(c).toMatchObject({ solicitanteId: 'valeria-castro', responsableId: 'sergio-vargas', estado: 'bloqueado' });
    expect(c.marcas.causas).toContainEqual({ tipo: 'espera', compromisoId: porCodigo(m, 'C1').id, motivo: 'atrasado' });
  });

  it('CC7: C6 alta en el ERP, depende de C4 y queda en riesgo', () => {
    const c = porCodigo(m, 'C6');
    expect(c).toMatchObject({ responsableId: 'valeria-castro', estado: 'abierto', marcas: { enRiesgo: true } });
    expect(c.esperaA).toMatchObject({ tipo: 'dependencia', compromisoId: porCodigo(m, 'C4').id });
  });

  it('CC8: C7 vence a las 10:00 y arrastra a C2', () => {
    expect(porCodigo(m, 'C7')).toMatchObject({ responsableId: 'pablo-rojas', plazo: enCR('2026-11-25', '10:00'), marcas: { atrasado: false } });
    const diez = modelo([], enCR('2026-11-25', '10:00'));
    expect(porCodigo(diez, 'C7').marcas.atrasado).toBe(true);
    expect(porCodigo(diez, 'C2').marcas.causas).toContainEqual({ tipo: 'espera', compromisoId: porCodigo(diez, 'C7').id, motivo: 'atrasado' });
  });

  it('CC9: dos proyectos, dos cadenas entre departamentos y Carla como cuello de botella', () => {
    const nombres = Object.fromEntries(m.proyectos.map((p) => [p.nombre, p.compromisoIds.map((id) => m.compromisos.find((c) => c.id === id)!.codigo).sort()]));
    expect(nombres).toEqual({ Navidad: ['C1', 'C3', 'C5'], TransLog: ['C2', 'C4', 'C6', 'C7'] });
    const cadenas = m.proyectos.flatMap((p) => p.cadenas.map((k) => personasDeCadena(k, m.compromisos)));
    expect(cadenas).toContainEqual(['ana-rodriguez', 'valeria-castro', 'luis-mendez', 'carla-fernandez', 'pablo-rojas']);
    expect(cadenas).toContainEqual(['valeria-castro', 'sergio-vargas', 'carla-fernandez']);
    expect(m.cuellos).toEqual([{ personaId: 'carla-fernandez', cadenas: 2, proyectos: ['Navidad', 'TransLog'] }]);
  });
});

describe('CC10 y CC11: unión de buzones y privacidad', () => {
  it('CC10: un mensaje interno está en varios buzones y cuenta una vez, con un enlace por buzón', () => {
    const { hilos } = unirBuzones(construirBuzonesEjemplo(), EMPRESA_ALTAVISTA, SIETE);
    const mensajes = hilos.flatMap((h) => h.mensajes);
    const ids = mensajes.map((x) => x.internetMessageId);
    expect(new Set(ids).size).toBe(ids.length);
    const primero = mensajes.find((x) => x.internetMessageId === '<h1-m1@altavista.cr>')!;
    expect(Object.keys(primero.enlaces).sort()).toEqual(['ana-rodriguez', 'luis-mendez', 'roberto-solano']);
  });

  it('CC11: descarta 2 personales y 2 boletines aunque pidan algo, y el cumpleaños no produce nada', () => {
    const buzones = construirBuzonesEjemplo();
    const clases = buzones.flatMap((b) => b.mensajes).map((x) => [x.idInternet, clasificarMensaje(x, EMPRESA_ALTAVISTA)] as const);
    const descartados = new Map(clases.filter(([, c]) => c !== 'laboral'));
    expect([...descartados.values()].sort()).toEqual(['boletin', 'boletin', 'personal', 'personal']);
    const m = modelo();
    const totales = m.conteos.reduce((a, k) => ({ p: a.p + k.personales, b: a.b + k.boletines }), { p: 0, b: 0 });
    expect(totales).toEqual({ p: 2, b: 2 });
    expect(m.compromisos.some((c) => c.asunto.includes('Cumpleaños'))).toBe(false);
  });

  it('solo existen los correos enviados hasta la hora del reloj', () => {
    const antes = modelo([], enCR('2026-11-19', '12:00'));
    expect(antes.compromisos.map((c) => c.titulo)).not.toContain('Enviar los estados financieros auditados 2025 firmados');
  });
});

describe('CC12: correcciones', () => {
  const base = modelo();
  const id = (codigo: string) => porCodigo(base, codigo).id;
  const en = enCR('2026-11-25', '07:00');

  it('corregir el plazo de C1 lo saca de atrasado y libera a C5', () => {
    const m = modelo([{ compromisoId: id('C1'), personaId: 'carla-fernandez', en, tipo: 'corregir', cambios: { plazo: enCR('2026-11-27', '17:00').toISOString() } }]);
    expect(porCodigo(m, 'C1')).toMatchObject({ marcas: { atrasado: false }, revision: { tipo: 'corregido', porId: 'carla-fernandez' } });
    expect(porCodigo(m, 'C5').marcas.causas.some((k) => k.tipo === 'espera' && k.motivo === 'atrasado')).toBe(false);
  });

  it('descartar C3 lo quita de todo sin cambiar los demás códigos', () => {
    const m = modelo([{ compromisoId: id('C3'), personaId: 'luis-mendez', en, tipo: 'descartar', cambios: {} }]);
    expect(m.compromisos.map((c) => c.codigo)).toEqual(['C1', 'C2', 'C4', 'C5', 'C6', 'C7']);
  });

  it('confirmar C7 lo marca como confirmado por Pablo', () => {
    const m = modelo([{ compromisoId: id('C7'), personaId: 'pablo-rojas', en, tipo: 'confirmar', cambios: {} }]);
    expect(porCodigo(m, 'C7').revision).toEqual({ tipo: 'confirmado', porId: 'pablo-rojas', en });
  });

  it('pasar un bloqueado a En curso quita el bloqueo', () => {
    const m = modelo([{ compromisoId: id('C4'), personaId: 'luis-mendez', en, tipo: 'corregir', cambios: { estado: 'en_curso' } }]);
    expect(porCodigo(m, 'C4')).toMatchObject({ estado: 'en_curso', esperaA: null });
  });
});

describe('nombres visibles de los compromisos (reforma de nombres)', () => {
  const base = modelo();
  const refs = (m: ModeloCorreo) => Object.fromEntries(m.compromisos.map((c) => [c.codigo, c.referencia]));

  it('cada compromiso lleva la referencia de su proyecto con numeración propia, en el orden de los códigos', () => {
    expect(refs(base)).toEqual({
      C1: 'NAVIDAD-1',
      C2: 'TRANSLOG-1',
      C3: 'NAVIDAD-2',
      C4: 'TRANSLOG-2',
      C5: 'NAVIDAD-3',
      C6: 'TRANSLOG-3',
      C7: 'TRANSLOG-4',
    });
  });

  it('descartar o corregir uno no cambia las referencias de los demás', () => {
    const en = enCR('2026-11-25', '07:00');
    const id = (codigo: string) => porCodigo(base, codigo).id;
    const m = modelo([
      { compromisoId: id('C3'), personaId: 'luis-mendez', en, tipo: 'descartar', cambios: {} },
      { compromisoId: id('C4'), personaId: 'luis-mendez', en, tipo: 'corregir', cambios: { titulo: 'Revisar el contrato marco' } },
    ]);
    const sinC3 = Object.fromEntries(Object.entries(refs(base)).filter(([codigo]) => codigo !== 'C3'));
    expect(refs(m)).toEqual(sinC3);
  });
});
