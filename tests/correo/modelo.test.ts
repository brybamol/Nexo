// Casos de control del giro a correo (docs/06 §9), sobre el flujo puro con los buzones de la demo (Gmail) de
// Frío del Valle (docs/08 §5).
import { describe, expect, it } from 'vitest';
import { construirBuzonesEjemplo, construirBuzonesGmail, MENSAJES_BASE, type MensajeBase } from '@/correo/ejemplo/buzones';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { esperaDesdeTexto, plazoDesdeTexto, tituloDesdePedido } from '@/correo/extraccion';
import { normalizarBuzonGmail } from '@/correo/fuentes/gmail';
import { calcularModeloCorreo, personasDeCadena } from '@/correo/modelo';
import { clasificarMensaje } from '@/correo/privacidad';
import type { Buzon, CorreccionCorreo, ModeloCorreo } from '@/correo/tipos';
import { unirBuzones } from '@/correo/union';
import { PERSONAS_SEMILLA } from '@/db/semilla/datos';
import { enCR } from '@/dominio/tiempo';

const LECTURA_7_05 = enCR('2026-11-25', '07:05');
const LECTURA_8_20 = enCR('2026-11-25', '08:20');
const MEDIODIA = enCR('2026-11-25', '12:00');

function modelo(correcciones: CorreccionCorreo[] = [], ahora = LECTURA_8_20, buzones: Buzon[] = construirBuzonesEjemplo()): ModeloCorreo {
  return calcularModeloCorreo({ empresa: EMPRESA_FRIO_DEL_VALLE, buzones, correcciones, ahora });
}

function porCodigo(m: ModeloCorreo, codigo: string) {
  const c = m.compromisos.find((x) => x.codigo === codigo);
  if (!c) throw new Error(`No existe ${codigo}`);
  return c;
}

/** Buzones de ejemplo con mensajes de prueba añadidos (solo para estas pruebas; no son datos de la demo). */
function buzonesCon(extra: MensajeBase[]): Buzon[] {
  return construirBuzonesGmail(EMPRESA_FRIO_DEL_VALLE, [...MENSAJES_BASE, ...extra]).map((b) => normalizarBuzonGmail(b, EMPRESA_FRIO_DEL_VALLE));
}

const PAOLA = 'paola.herrera@friodelvalle.cr';
const KARLA = 'karla.jimenez@friodelvalle.cr';
const ESTEBAN = 'esteban.castro@friodelvalle.cr';
const LUCIA = 'lucia.mora@friodelvalle.cr';
const DIEGO = 'diego.rojas@friodelvalle.cr';

/** Segunda cadena que también termina en Paola: Esteban → Karla → Paola, en otro proyecto (Trigal). */
const SEGUNDA_CADENA: MensajeBase[] = [
  {
    clave: 'x1-m1', hilo: 'X1', asunto: 'Precios repuestos Trigal', de: KARLA, para: [PAOLA], fecha: '2026-11-24', hora: '11:00',
    texto: 'Paola, ¿puedes enviar la lista de precios de repuestos de Trigal? La necesito antes del 26 de noviembre.',
  },
  {
    clave: 'x2-m1', hilo: 'X2', asunto: 'Pedido repuestos Trigal', de: ESTEBAN, para: [KARLA], fecha: '2026-11-24', hora: '12:00',
    texto: 'Karla, ¿puedes preparar el pedido de repuestos de Trigal? Lo necesito antes del 27 de noviembre; se puede hacer en cuanto Paola envíe la lista de precios de repuestos.',
  },
];

/** Karla responde a Lucía que no puede cotizar hasta que Diego le envíe el inventario (espera del responsable). */
const BLOQUEO_DE_KARLA: MensajeBase[] = [
  {
    clave: 'x3-m1', hilo: 'X3', asunto: 'Inventario de repuestos críticos', de: KARLA, para: [DIEGO], fecha: '2026-11-24', hora: '11:00',
    texto: 'Diego, ¿puedes enviarme el inventario de repuestos críticos? Lo necesito antes del 26 de noviembre.',
  },
  {
    clave: 'h6-m2', hilo: 'H6', asunto: 'RE: Reorden de repuestos críticos', de: KARLA, para: [LUCIA], fecha: '2026-11-24', hora: '14:00',
    texto: 'Lucía, la cotización la hago en cuanto Diego me los envíe.',
  },
];

