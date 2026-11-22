// Ingesta de correo: de hechos a trabajos (docs/08 reglas 12–14b, §5.2, V1, V2, V5, V16). Puras, sobre la
// instantánea de la semilla en memoria y los buzones de ejemplo de Frío del Valle.
import { describe, expect, it } from 'vitest';
import { construirBuzonesEjemplo, construirBuzonesGmail, MENSAJES_BASE, type MensajeBase } from '@/correo/ejemplo/buzones';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { normalizarBuzonGmail } from '@/correo/fuentes/gmail';
import { hechosDeCorreo } from '@/correo/lectura';
import type { Buzon, EsperaCorreo, PedidoCorreo } from '@/correo/tipos';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import { confianzaDe } from '@/motor/confianza';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { enlazarEspera, mismoHecho, planLectura, proyectoDelPedido } from '@/motor/ingesta';
import { nombrador, type Instantanea } from '@/motor/instantanea';
import { calcularMarcas } from '@/motor/marcas';
import { tick } from '@/motor/seguimiento';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const EMPRESA = EMPRESA_FRIO_DEL_VALLE;
const MIE = '2026-11-25';
const A_LAS = (h: string) => enCR(MIE, h);

type Accion = Extract<Efecto, { tipo: 'accion' }>;
const acciones = (es: Efecto[]) => es.filter((e): e is Accion => e.tipo === 'accion');
const deTipo = <T extends Efecto['tipo']>(es: Efecto[], tipo: T) => es.filter((e): e is Extract<Efecto, { tipo: T }> => e.tipo === tipo);
const claves = (copias: { personaId: string; idInternet: string }[]) => new Set(copias.map((c) => `${c.personaId}|${c.idInternet}`));

function semilla(hora = '07:05'): Instantanea {
  return { ...instantaneaDesdeSemilla(), ahora: A_LAS(hora) };
}

function buzonesCon(extra: MensajeBase[], conectados?: string[]): Buzon[] {
  return construirBuzonesGmail(EMPRESA, [...MENSAJES_BASE, ...extra], conectados).map((b) => normalizarBuzonGmail(b, EMPRESA));
}

/** Lee los buzones a `inst.ahora` sobre `inst`, con `yaLeidos`; devuelve el plan y la instantánea resultante. */
function leer(inst: Instantanea, buzones: Buzon[] = construirBuzonesEjemplo(), yaLeidos = new Set<string>()) {
  const { hechos, copias } = hechosDeCorreo(buzones, EMPRESA, inst.ahora);
  const plan = planLectura(inst, { hechos, copias, yaLeidos, empresa: EMPRESA });
  return { ...plan, despues: aplicarEnMemoria(inst, plan.efectos), copias };
}

const trabajo = (inst: Instantanea, id: string) => inst.trabajos.find((t) => t.id === id) as Trabajo;

