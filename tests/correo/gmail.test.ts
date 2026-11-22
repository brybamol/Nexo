// Adaptador de Gmail (docs/06 §13): de la forma de la API de Gmail al mensaje normalizado, y el mismo resultado
// que con Outlook. Datos de Frío del Valle (docs/08 §5).
import { describe, expect, it } from 'vitest';
import { BUZONES_DEMO, construirBuzonesEjemplo, construirBuzonesGmail } from '@/correo/ejemplo/buzones';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { decodificarEncabezado, direccionesDe, sinCitas, textoDeHtml } from '@/correo/fuentes/comun';
import { codificarBase64Url, decodificarBase64Url, normalizarBuzonGmail, normalizarMensajeGmail, textoDeCuerpoGmail, validarCuentaGmail } from '@/correo/fuentes/gmail';
import type { MensajeGmail } from '@/correo/tipos';
import { hechosDeCorreo } from '@/correo/lectura';
import { unirBuzones } from '@/correo/union';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';

const LECTURA_7_05 = enCR('2026-11-25', '07:05');

function mensaje(parcial: Partial<MensajeGmail> & { headers: { name: string; value: string }[]; texto?: string }): MensajeGmail {
  const { headers, texto = 'Hola', ...resto } = parcial;
  return {
    id: '18c0000000000001',
    threadId: '18c0000000000001',
    labelIds: ['INBOX', 'CATEGORY_PERSONAL'],
    snippet: texto,
    historyId: '1',
    internalDate: String(LECTURA_7_05.getTime()),
    payload: { mimeType: 'text/plain', headers, body: { size: texto.length, data: codificarBase64Url(texto) } },
    ...resto,
  };
}

describe('piezas del adaptador', () => {
  it('base64url ida y vuelta con tildes y colones', () => {
    const texto = '¿Puedes aprobar ₡18.000.000? Gracias, Marcela.';
    expect(codificarBase64Url(texto)).not.toMatch(/[+/=]/);
    expect(decodificarBase64Url(codificarBase64Url(texto))).toBe(texto);
  });

  it('decodifica encabezados RFC 2047 en base64 y en quoted-printable', () => {
    expect(decodificarEncabezado('=?UTF-8?B?Q290aXphY2nDs24=?= cámara fría')).toBe('Cotización cámara fría');
    expect(decodificarEncabezado('=?UTF-8?Q?Gu=C3=ADas_de_entrega?=')).toBe('Guías de entrega');
    expect(decodificarEncabezado('Sin codificar')).toBe('Sin codificar');
  });

  it('lee listas de direcciones con nombres entre comillas que llevan coma', () => {
    expect(direccionesDe('"Brenes, Ricardo" <Ricardo.Brenes@friodelvalle.cr>, paola.herrera@friodelvalle.cr')).toEqual([
      { nombre: 'Brenes, Ricardo', correo: 'ricardo.brenes@friodelvalle.cr' },
      { nombre: '', correo: 'paola.herrera@friodelvalle.cr' },
    ]);
  });

  it('quita el historial citado de Gmail y de Outlook', () => {
    expect(sinCitas('Listo, va.\n\nEl 2026-11-23 a las 15:00, Ricardo Brenes <r@friodelvalle.cr> escribió:\n> ¿Puedes enviarme...?')).toBe('Listo, va.');
    expect(sinCitas('Listo.\n\n________________________________\nDe: Ricardo Brenes\n¿Puedes enviarme...?')).toBe('Listo.');
    expect(sinCitas('Arriba.\n> línea citada suelta\nAbajo.')).toBe('Arriba.\nAbajo.');
  });

  it('limpia el HTML: sin estilos, con entidades y párrafos', () => {
    expect(textoDeHtml('<style>p{margin:0}</style><p>Paola,&nbsp;¿puedes?</p><p>A &amp; B</p>')).toBe('Paola, ¿puedes?\nA & B');
  });

  it('prefiere text/plain, usa HTML si no hay y no lee adjuntos', () => {
    const adjunto = { mimeType: 'text/plain', filename: 'guias.txt', body: { size: 3, data: codificarBase64Url('NO') } };
    const html = { mimeType: 'text/html', body: { size: 1, data: codificarBase64Url('<p>Solo HTML</p>') } };
    expect(textoDeCuerpoGmail({ mimeType: 'multipart/mixed', body: { size: 0 }, parts: [adjunto, html] })).toBe('Solo HTML');
    const plano = { mimeType: 'text/plain', body: { size: 1, data: codificarBase64Url('Plano') } };
    expect(textoDeCuerpoGmail({ mimeType: 'multipart/alternative', body: { size: 0 }, parts: [plano, html] })).toBe('Plano');
  });
});