describe('las 12 personas del correo son las de la semilla (docs/08 §5.1)', () => {
  it('mismos ids, nombres y jefes que PERSONAS_SEMILLA, con dirección @friodelvalle.cr sin tildes', () => {
    expect(EMPRESA_FRIO_DEL_VALLE.personas).toHaveLength(12);
    expect(EMPRESA_FRIO_DEL_VALLE.personas.map((p) => [p.id, p.nombre, p.rol, p.jefeId])).toEqual(
      PERSONAS_SEMILLA.map((p) => [p.id, p.nombre, p.rol, p.jefeId]),
    );
    for (const p of EMPRESA_FRIO_DEL_VALLE.personas) expect(p.correo).toMatch(/^[a-z]+\.[a-z]+@friodelvalle\.cr$/);
    expect(EMPRESA_FRIO_DEL_VALLE.personas.find((p) => p.id === 'andres-vargas')?.correo).toBe('andres.vargas@friodelvalle.cr');
  });
});

describe('extracción: piezas', () => {
  it('saca el título en infinitivo, sin pronombre ni monto', () => {
    expect(tituloDesdePedido('enviarme las guías de entrega firmadas de los pedidos 1041 y 1042')).toBe('Enviar las guías de entrega firmadas de los pedidos 1041 y 1042');
    expect(tituloDesdePedido('aprobar la compra del compresor por ₡1.800.000')).toBe('Aprobar la compra del compresor');
    expect(tituloDesdePedido('reprogramar la entrega 1043 con el cliente')).toBe('Reprogramar la entrega 1043 con el cliente');
  });

  it('lee plazos en hora de Costa Rica y dice «no lo sé» sin señal', () => {
    const enviado = enCR('2026-11-24', '15:00');
    expect(plazoDesdeTexto('La necesitan mañana antes de las 12:00.', enviado)).toEqual(enCR('2026-11-25', '12:00'));
    expect(plazoDesdeTexto('Lo necesito hoy antes de las 16:00.', enviado)).toEqual(enCR('2026-11-24', '16:00'));
    expect(plazoDesdeTexto('antes del viernes 27 de noviembre', enviado)).toEqual(enCR('2026-11-27', '17:00'));
    expect(plazoDesdeTexto('antes del 4 de diciembre', enviado)).toEqual(enCR('2026-12-04', '17:00'));
    expect(plazoDesdeTexto('cuando puedas', enviado)).toBeNull();
  });

  it('separa quién, qué y el pronombre en una espera', () => {
    expect(esperaDesdeTexto('se puede hacer en cuanto Paola envíe la cotización de la cámara fría.', 'dependencia')).toMatchObject({
      actor: 'Paola',
      objeto: 'la cotización de la cámara fría',
    });
    expect(esperaDesdeTexto('La hago en cuanto Diego me los envíe.', 'bloqueo')).toMatchObject({ actor: 'Diego', objeto: '' });
    expect(esperaDesdeTexto('Se puede hacer cuando llegue el compresor al taller.', 'dependencia')).toMatchObject({
      actor: null,
      objeto: 'el compresor al taller',
    });
  });
});