describe('V1 · lectura de las 7:05 (§5.2)', () => {
  const inst = semilla('07:05');
  const { efectos, resumen, despues, copias } = leer(inst);

  it('resumen exacto', () => {
    expect(resumen).toEqual({
      leidos: 23,
      laborales: 8,
      descartados: 4,
      creados: [],
      propuestos: ['M01', 'M02'],
      reconocidos: ['T27', 'T17', 'T28', 'T22'],
      entregas: ['M01'],
      sinConvertir: 0,
    });
  });

  it('H3 → M01 propuesto (una fuente: Ricardo), PEDIDOS-13, entregado por Diego el mar 24 a las 16:30', () => {
    const m01 = trabajo(despues, 'M01');
    expect(m01).toMatchObject({
      proyectoId: 'P4',
      numero: 13,
      titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
      responsableId: 'diego-rojas',
      solicitadoPorId: 'ricardo-brenes',
      plazo: enCR('2026-11-27', '17:00'),
      estado: 'abierto',
      origen: 'correo',
      confirmacion: 'propuesto',
      duenoPropuestaId: 'ricardo-brenes',
      confirmadoPorId: null,
      urgente: false,
      conCostoProbable: false,
      creadoEn: A_LAS('07:05'),
    });
    expect(m01.entrega).toMatchObject({ porId: 'diego-rojas', en: enCR('2026-11-24', '16:30'), fuente: 'correo', nota: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.' });
    expect(nombrador(despues).referencia('M01')).toBe('PEDIDOS-13');
    expect(confianzaDe(m01, despues.evidencias)).toBe('una_fuente');
    const ev = despues.evidencias.filter((e) => e.trabajoId === 'M01');
    expect(ev.map((e) => [e.tipo, e.mensajeId, e.en, e.buzones])).toEqual([
      ['pedido', '<h3-m1@friodelvalle.cr>', enCR('2026-11-23', '15:00'), ['ricardo-brenes']],
      ['entrega', '<h3-m2@friodelvalle.cr>', enCR('2026-11-24', '16:30'), ['ricardo-brenes']],
    ]);
    expect(ev.every((e) => e.compromisoClave === 'c-h3-m1' && e.fuente === 'correo' && Object.keys(e.enlaces).join() === 'ricardo-brenes')).toBe(true);
  });

  it('H4 → M02 propuesto (dueño Esteban), TRIGAL-7, a cargo de Daniela', () => {
    const m02 = trabajo(despues, 'M02');
    expect(m02).toMatchObject({
      proyectoId: 'P2',
      numero: 7,
      titulo: 'Enviar las fotos del mantenimiento de Heredia y Alajuela',
      responsableId: 'daniela-quesada',
      solicitadoPorId: 'esteban-castro',
      plazo: enCR('2026-11-27', '17:00'),
      confirmacion: 'propuesto',
      duenoPropuestaId: 'esteban-castro',
      entrega: null,
    });
    expect(nombrador(despues).referencia('M02')).toBe('TRIGAL-7');
  });

  it('H1, H6, H2 y H7 reconocen T27, T17, T28 y T22: solo agregan una evidencia `pedido`, sin cambiar el trabajo', () => {
    for (const id of ['T27', 'T17', 'T28', 'T22']) {
      expect(trabajo(despues, id)).toEqual(trabajo(inst, id));
      expect(despues.evidencias.filter((e) => e.trabajoId === id).map((e) => e.tipo)).toEqual(['pedido']);
    }
    const t27 = despues.evidencias.find((e) => e.trabajoId === 'T27')!;
    expect(t27.buzones).toEqual(expect.arrayContaining(['andres-vargas', 'ricardo-brenes']));
    expect(t27).toMatchObject({ compromisoClave: 'c-h1-m1', autorId: 'andres-vargas', en: enCR('2026-11-23', '09:00') });
    expect(despues.evidencias.find((e) => e.trabajoId === 'T22')).toMatchObject({ buzones: ['sofia-navarro'], autorId: 'diego-rojas' });
    expect(acciones(efectos).filter((a) => a.accion.tipo === 'reconocer_correo').map((a) => a.accion.trabajoIds)).toEqual([['T27'], ['T17'], ['T28'], ['T22']]);
  });

  it('acciones: 4 reconocer_correo, 2 proponer_trabajo (al dueño, sin aviso), 1 registrar_entrega y 1 leer_correo; ningún aviso', () => {
    const tipos = acciones(efectos).map((a) => a.accion.tipo);
    expect(tipos.filter((t) => t === 'reconocer_correo')).toHaveLength(4);
    expect(acciones(efectos).filter((a) => a.accion.tipo === 'proponer_trabajo').map((a) => [a.accion.destinatarioId, a.accion.trabajoIds])).toEqual([
      ['ricardo-brenes', ['M01']],
      ['esteban-castro', ['M02']],
    ]);
    expect(tipos.filter((t) => t === 'registrar_entrega')).toHaveLength(1);
    expect(tipos.at(-1)).toBe('leer_correo');
    expect(tipos.filter((t) => t === 'leer_correo')).toHaveLength(1);
    expect(acciones(efectos).filter((a) => a.aviso !== null)).toEqual([]);
    expect(new Set(tipos)).toEqual(new Set(['reconocer_correo', 'proponer_trabajo', 'registrar_entrega', 'leer_correo']));
  });

  it('abre un seguimiento `propuesta` por propuesta y ninguno de recepción (M01 sigue propuesto)', () => {
    expect(despues.seguimientos.map((s) => [s.trabajoId, s.tipo, s.destinatarioId, s.nivel, s.estado])).toEqual([
      ['M01', 'propuesta', 'ricardo-brenes', 0, 'pendiente'],
      ['M02', 'propuesta', 'esteban-castro', 0, 'pendiente'],
    ]);
    expect(despues.seguimientos[0]!.proximoEn).toEqual(A_LAS('11:05'));
  });

  it('registra las 23 copias con el resultado de su mensaje; lo personal y los boletines, descartados', () => {
    const [registro] = deTipo(efectos, 'registrar_mensajes');
    expect(registro!.mensajes).toHaveLength(23);
    expect(registro!.mensajes.every((m) => m.leidoEn.getTime() === A_LAS('07:05').getTime())).toBe(true);
    const de = (id: string) => registro!.mensajes.filter((m) => m.idInternet === id).map((m) => [m.personaId, m.resultado, m.trabajoIds]);
    expect(de('<h3-m1@friodelvalle.cr>')).toEqual([['ricardo-brenes', 'propuso', ['M01']]]);
    expect(de('<h3-m2@friodelvalle.cr>')).toEqual([['ricardo-brenes', 'entrega', ['M01']]]);
    expect(de('<h1-m1@friodelvalle.cr>').map((x) => x[1])).toEqual(['reconocio', 'reconocio', 'reconocio']);
    expect(new Set(de('<r-cumple@friodelvalle.cr>').map((x) => x[1]))).toEqual(new Set(['sin_compromisos']));
    const descartados = registro!.mensajes.filter((m) => m.clase !== 'laboral');
    expect(descartados.map((m) => m.resultado)).toEqual(['descartado', 'descartado', 'descartado', 'descartado']);
    expect(registro!.mensajes.map((m) => `${m.personaId}|${m.idInternet}`).sort()).toEqual([...claves(copias)].sort());
  });

  it('ningún texto de Nexo lleva un id interno', () => {
    const textos = [
      ...acciones(efectos).flatMap((a) => [a.accion.motivo, a.accion.hechoOrigen]),
      ...deTipo(efectos, 'agregar_nota').map((n) => n.texto),
    ];
    expect(textos.filter((t) => idsInternosEn(t).length > 0)).toEqual([]);
    expect(acciones(efectos).find((a) => a.accion.tipo === 'proponer_trabajo')!.accion.motivo).toContain('(PEDIDOS-13)');
  });

  it('el tick de las 7:05 sigue pidiendo solo los estados de T15 y T21, sin avisos sobre lo propuesto', () => {
    const t = acciones(tick(despues));
    expect(t.map((a) => [a.accion.tipo, a.accion.trabajoIds])).toEqual([
      ['pedir_estado', ['T15']],
      ['pedir_estado', ['T21']],
    ]);
  });

  it('no cambia estados ni marcas de la semilla', () => {
    const antes = calcularMarcas(inst);
    const ahora = calcularMarcas(despues);
    for (const t of inst.trabajos) {
      expect(trabajo(despues, t.id).estado).toBe(t.estado);
      expect(ahora.get(t.id)).toEqual(antes.get(t.id));
    }
  });
});

describe('V2 · volver a leer no hace nada', () => {
  it('con todas las copias ya leídas: sin efectos ni acción, resumen vacío', () => {
    const inst = semilla('07:05');
    const primera = leer(inst);
    const segunda = leer(primera.despues, construirBuzonesEjemplo(), claves(primera.copias));
    expect(segunda.efectos).toEqual([]);
    expect(segunda.resumen).toEqual({ leidos: 0, laborales: 0, descartados: 0, creados: [], propuestos: [], reconocidos: [], entregas: [], sinConvertir: 0 });
  });
});

describe('V5 · lectura de las 8:20: H5 crea M03 confirmado por dos fuentes', () => {
  const v1 = leer(semilla('07:05'));
  const inst820 = { ...v1.despues, ahora: A_LAS('08:20') };
  const { efectos, resumen, despues } = leer(inst820, construirBuzonesEjemplo(), claves(v1.copias));

  it('resumen: 2 copias, 1 mensaje, creados [M03]', () => {
    expect(resumen).toEqual({ leidos: 2, laborales: 1, descartados: 0, creados: ['M03'], propuestos: [], reconocidos: [], entregas: [], sinConvertir: 0 });
  });

  it('M03 confirmado (dos_fuentes), PEDIDOS-14, depende de T28; ni aviso ni seguimiento de propuesta', () => {
    const m03 = trabajo(despues, 'M03');
    expect(m03).toMatchObject({
      proyectoId: 'P4',
      numero: 14,
      titulo: 'Emitir la factura proforma de la cámara fría del Hotel Mirador',
      responsableId: 'ricardo-brenes',
      solicitadoPorId: 'andres-vargas',
      plazo: enCR('2026-11-27', '17:00'),
      confirmacion: 'confirmado',
      duenoPropuestaId: null,
      confirmadoPorId: null,
      creadoEn: A_LAS('08:20'),
    });
    expect(confianzaDe(m03, despues.evidencias)).toBe('dos_fuentes');
    expect(nombrador(despues).referencia('M03')).toBe('PEDIDOS-14');
    expect(despues.dependencias).toContainEqual({ trabajoId: 'M03', dependeDeId: 'T28' });
    expect(deTipo(efectos, 'crear_dependencia')).toEqual([
      { tipo: 'crear_dependencia', dependencia: { trabajoId: 'M03', dependeDeId: 'T28' }, actorId: 'andres-vargas' },
    ]);
    expect(acciones(efectos).filter((a) => a.aviso !== null)).toEqual([]);
    expect(acciones(efectos).map((a) => [a.accion.tipo, a.accion.destinatarioId])).toEqual([
      ['crear_trabajo', null],
      ['leer_correo', null],
    ]);
    expect(despues.seguimientos.filter((s) => s.trabajoId === 'M03')).toEqual([]);
  });

  it('V6 en puro: a las 12:00 T28 queda atrasado y M03 en riesgo por T28', () => {
    const marcas = calcularMarcas({ ...despues, ahora: A_LAS('12:00') });
    expect(marcas.get('T28')?.atrasado).toBe(true);
    expect(marcas.get('M03')).toMatchObject({ enRiesgo: true, causas: [{ tipo: 'atrasado', trabajoId: 'T28' }] });
  });
});

describe('V16 · casos con mensajes de prueba', () => {
  const RICARDO = 'ricardo.brenes@friodelvalle.cr';
  const DIEGO = 'diego.rojas@friodelvalle.cr';
  const KARLA = 'karla.jimenez@friodelvalle.cr';
  const LUCIA = 'lucia.mora@friodelvalle.cr';
  const MARCELA = 'marcela.solis@friodelvalle.cr';
  const DANIELA = 'daniela.quesada@friodelvalle.cr';

  it('un pedido nuevo sin plazo no se convierte: sin_plazo, sin trabajo', () => {
    const extra: MensajeBase[] = [
      { clave: 'z1-m1', hilo: 'Z1', asunto: 'Arqueo de caja', de: RICARDO, para: [KARLA], fecha: '2026-11-24', hora: '09:00', texto: 'Karla, ¿puedes revisar el arqueo de caja chica?' },
    ];
    const { efectos, resumen, despues } = leer(semilla(), buzonesCon(extra));
    expect(resumen.sinConvertir).toBe(1);
    expect(despues.trabajos.filter((t) => t.titulo.includes('arqueo'))).toEqual([]);
    const fila = deTipo(efectos, 'registrar_mensajes')[0]!.mensajes.filter((m) => m.idInternet === '<z1-m1@friodelvalle.cr>');
    expect(fila.map((m) => [m.personaId, m.resultado, m.trabajoIds])).toEqual([
      ['ricardo-brenes', 'sin_plazo', []],
      ['karla-jimenez', 'sin_plazo', []],
    ]);
    expect(resumen.propuestos).toEqual(['M01', 'M02']);
  });

  it('un pedido visto solo en la copia de un tercero: sin_parte', () => {
    const extra: MensajeBase[] = [
      { clave: 'z2-m1', hilo: 'Z2', asunto: 'Inventario de bodega', de: DIEGO, para: [DANIELA], cc: [MARCELA], fecha: '2026-11-24', hora: '09:00', texto: 'Daniela, ¿puedes devolver las herramientas a bodega? Las necesito antes del 26 de noviembre.' },
    ];
    const { efectos, despues } = leer(semilla(), buzonesCon(extra));
    expect(despues.trabajos.filter((t) => t.titulo.includes('herramientas'))).toEqual([]);
    const fila = deTipo(efectos, 'registrar_mensajes')[0]!.mensajes.filter((m) => m.idInternet === '<z2-m1@friodelvalle.cr>');
    expect(fila.map((m) => [m.personaId, m.resultado])).toEqual([['marcela-solis', 'sin_parte']]);
  });

  it('la espera de bloqueo del responsable bloquea su trabajo con el enlazado (objeto pronominal)', () => {
    const extra: MensajeBase[] = [
      { clave: 'z3-m1', hilo: 'Z3', asunto: 'Inventario de repuestos críticos', de: KARLA, para: [DIEGO], fecha: '2026-11-24', hora: '11:00', texto: 'Diego, ¿puedes enviarme el inventario de repuestos críticos? Lo necesito antes del 26 de noviembre.' },
      { clave: 'h6-m2', hilo: 'H6', asunto: 'RE: Reorden de repuestos críticos', de: KARLA, para: [LUCIA], fecha: '2026-11-24', hora: '14:00', texto: 'Lucía, la cotización la hago en cuanto Diego me los envíe.' },
    ];
    const { despues, resumen } = leer(semilla(), buzonesCon(extra));
    const inventario = despues.trabajos.find((t) => t.titulo === 'Enviar el inventario de repuestos críticos')!;
    expect(inventario).toMatchObject({ responsableId: 'diego-rojas', solicitadoPorId: 'karla-jimenez', proyectoId: 'P3', confirmacion: 'propuesto', duenoPropuestaId: 'karla-jimenez' });
    expect(resumen.propuestos).toContain(inventario.id);
    expect(trabajo(despues, 'T17')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: inventario.id, motivoBloqueo: 'en cuanto Diego me los envíe' });
    expect(despues.evidencias.filter((e) => e.trabajoId === 'T17').map((e) => e.tipo)).toEqual(['pedido', 'espera']);
  });

  it('«recibido, gracias» del solicitante tras una entrega resuelve el trabajo', () => {
    const extra: MensajeBase[] = [
      { clave: 'h3-m3', hilo: 'H3', asunto: 'RE: Guías de entrega pedidos 1041 y 1042', de: RICARDO, para: [DIEGO], fecha: '2026-11-24', hora: '17:30', texto: 'Diego, recibido, gracias.' },
    ];
    const { despues, efectos } = leer(semilla(), buzonesCon(extra));
    expect(trabajo(despues, 'M01')).toMatchObject({ estado: 'resuelto', resueltoEn: A_LAS('07:05') });
    expect(despues.evidencias.filter((e) => e.trabajoId === 'M01').map((e) => [e.tipo, e.en])).toEqual([
      ['pedido', enCR('2026-11-23', '15:00')],
      ['entrega', enCR('2026-11-24', '16:30')],
      ['recepcion', enCR('2026-11-24', '17:30')],
    ]);
    expect(acciones(efectos).map((a) => a.accion.tipo)).toContain('confirmar_recepcion');
    // Propuesto: nadie recibe avisos (regla 15).
    expect(acciones(efectos).filter((a) => a.aviso !== null)).toEqual([]);
  });

  it('un pedido igual a un trabajo de la captura se reconoce, sin duplicado', () => {
    const base = semilla();
    const captura: Trabajo = {
      ...trabajo(base, 'T28'),
      id: 'T31',
      numero: 8,
      proyectoId: 'P1',
      titulo: 'Revisar el termostato de la cámara de La Colina',
      responsableId: 'karla-jimenez',
      solicitadoPorId: 'ricardo-brenes',
      origen: 'captura',
      capturaId: 1,
      plazo: enCR('2026-11-26', '17:00'),
    };
    const inst = { ...base, trabajos: [...base.trabajos, captura] };
    const extra: MensajeBase[] = [
      { clave: 'z4-m1', hilo: 'Z4', asunto: 'Termostato La Colina', de: RICARDO, para: [KARLA], fecha: '2026-11-24', hora: '09:00', texto: 'Karla, ¿puedes revisar el termostato de la cámara de La Colina? Lo necesito antes del 26 de noviembre.' },
    ];
    const { resumen, despues } = leer(inst, buzonesCon(extra));
    expect(resumen.reconocidos).toContain('T31');
    expect(despues.trabajos.filter((t) => t.titulo.toLowerCase().includes('termostato de la cámara'))).toHaveLength(1);
    expect(despues.trabajos.filter((t) => t.origen === 'correo').map((t) => t.id)).toEqual(['M01', 'M02']);
    expect(trabajo(despues, 'T31')).toEqual(captura);
  });

  it('un monto marca costo probable y el motivo pide pasarlo por una decisión, sin crearla', () => {
    const extra: MensajeBase[] = [
      { clave: 'z5-m1', hilo: 'Z5', asunto: 'Compra de herramientas', de: MARCELA, para: [KARLA], fecha: '2026-11-24', hora: '09:00', texto: 'Karla, ¿puedes comprar las herramientas nuevas por ₡250.000? Las necesito antes del 27 de noviembre.' },
    ];
    const { despues, efectos } = leer(semilla(), buzonesCon(extra));
    const t = despues.trabajos.find((x) => x.titulo === 'Comprar las herramientas nuevas')!;
    expect(t).toMatchObject({ conCostoProbable: true, proyectoId: 'OD', confirmacion: 'confirmado' });
    expect(despues.decisiones).toEqual([]);
    const motivo = acciones(efectos).find((a) => a.accion.trabajoIds.includes(t.id) && a.accion.tipo === 'crear_trabajo')!.accion.motivo;
    expect(motivo).toContain('Tiene costo (₡250.000): si implica una compra, pásalo por una decisión.');
  });

  it('el mismo correo en un buzón recién conectado no se vuelve a aplicar: suma su buzón y confirma por fuentes', () => {
    const v1 = leer(semilla());
    // Diego conecta su buzón: aparece su copia de H3-m1 (recibido) y H3-m2 (enviado).
    const conDiego = construirBuzonesGmail(EMPRESA, MENSAJES_BASE, ['ricardo-brenes', 'diego-rojas']).map((b) => normalizarBuzonGmail(b, EMPRESA));
    const otra = leer({ ...v1.despues, ahora: A_LAS('07:10') }, conDiego, claves(v1.copias));
    expect(otra.resumen.propuestos).toEqual([]);
    expect(otra.resumen.creados).toEqual([]);
    expect(otra.despues.trabajos.filter((t) => t.origen === 'correo').map((t) => t.id)).toEqual(['M01', 'M02']);
    const m01 = trabajo(otra.despues, 'M01');
    expect(m01).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: null });
    expect(otra.despues.evidencias.filter((e) => e.trabajoId === 'M01' && e.tipo === 'pedido').map((e) => [...e.buzones].sort())).toEqual([['diego-rojas', 'ricardo-brenes']]);
    expect(otra.despues.seguimientos.find((s) => s.trabajoId === 'M01' && s.tipo === 'propuesta')?.estado).toBe('respondido');
    // M01 ya traía la entrega de Diego: al confirmarse, se trata como cualquier entrega (regla 20).
    expect(acciones(otra.efectos).filter((a) => a.aviso !== null).map((a) => a.aviso!.personaId)).toEqual(['ricardo-brenes']);
  });

  it('una propuesta con entrega que queda confirmada por fuentes avisa a quien lo pidió y abre el seguimiento de recepción', () => {
    const v1 = leer(semilla());
    const conDiego = construirBuzonesGmail(EMPRESA, MENSAJES_BASE, ['ricardo-brenes', 'diego-rojas']).map((b) => normalizarBuzonGmail(b, EMPRESA));
    const otra = leer({ ...v1.despues, ahora: A_LAS('07:10') }, conDiego, claves(v1.copias));
    const avisos = acciones(otra.efectos).filter((a) => a.aviso !== null);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.accion).toMatchObject({ tipo: 'aviso', destinatarioId: 'ricardo-brenes', trabajoIds: ['M01'], en: A_LAS('07:10') });
    expect(avisos[0]!.aviso).toMatchObject({
      personaId: 'ricardo-brenes',
      titulo: 'Diego Rojas entregó «Enviar las guías de entrega firmadas de los pedidos 1041 y 1042». ¿Lo recibiste?',
    });
    expect(avisos[0]!.aviso!.cuerpo).toContain('(PEDIDOS-13)');
    expect(idsInternosEn(`${avisos[0]!.accion.motivo} ${avisos[0]!.accion.hechoOrigen} ${avisos[0]!.aviso!.cuerpo}`)).toEqual([]);
    const recepcion = otra.despues.seguimientos.filter((s) => s.trabajoId === 'M01' && s.tipo === 'recepcion');
    expect(recepcion.map((s) => [s.destinatarioId, s.nivel, s.estado, s.plazoReferencia, s.iniciadoEn])).toEqual([
      ['ricardo-brenes', 0, 'pendiente', A_LAS('07:10'), A_LAS('07:10')],
    ]);
    expect(recepcion[0]!.proximoEn).toEqual(A_LAS('11:10'));
    // Ninguna otra acción de entrega: la entrega ya estaba registrada.
    expect(acciones(otra.efectos).filter((a) => a.accion.tipo === 'registrar_entrega')).toEqual([]);

    // Una tercera lectura con el mismo buzón no repite ni el aviso ni el seguimiento.
    const tercera = leer({ ...otra.despues, ahora: A_LAS('07:20') }, conDiego, new Set([...claves(v1.copias), ...claves(otra.copias)]));
    expect(tercera.efectos).toEqual([]);
  });

  it('sin entrega, confirmar por fuentes no avisa a nadie (M02 con el buzón de Daniela)', () => {
    const v1 = leer(semilla());
    const conDaniela = construirBuzonesGmail(EMPRESA, MENSAJES_BASE, ['esteban-castro', 'daniela-quesada']).map((b) => normalizarBuzonGmail(b, EMPRESA));
    const otra = leer({ ...v1.despues, ahora: A_LAS('07:10') }, conDaniela, claves(v1.copias));
    expect(trabajo(otra.despues, 'M02')).toMatchObject({ confirmacion: 'confirmado', confirmadoPorId: null });
    expect(acciones(otra.efectos).filter((a) => a.aviso !== null)).toEqual([]);
    expect(otra.despues.seguimientos.filter((s) => s.tipo === 'recepcion')).toEqual([]);
  });

  it('un descartado no vuelve por una fuente nueva', () => {
    const v1 = leer(semilla());
    const sinM01 = aplicarEnMemoria(v1.despues, [{ tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { confirmacion: 'descartado' }, actorId: 'ricardo-brenes' }]);
    const conDiego = construirBuzonesGmail(EMPRESA, MENSAJES_BASE, ['ricardo-brenes', 'diego-rojas']).map((b) => normalizarBuzonGmail(b, EMPRESA));
    const otra = leer({ ...sinM01, ahora: A_LAS('07:10') }, conDiego, claves(v1.copias));
    expect(otra.despues.trabajos.some((t) => t.id === 'M01' || t.titulo.startsWith('Enviar las guías'))).toBe(false);
    expect(otra.resumen).toMatchObject({ creados: [], propuestos: [], entregas: [] });
    const filas = deTipo(otra.efectos, 'registrar_mensajes')[0]!.mensajes.filter((m) => m.idInternet === '<h3-m1@friodelvalle.cr>');
    expect(filas.map((m) => [m.personaId, m.resultado])).toEqual([['diego-rojas', 'descartado']]);
  });
});

