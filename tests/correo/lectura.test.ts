// Lectura de los buzones: de mensajes a hechos (docs/08 reglas 10–11, §5.4 y V15). Puras, sobre los buzones de ejemplo.
import { describe, expect, it } from 'vitest';
import { construirBuzonesEjemplo, construirBuzonesGmail, MENSAJES_BASE, type MensajeBase } from '@/correo/ejemplo/buzones';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { claveCompromiso, extraerHechos, plazoDesdeTexto } from '@/correo/extraccion';
import { ExtractorLocal } from '@/correo/extractor';
import { normalizarBuzonGmail } from '@/correo/fuentes/gmail';
import { hechosDeCorreo, siguienteEnvio } from '@/correo/lectura';
import type { Buzon, HechoCorreo, PedidoCorreo } from '@/correo/tipos';
import { unirBuzones } from '@/correo/union';
import { enCR } from '@/dominio/tiempo';

const EMPRESA = EMPRESA_FRIO_DEL_VALLE;
const A_LAS_7_05 = enCR('2026-11-25', '07:05');
const A_LAS_8_20 = enCR('2026-11-25', '08:20');

const pedidos = (hs: HechoCorreo[]) => hs.filter((h): h is PedidoCorreo => h.tipo === 'pedido');
const resumen = (hs: HechoCorreo[]) => hs.map((h) => [h.tipo, h.compromisoClave]);

function buzonesCon(extra: MensajeBase[]): Buzon[] {
  return construirBuzonesGmail(EMPRESA, [...MENSAJES_BASE, ...extra]).map((b) => normalizarBuzonGmail(b, EMPRESA));
}

describe('§5.4: la lectura de las 7:05', () => {
  const { hechos, copias } = hechosDeCorreo(construirBuzonesEjemplo(), EMPRESA, A_LAS_7_05);

  it('23 copias: 19 de trabajo (8 mensajes únicos), 2 personales y 2 boletines', () => {
    expect(copias).toHaveLength(23);
    expect(copias.filter((c) => c.clase === 'laboral')).toHaveLength(19);
    expect(new Set(copias.filter((c) => c.clase === 'laboral').map((c) => c.idInternet)).size).toBe(8);
    expect(copias.filter((c) => c.clase === 'personal')).toHaveLength(2);
    expect(copias.filter((c) => c.clase === 'boletin')).toHaveLength(2);
  });

  it('conteos por buzón (leídos/de trabajo/personales/boletines)', () => {
    const por = (id: string) => {
      const cs = copias.filter((c) => c.personaId === id);
      return [cs.length, ...(['laboral', 'personal', 'boletin'] as const).map((k) => cs.filter((c) => c.clase === k).length)];
    };
    expect({
      marcela: por('marcela-solis'),
      andres: por('andres-vargas'),
      ricardo: por('ricardo-brenes'),
      paola: por('paola-herrera'),
      sofia: por('sofia-navarro'),
      karla: por('karla-jimenez'),
      lucia: por('lucia-mora'),
      esteban: por('esteban-castro'),
    }).toEqual({
      marcela: [1, 1, 0, 0],
      andres: [3, 3, 0, 0],
      ricardo: [5, 4, 0, 1],
      paola: [3, 3, 0, 0],
      sofia: [3, 2, 1, 0],
      karla: [3, 2, 1, 0],
      lucia: [3, 2, 0, 1],
      esteban: [2, 2, 0, 0],
    });
  });

  it('los hechos van en orden de envío: H1, H3-m1, H6, H2, H7, H3-m2 (entrega), H4', () => {
    expect(resumen(hechos)).toEqual([
      ['pedido', 'c-h1-m1'],
      ['pedido', 'c-h3-m1'],
      ['pedido', 'c-h6-m1'],
      ['pedido', 'c-h2-m1'],
      ['pedido', 'c-h7-m1'],
      ['entrega', 'c-h3-m1'],
      ['pedido', 'c-h4-m1'],
    ]);
  });

  it('cada pedido trae título, partes, plazo y los buzones conectados donde está el mensaje', () => {
    const [h1, h3, h6, h2, h7, h4] = pedidos(hechos);
    expect(h1).toMatchObject({
      titulo: 'Confirmar el pago anticipado del pedido 1047 de La Colina',
      solicitanteId: 'andres-vargas',
      responsableId: 'ricardo-brenes',
      plazo: enCR('2026-11-26', '17:00'),
      mensajeId: '<h1-m1@friodelvalle.cr>',
      asunto: 'Pago anticipado pedido 1047',
      monto: null,
      espera: null,
    });
    expect([...h1!.buzones].sort()).toEqual(['andres-vargas', 'paola-herrera', 'ricardo-brenes']);
    expect(Object.keys(h1!.enlaces).sort()).toEqual([...h1!.buzones].sort());
    expect(h3).toMatchObject({
      titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
      solicitanteId: 'ricardo-brenes',
      responsableId: 'diego-rojas',
      plazo: enCR('2026-11-27', '17:00'),
      buzones: ['ricardo-brenes'],
      cita: 'Diego, ¿puedes enviarme las guías de entrega firmadas de los pedidos 1041 y 1042?',
    });
    expect(h6).toMatchObject({ titulo: 'Cotizar el reorden con dos proveedores', responsableId: 'karla-jimenez' });
    // H2 llega solo en HTML: se lee igual.
    expect(h2).toMatchObject({ titulo: 'Enviar la cotización de la cámara fría al Hotel Mirador', plazo: enCR('2026-11-25', '12:00') });
    // H7 no trae plazo: «no lo sé».
    expect(h7).toMatchObject({ titulo: 'Reprogramar la entrega 1043 con el cliente', responsableId: 'sofia-navarro', plazo: null, buzones: ['sofia-navarro'] });
    expect(h4).toMatchObject({ titulo: 'Enviar las fotos del mantenimiento de Heredia y Alajuela', responsableId: 'daniela-quesada', buzones: ['esteban-castro'] });
  });

  it('la entrega de Diego es del pedido de Ricardo y la cita es lo que escribió Diego, sin el historial citado', () => {
    const entrega = hechos.find((h) => h.tipo === 'entrega');
    expect(entrega).toMatchObject({
      compromisoClave: 'c-h3-m1',
      autorId: 'diego-rojas',
      en: enCR('2026-11-24', '16:30'),
      cita: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.',
      buzones: ['ricardo-brenes'],
    });
  });

  it('ningún hecho sale del ruido (personales, boletines, cumpleaños) ni del borrador', () => {
    const ruido = MENSAJES_BASE.filter((m) => m.clave.startsWith('r-')).map((m) => `<${m.clave}@`);
    expect(hechos.filter((h) => ruido.some((r) => h.mensajeId.startsWith(r)))).toEqual([]);
    expect(copias.some((c) => c.idInternet.startsWith('<r-borrador'))).toBe(false);
  });
});