describe('CC1 a CC8: compromisos, cadenas y cuellos de botella', () => {
  const m = modelo();

  it('CC1: 6 compromisos a las 7:05 y uno más a las 8:20, ninguno del ruido', () => {
    expect(modelo([], LECTURA_7_05).compromisos.map((c) => c.codigo)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
    expect(m.compromisos.map((c) => c.codigo)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
    expect(m.compromisos.every((c) => !c.hiloId.startsWith('hilo-r-'))).toBe(true);
  });

  it('CC2: C1 pago anticipado, andrés → ricardo, sin marcas', () => {
    expect(porCodigo(m, 'C1')).toMatchObject({
      titulo: 'Confirmar el pago anticipado del pedido 1047 de La Colina',
      solicitanteId: 'andres-vargas',
      responsableId: 'ricardo-brenes',
      plazo: enCR('2026-11-26', '17:00'),
      monto: null,
      estado: 'abierto',
      insistencias: 0,
      marcas: { atrasado: false, enRiesgo: false },
    });
  });

  it('CC3: C2 guías de entrega, resuelto por la entrega de Diego el mar 24 a las 16:30', () => {
    const c = porCodigo(m, 'C2');
    expect(c).toMatchObject({
      titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
      solicitanteId: 'ricardo-brenes',
      responsableId: 'diego-rojas',
      plazo: enCR('2026-11-27', '17:00'),
      estado: 'resuelto',
      resueltoEn: enCR('2026-11-24', '16:30'),
    });
    expect(c.evidencias).toHaveLength(2);
    expect(c.evidencias[1]!.cita).toContain('te adjunto las guías firmadas');
  });

  it('CC4: C4 cotización al Hotel Mirador vence a las 12:00 y entonces queda atrasada', () => {
    expect(porCodigo(m, 'C4')).toMatchObject({ solicitanteId: 'andres-vargas', responsableId: 'paola-herrera', plazo: MEDIODIA, estado: 'abierto', marcas: { atrasado: false } });
    expect(porCodigo(modelo([], MEDIODIA), 'C4').marcas.atrasado).toBe(true);
  });

  it('CC5: C5 reprogramar la entrega 1043 no tiene plazo: «no lo sé», no se inventa uno', () => {
    expect(porCodigo(m, 'C5')).toMatchObject({ solicitanteId: 'diego-rojas', responsableId: 'sofia-navarro', plazo: null, estado: 'abierto', marcas: { atrasado: false } });
    expect(porCodigo(modelo([], enCR('2026-12-31', '12:00')), 'C5').marcas.atrasado).toBe(false);
  });

  it('CC6: C7 factura proforma depende de C4 y, con C4 atrasada, queda en riesgo', () => {
    const c = porCodigo(m, 'C7');
    expect(c).toMatchObject({
      titulo: 'Emitir la factura proforma de la cámara fría del Hotel Mirador',
      solicitanteId: 'andres-vargas',
      responsableId: 'ricardo-brenes',
      plazo: enCR('2026-11-27', '17:00'),
      estado: 'abierto',
      marcas: { enRiesgo: false },
    });
    expect(c.esperaA).toMatchObject({ tipo: 'dependencia', actor: 'Paola', compromisoId: porCodigo(m, 'C4').id });
    const tarde = modelo([], MEDIODIA);
    expect(porCodigo(tarde, 'C7').marcas).toMatchObject({ enRiesgo: true, causas: [{ tipo: 'espera', compromisoId: porCodigo(tarde, 'C4').id, motivo: 'atrasado' }] });
  });

  it('CC7: una cadena entre departamentos, Andrés → Ricardo → Paola, y con estos correos ningún cuello de botella', () => {
    expect(m.proyectos.map((p) => p.nombre).sort()).toEqual(['Alajuela', 'Beto', 'Guías de entrega pedidos 1041 y 1042', 'Hotel', 'Pago anticipado pedido 1047', 'Reorden de repuestos críticos']);
    const cadenas = m.proyectos.flatMap((p) => p.cadenas.map((k) => personasDeCadena(k, m.compromisos)));
    expect(cadenas).toEqual([['andres-vargas', 'ricardo-brenes', 'paola-herrera']]);
    expect(m.cuellos).toEqual([]);
  });

  it('CC8: si otra cadena termina también en Paola, ella es el cuello de botella de dos proyectos', () => {
    const k = modelo([], LECTURA_8_20, buzonesCon(SEGUNDA_CADENA));
    const cadenas = k.proyectos.flatMap((p) => p.cadenas.map((c) => personasDeCadena(c, k.compromisos)));
    expect(cadenas).toContainEqual(['andres-vargas', 'ricardo-brenes', 'paola-herrera']);
    expect(cadenas).toContainEqual(['esteban-castro', 'karla-jimenez', 'paola-herrera']);
    expect(k.cuellos).toHaveLength(1);
    expect(k.cuellos[0]).toMatchObject({ personaId: 'paola-herrera', cadenas: 2 });
    expect(k.cuellos[0]!.proyectos).toHaveLength(2);
  });

  it('una espera del responsable bloquea su compromiso y lo enlaza con lo que le pidió a esa persona', () => {
    const b = modelo([], LECTURA_8_20, buzonesCon(BLOQUEO_DE_KARLA));
    const reorden = b.compromisos.find((c) => c.titulo === 'Cotizar el reorden con dos proveedores')!;
    const inventario = b.compromisos.find((c) => c.titulo === 'Enviar el inventario de repuestos críticos')!;
    expect(reorden).toMatchObject({ estado: 'bloqueado', responsableId: 'karla-jimenez' });
    expect(reorden.esperaA).toMatchObject({ tipo: 'bloqueo', actor: 'Diego', compromisoId: inventario.id });
  });
});

describe('CC9 y CC10: unión de buzones y privacidad', () => {
  it('CC9: un mensaje interno está en varios buzones y cuenta una vez, con un enlace por buzón', () => {
    const { hilos } = unirBuzones(construirBuzonesEjemplo(), EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    const mensajes = hilos.flatMap((h) => h.mensajes);
    const ids = mensajes.map((x) => x.internetMessageId);
    expect(new Set(ids).size).toBe(ids.length);
    const primero = mensajes.find((x) => x.internetMessageId === '<h1-m1@friodelvalle.cr>')!;
    expect(Object.keys(primero.enlaces).sort()).toEqual(['andres-vargas', 'paola-herrera', 'ricardo-brenes']);
  });

  it('CC10: descarta 2 personales y 2 boletines aunque pidan algo, y el cumpleaños no produce nada', () => {
    const buzones = construirBuzonesEjemplo();
    const clases = buzones.flatMap((b) => b.mensajes).map((x) => [x.idInternet, clasificarMensaje(x, EMPRESA_FRIO_DEL_VALLE)] as const);
    const descartados = new Map(clases.filter(([, c]) => c !== 'laboral'));
    expect([...descartados.values()].sort()).toEqual(['boletin', 'boletin', 'personal', 'personal']);
    const m = modelo([], LECTURA_7_05);
    const totales = m.conteos.reduce((a, k) => ({ p: a.p + k.personales, b: a.b + k.boletines }), { p: 0, b: 0 });
    expect(totales).toEqual({ p: 2, b: 2 });
    expect(m.compromisos.some((c) => c.asunto.includes('Cumpleaños'))).toBe(false);
  });

  it('CC11: conteos de la lectura de las 7:05 por buzón y en total (23 copias, 19 de trabajo)', () => {
    const m = modelo([], LECTURA_7_05);
    expect(m.conteos.map((k) => [k.personaId, k.leidos, k.laborales, k.personales, k.boletines])).toEqual([
      ['marcela-solis', 1, 1, 0, 0],
      ['andres-vargas', 3, 3, 0, 0],
      ['ricardo-brenes', 5, 4, 0, 1],
      ['paola-herrera', 3, 3, 0, 0],
      ['sofia-navarro', 3, 2, 1, 0],
      ['karla-jimenez', 3, 2, 1, 0],
      ['lucia-mora', 3, 2, 0, 1],
      ['esteban-castro', 2, 2, 0, 0],
    ]);
    expect(m.conteos.reduce((a, k) => a + k.leidos, 0)).toBe(23);
    expect(m.conteos.reduce((a, k) => a + k.laborales, 0)).toBe(19);
    // Lo que llega a las 8:20 son dos copias más (Andrés y Ricardo).
    expect(modelo([], LECTURA_8_20).conteos.reduce((a, k) => a + k.leidos, 0)).toBe(25);
  });

  it('solo existen los correos enviados hasta la hora del reloj', () => {
    const antes = modelo([], enCR('2026-11-23', '12:00'));
    expect(antes.compromisos.map((c) => c.titulo)).toEqual(['Confirmar el pago anticipado del pedido 1047 de La Colina']);
    expect(antes.compromisos.map((c) => c.titulo)).not.toContain('Enviar las guías de entrega firmadas de los pedidos 1041 y 1042');
  });
});

describe('CC12: correcciones', () => {
  const base = modelo([], MEDIODIA);
  const id = (codigo: string) => porCodigo(base, codigo).id;
  const en = MEDIODIA;

  it('corregir el plazo de C4 lo saca de atrasado y saca a C7 del riesgo', () => {
    expect(porCodigo(base, 'C4').marcas.atrasado).toBe(true);
    expect(porCodigo(base, 'C7').marcas.enRiesgo).toBe(true);
    const m = modelo([{ compromisoId: id('C4'), personaId: 'paola-herrera', en, tipo: 'corregir', cambios: { plazo: enCR('2026-11-27', '17:00').toISOString() } }], MEDIODIA);
    expect(porCodigo(m, 'C4')).toMatchObject({ marcas: { atrasado: false }, revision: { tipo: 'corregido', porId: 'paola-herrera' } });
    expect(porCodigo(m, 'C7').marcas.causas.some((k) => k.tipo === 'espera' && k.motivo === 'atrasado')).toBe(false);
  });

  it('descartar C2 lo quita de todo sin cambiar los demás códigos', () => {
    const m = modelo([{ compromisoId: id('C2'), personaId: 'ricardo-brenes', en, tipo: 'descartar', cambios: {} }], MEDIODIA);
    expect(m.compromisos.map((c) => c.codigo)).toEqual(['C1', 'C3', 'C4', 'C5', 'C6', 'C7']);
  });

  it('confirmar C6 lo marca como confirmado por Esteban', () => {
    const m = modelo([{ compromisoId: id('C6'), personaId: 'esteban-castro', en, tipo: 'confirmar', cambios: {} }], MEDIODIA);
    expect(porCodigo(m, 'C6').revision).toEqual({ tipo: 'confirmado', porId: 'esteban-castro', en });
  });

  it('pasar un bloqueado a En curso quita el bloqueo', () => {
    const buzones = buzonesCon(BLOQUEO_DE_KARLA);
    const bloqueado = modelo([], MEDIODIA, buzones);
    const reorden = bloqueado.compromisos.find((c) => c.titulo === 'Cotizar el reorden con dos proveedores')!;
    expect(reorden.estado).toBe('bloqueado');
    const m = modelo([{ compromisoId: reorden.id, personaId: 'karla-jimenez', en, tipo: 'corregir', cambios: { estado: 'en_curso' } }], MEDIODIA, buzones);
    expect(m.compromisos.find((c) => c.id === reorden.id)).toMatchObject({ estado: 'en_curso', esperaA: null });
  });
});

describe('nombres visibles de los compromisos (reforma de nombres)', () => {
  const base = modelo();
  const refs = (m: ModeloCorreo) => Object.fromEntries(m.compromisos.map((c) => [c.codigo, c.referencia]));

  it('cada compromiso lleva la referencia de su proyecto con numeración propia, en el orden de los códigos', () => {
    // Un compromiso cuyo proyecto no tiene nombre propio (el asunto completo) se nombra solo por su título.
    expect(refs(base)).toEqual({
      C1: '',
      C2: '',
      C3: '',
      C4: 'HOTEL-1',
      C5: 'BETO-1',
      C6: 'ALAJUELA-1',
      C7: 'HOTEL-2',
    });
  });

  it('descartar o corregir uno no cambia las referencias de los demás', () => {
    const en = LECTURA_8_20;
    const id = (codigo: string) => porCodigo(base, codigo).id;
    const m = modelo([
      { compromisoId: id('C4'), personaId: 'paola-herrera', en, tipo: 'descartar', cambios: {} },
      { compromisoId: id('C5'), personaId: 'sofia-navarro', en, tipo: 'corregir', cambios: { titulo: 'Reprogramar la entrega 1043 de Don Beto' } },
    ]);
    const sinC4 = Object.fromEntries(Object.entries(refs(base)).filter(([codigo]) => codigo !== 'C4'));
    expect(refs(m)).toEqual(sinC4);
  });
});