describe('piezas: mismoHecho, enlazarEspera, proyectoDelPedido', () => {
  const inst = semilla();
  const pedido = (p: Partial<PedidoCorreo>): PedidoCorreo => ({
    tipo: 'pedido',
    compromisoClave: 'c-x',
    mensajeId: '<x@friodelvalle.cr>',
    autorId: 'andres-vargas',
    en: A_LAS('07:00'),
    cita: '',
    enlaces: {},
    buzones: [],
    asunto: '',
    titulo: '',
    solicitanteId: 'andres-vargas',
    responsableId: 'ricardo-brenes',
    plazo: null,
    monto: null,
    espera: null,
    ...p,
  });
  const espera = (e: Partial<EsperaCorreo>): EsperaCorreo => ({ clase: 'dependencia', texto: '', actor: null, objeto: '', quienEsperaId: 'andres-vargas', ...e });

  it('mismoHecho: mismo responsable y título parecido; otro responsable o un solicitante distinto no cuentan', () => {
    expect(mismoHecho(inst, pedido({ titulo: 'Confirmar el pago anticipado del pedido 1047 de La Colina' }))).toBe('T27');
    expect(mismoHecho(inst, pedido({ titulo: 'Confirmar el pago anticipado del pedido 1047 de La Colina', responsableId: 'paola-herrera' }))).toBeNull();
    const conSolicitante = { ...inst, trabajos: inst.trabajos.map((t) => (t.id === 'T27' ? { ...t, solicitadoPorId: 'marcela-solis' } : t)) };
    expect(mismoHecho(conSolicitante, pedido({ titulo: 'Confirmar el pago anticipado del pedido 1047 de La Colina' }))).toBeNull();
    // Un resuelto no es el mismo hecho.
    expect(mismoHecho(inst, pedido({ titulo: 'Conteo físico de repuestos críticos', responsableId: 'diego-rojas' }))).toBeNull();
  });

  it('enlazarEspera: objeto + actor; por debajo del umbral, null; nunca consigo mismo', () => {
    expect(enlazarEspera(inst, espera({ actor: 'Paola', objeto: 'la cotización' }), null)).toBe('T28');
    expect(enlazarEspera(inst, espera({ actor: 'Ventas', objeto: 'la cotización' }), null)).toBe('T28');
    expect(enlazarEspera(inst, espera({ actor: null, objeto: 'la cotización' }), null)).toBeNull();
    expect(enlazarEspera(inst, espera({ actor: 'Paola', objeto: 'la cotización' }), 'T28')).toBeNull();
  });

  it('proyectoDelPedido: el del enlazado; si no, por el asunto', () => {
    expect(proyectoDelPedido(inst, pedido({ asunto: 'Factura proforma Hotel Mirador' }), 'T28')).toBe('P4');
    expect(proyectoDelPedido(inst, pedido({ asunto: 'Factura proforma Hotel Mirador' }), null)).toBe('OD');
    expect(proyectoDelPedido(inst, pedido({ asunto: 'Guías 1045' }), null)).toBe('P4');
    expect(proyectoDelPedido(inst, pedido({ asunto: 'Fotos Trigal' }), null)).toBe('P2');
    expect(proyectoDelPedido(inst, pedido({ asunto: 'Visita La Colina' }), null)).toBe('P1');
    expect(proyectoDelPedido(inst, pedido({ asunto: 'Inventario de bodega' }), null)).toBe('P3');
  });
});