describe('§5.4: la lectura de las 8:20', () => {
  it('suma 2 copias (Andrés y Ricardo) de un mensaje: H5 con su espera dentro del pedido', () => {
    const antes = hechosDeCorreo(construirBuzonesEjemplo(), EMPRESA, A_LAS_7_05);
    const despues = hechosDeCorreo(construirBuzonesEjemplo(), EMPRESA, A_LAS_8_20);
    const leidas = new Set(antes.copias.map((c) => `${c.personaId}|${c.idInternet}`));
    const nuevas = despues.copias.filter((c) => !leidas.has(`${c.personaId}|${c.idInternet}`));
    expect(nuevas.map((c) => c.personaId)).toEqual(['andres-vargas', 'ricardo-brenes']);
    const h5 = pedidos(despues.hechos).find((p) => p.compromisoClave === 'c-h5-m1');
    expect(h5).toMatchObject({
      titulo: 'Emitir la factura proforma de la cámara fría del Hotel Mirador',
      solicitanteId: 'andres-vargas',
      responsableId: 'ricardo-brenes',
      plazo: enCR('2026-11-27', '17:00'),
      espera: { clase: 'dependencia', texto: 'en cuanto Paola envíe la cotización', actor: 'Paola', objeto: 'la cotización', quienEsperaId: 'andres-vargas' },
    });
    expect([...h5!.buzones].sort()).toEqual(['andres-vargas', 'ricardo-brenes']);
    // La espera va dentro del pedido: no sale un hecho `espera` aparte.
    expect(despues.hechos.filter((h) => h.mensajeId === '<h5-m1@friodelvalle.cr>').map((h) => h.tipo)).toEqual(['pedido']);
  });
});

describe('V15: Gmail y Outlook dan lo mismo', () => {
  it('mismos hechos y mismas copias', () => {
    for (const ahora of [A_LAS_7_05, A_LAS_8_20]) {
      const gmail = hechosDeCorreo(construirBuzonesEjemplo('gmail'), EMPRESA, ahora);
      const outlook = hechosDeCorreo(construirBuzonesEjemplo('outlook'), EMPRESA, ahora);
      const sinEnlaces = (hs: HechoCorreo[]) => hs.map((h) => ({ ...h, enlaces: Object.keys(h.enlaces).sort() }));
      expect(sinEnlaces(outlook.hechos)).toEqual(sinEnlaces(gmail.hechos));
      expect(outlook.copias).toEqual(gmail.copias);
    }
  });
});

describe('siguienteEnvio (regla 10)', () => {
  const buzones = construirBuzonesEjemplo();
  it('a las 7:05 el próximo mensaje sin leer es H5 (8:20); después de leerlo, ninguno', () => {
    expect(siguienteEnvio(buzones, new Set(), A_LAS_7_05)).toEqual(A_LAS_8_20);
    const todo = hechosDeCorreo(buzones, EMPRESA, A_LAS_8_20).copias.map((c) => `${c.personaId}|${c.idInternet}`);
    expect(siguienteEnvio(buzones, new Set(todo), A_LAS_8_20)).toBeNull();
    // Lo ya leído no cuenta aunque sea posterior a `ahora`.
    expect(siguienteEnvio(buzones, new Set(todo), A_LAS_7_05)).toBeNull();
  });
});