describe('cuentas y etiquetas', () => {
  it('solo conecta cuentas de Google Workspace de la empresa', () => {
    expect(() => validarCuentaGmail('paola.herrera@friodelvalle.cr', EMPRESA_FRIO_DEL_VALLE)).not.toThrow();
    expect(() => validarCuentaGmail('paola@gmail.com', EMPRESA_FRIO_DEL_VALLE)).toThrow(/cuentas personales de Gmail/);
    expect(() => validarCuentaGmail('ventas@refrigeracioncentral.cr', EMPRESA_FRIO_DEL_VALLE)).toThrow(ErrorDominio);
  });

  it('no lee borradores, spam ni papelera', () => {
    const base = { headers: [{ name: 'From', value: 'Andrés <andres.vargas@friodelvalle.cr>' }, { name: 'Message-ID', value: '<x@friodelvalle.cr>' }] };
    const buzon = normalizarBuzonGmail(
      {
        personaId: 'ricardo-brenes',
        direccion: 'ricardo.brenes@friodelvalle.cr',
        mensajes: [mensaje({ ...base, id: 'a', labelIds: ['DRAFT'] }), mensaje({ ...base, id: 'b', labelIds: ['SPAM'] }), mensaje({ ...base, id: 'c', labelIds: ['TRASH'] }), mensaje({ ...base, id: 'd' })],
      },
      EMPRESA_FRIO_DEL_VALLE,
    );
    expect(buzon.mensajes.map((m) => m.idEnBuzon)).toEqual(['d']);
  });

  it('Promociones cuenta como boletín aunque no traiga List-Unsubscribe, y su cuerpo no se abre', () => {
    const m = normalizarMensajeGmail(
      mensaje({ labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'], texto: '¿Puedes comprar hoy?', headers: [{ name: 'From', value: 'Tienda <ventas@friodelvalle.cr>' }] }),
      'lucia.mora@friodelvalle.cr',
      EMPRESA_FRIO_DEL_VALLE,
    );
    expect(m).toMatchObject({ automatico: true, texto: '' });
  });

  it('el cuerpo de un correo personal ni se decodifica', () => {
    const m = normalizarMensajeGmail(
      mensaje({ texto: '¿Puedes traer el postre?', headers: [{ name: 'From', value: 'Mamá <mama@correo-personal.com>' }] }),
      'sofia.navarro@friodelvalle.cr',
      EMPRESA_FRIO_DEL_VALLE,
    );
    expect(m.texto).toBe('');
  });
});

describe('buzones de Frío del Valle en formato Gmail', () => {
  const gmail = construirBuzonesGmail();

  it('solo hay buzón de las 8 personas conectadas; Diego, José, Daniela y Mario no tienen', () => {
    const ids = gmail.map((b) => b.personaId).sort();
    expect(ids).toEqual(BUZONES_DEMO.map((b) => b.personaId).sort());
    expect(ids).toHaveLength(8);
    expect(ids).not.toContain('diego-rojas');
    expect(BUZONES_DEMO.every((b) => b.proveedor === 'gmail' && b.direccion.endsWith('@friodelvalle.cr'))).toBe(true);
  });

  it('el mismo correo tiene otro id y otro threadId en cada buzón, y el mismo Message-ID', () => {
    const copias = gmail.flatMap((b) => b.mensajes.filter((m) => m.payload.headers?.some((h) => h.name === 'Message-ID' && h.value === '<h1-m1@friodelvalle.cr>')).map((m) => ({ b: b.personaId, m })));
    expect(copias.map((x) => x.b).sort()).toEqual(['andres-vargas', 'paola-herrera', 'ricardo-brenes']);
    expect(new Set(copias.map((x) => x.m.id)).size).toBe(3);
    expect(new Set(copias.map((x) => x.m.threadId)).size).toBe(3);
  });

  it('une el hilo entre buzones aunque cada uno tenga su threadId', () => {
    const { hilos } = unirBuzones(construirBuzonesEjemplo('gmail'), EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    const h3 = hilos.find((h) => h.asunto === 'Guías de entrega pedidos 1041 y 1042')!;
    expect(h3.id).toBe('hilo-h3-m1');
    expect(h3.mensajes.map((m) => m.internetMessageId)).toEqual(['<h3-m1@friodelvalle.cr>', '<h3-m2@friodelvalle.cr>']);
    // La respuesta de Diego solo está en el buzón de Ricardo: Diego no tiene buzón conectado.
    expect(Object.keys(h3.mensajes[1]!.enlaces)).toEqual(['ricardo-brenes']);
    expect(h3.mensajes[1]!.enlaces['ricardo-brenes']).toMatch(/^https:\/\/mail\.google\.com\/mail\/u\/\?authuser=ricardo\.brenes%40friodelvalle\.cr#all\/[0-9a-f]{16}$/);
  });

  it('decodifica asuntos con tilde y quita la cita de la respuesta', () => {
    const ricardo = construirBuzonesEjemplo('gmail').find((b) => b.personaId === 'ricardo-brenes')!;
    const respuesta = ricardo.mensajes.find((m) => m.idInternet === '<h3-m2@friodelvalle.cr>')!;
    expect(respuesta.asunto).toBe('RE: Guías de entrega pedidos 1041 y 1042');
    expect(respuesta.texto).not.toContain('¿puedes enviarme');
  });

  it('el borrador de Marcela no se lee ni cuenta', () => {
    const marcela = construirBuzonesEjemplo('gmail').find((b) => b.personaId === 'marcela-solis')!;
    expect(marcela.mensajes.some((m) => m.idInternet.includes('borrador'))).toBe(false);
  });
});

describe('Gmail y Outlook dan el mismo resultado', () => {
  const sinProveedor = (cs: ReturnType<typeof unirBuzones>['conteos']) => cs.map((k) => [k.personaId, k.leidos, k.laborales, k.personales, k.boletines]);

  it('mismos hilos, mensajes, enlaces por buzón y conteos de la lectura', () => {
    for (const ahora of [LECTURA_7_05, enCR('2026-11-25', '08:20')]) {
      const deGmail = unirBuzones(construirBuzonesEjemplo('gmail'), EMPRESA_FRIO_DEL_VALLE, ahora);
      const deOutlook = unirBuzones(construirBuzonesEjemplo('outlook'), EMPRESA_FRIO_DEL_VALLE, ahora);
      const forma = (u: typeof deGmail) => u.hilos.map((h) => ({ ...h, mensajes: h.mensajes.map((m) => ({ ...m, enlaces: Object.keys(m.enlaces).sort() })) }));
      expect(forma(deGmail)).toEqual(forma(deOutlook));
      expect(sinProveedor(deGmail.conteos)).toEqual(sinProveedor(deOutlook.conteos));
      expect(deGmail.conteos.every((k) => k.proveedor === 'gmail')).toBe(true);
      expect(deOutlook.conteos.every((k) => k.proveedor === 'outlook')).toBe(true);
    }
  });

  it('mismas copias y hechos en la lectura que alimenta al motor', () => {
    const gmail = hechosDeCorreo(construirBuzonesEjemplo('gmail'), EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    const outlook = hechosDeCorreo(construirBuzonesEjemplo('outlook'), EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    expect(gmail.hechos.length).toBeGreaterThan(0);
    expect(outlook.copias).toEqual(gmail.copias);
  });
});