describe('extracción de hechos: piezas', () => {
  it('«hoy antes de las 16:00» es el mismo día del envío', () => {
    expect(plazoDesdeTexto('¿Puedes revisarlo? Lo necesito hoy antes de las 16:00.', enCR('2026-11-25', '09:00'))).toEqual(enCR('2026-11-25', '16:00'));
  });

  it('la clave del compromiso sale del Message-ID', () => {
    expect(claveCompromiso('<h3-m1@friodelvalle.cr>')).toBe('c-h3-m1');
  });

  it('aceptación, bloqueo, recepción e insistencia de cada parte, con la clave de su pedido', () => {
    const extra: MensajeBase[] = [
      { clave: 'y1-m1', hilo: 'Y1', asunto: 'Inventario de repuestos', de: 'karla.jimenez@friodelvalle.cr', para: ['lucia.mora@friodelvalle.cr'], fecha: '2026-11-24', hora: '08:00', texto: 'Lucía, ¿puedes enviarme el inventario de repuestos? Lo necesito antes del 26 de noviembre.' },
      { clave: 'y1-m2', hilo: 'Y1', asunto: 'RE: Inventario de repuestos', de: 'lucia.mora@friodelvalle.cr', para: ['karla.jimenez@friodelvalle.cr'], fecha: '2026-11-24', hora: '08:30', texto: 'Karla, lo reviso hoy.' },
      { clave: 'y1-m3', hilo: 'Y1', asunto: 'RE: Inventario de repuestos', de: 'karla.jimenez@friodelvalle.cr', para: ['lucia.mora@friodelvalle.cr'], fecha: '2026-11-24', hora: '11:00', texto: 'Lucía, ¿cómo vamos con el inventario?' },
      { clave: 'y1-m4', hilo: 'Y1', asunto: 'RE: Inventario de repuestos', de: 'lucia.mora@friodelvalle.cr', para: ['karla.jimenez@friodelvalle.cr'], fecha: '2026-11-24', hora: '12:00', texto: 'Karla, lo termino en cuanto Diego cuente los empaques.' },
      { clave: 'y1-m5', hilo: 'Y1', asunto: 'RE: Inventario de repuestos', de: 'lucia.mora@friodelvalle.cr', para: ['karla.jimenez@friodelvalle.cr'], fecha: '2026-11-24', hora: '15:00', texto: 'Karla, te adjunto el inventario.' },
      { clave: 'y1-m6', hilo: 'Y1', asunto: 'RE: Inventario de repuestos', de: 'karla.jimenez@friodelvalle.cr', para: ['lucia.mora@friodelvalle.cr'], fecha: '2026-11-24', hora: '15:30', texto: 'Recibido, gracias.' },
    ];
    const { hilos } = unirBuzones(buzonesCon(extra), EMPRESA, A_LAS_7_05);
    const hilo = hilos.find((h) => h.asunto === 'Inventario de repuestos')!;
    const hs = new ExtractorLocal().extraer(hilo, EMPRESA);
    expect(hs.map((h) => [h.tipo, h.autorId, h.compromisoClave])).toEqual([
      ['pedido', 'karla-jimenez', 'c-y1-m1'],
      ['aceptacion', 'lucia-mora', 'c-y1-m1'],
      ['insistencia', 'karla-jimenez', 'c-y1-m1'],
      ['espera', 'lucia-mora', 'c-y1-m1'],
      ['entrega', 'lucia-mora', 'c-y1-m1'],
      ['recepcion', 'karla-jimenez', 'c-y1-m1'],
    ]);
    expect(hs[3]).toMatchObject({ clase: 'bloqueo', actor: 'Diego', objeto: 'los empaques', quienEsperaId: 'lucia-mora', texto: 'en cuanto Diego cuente los empaques' });
    expect(extraerHechos(hilo, EMPRESA)).toEqual(hs);
  });

  it('un pedido a alguien de fuera de la empresa sale sin responsable', () => {
    const extra: MensajeBase[] = [
      { clave: 'y2-m1', hilo: 'Y2', asunto: 'Planos cámara', de: 'andres.vargas@friodelvalle.cr', para: ['compras@lacolina.cr'], fecha: '2026-11-24', hora: '08:00', texto: '¿Pueden enviarnos los planos antes del 26 de noviembre? ¿Puedes confirmarlo?' },
    ];
    const { hechos } = hechosDeCorreo(buzonesCon(extra), EMPRESA, A_LAS_7_05);
    expect(pedidos(hechos).find((p) => p.compromisoClave === 'c-y2-m1')).toMatchObject({ solicitanteId: 'andres-vargas', responsableId: null });
  });
});
