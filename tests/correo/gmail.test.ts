// Adaptador de Gmail (docs/06 §13): de la forma de la API de Gmail al mensaje normalizado, y el mismo resultado
// que con Outlook.
import { describe, expect, it } from 'vitest';
import { construirBuzonesEjemplo, construirBuzonesGmail } from '@/correo/ejemplo/buzones';
import { EMPRESA_ALTAVISTA } from '@/correo/ejemplo/empresa';
import { decodificarEncabezado, direccionesDe, sinCitas, textoDeHtml } from '@/correo/fuentes/comun';
import { codificarBase64Url, decodificarBase64Url, normalizarBuzonGmail, normalizarMensajeGmail, textoDeCuerpoGmail, validarCuentaGmail } from '@/correo/fuentes/gmail';
import { calcularModeloCorreo } from '@/correo/modelo';
import type { MensajeGmail, ModeloCorreo } from '@/correo/tipos';
import { unirBuzones } from '@/correo/union';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';

const SIETE = enCR('2026-11-25', '07:00');

function mensaje(parcial: Partial<MensajeGmail> & { headers: { name: string; value: string }[]; texto?: string }): MensajeGmail {
  const { headers, texto = 'Hola', ...resto } = parcial;
  return {
    id: '18c0000000000001',
    threadId: '18c0000000000001',
    labelIds: ['INBOX', 'CATEGORY_PERSONAL'],
    snippet: texto,
    historyId: '1',
    internalDate: String(SIETE.getTime()),
    payload: { mimeType: 'text/plain', headers, body: { size: texto.length, data: codificarBase64Url(texto) } },
    ...resto,
  };
}

describe('piezas del adaptador', () => {
  it('base64url ida y vuelta con tildes y colones', () => {
    const texto = '¿Puedes aprobar ₡18.000.000? Gracias, Ana.';
    expect(codificarBase64Url(texto)).not.toMatch(/[+/=]/);
    expect(decodificarBase64Url(codificarBase64Url(texto))).toBe(texto);
  });

  it('decodifica encabezados RFC 2047 en base64 y en quoted-printable', () => {
    expect(decodificarEncabezado('=?UTF-8?B?UmV2aXNpw7NuIGNvbnRyYXRv?= TransLog')).toBe('Revisión contrato TransLog');
    expect(decodificarEncabezado('=?UTF-8?Q?Garant=C3=ADa_de_cumplimiento?=')).toBe('Garantía de cumplimiento');
    expect(decodificarEncabezado('Sin codificar')).toBe('Sin codificar');
  });

  it('lee listas de direcciones con nombres entre comillas que llevan coma', () => {
    expect(direccionesDe('"Méndez, Luis" <Luis.Mendez@altavista.cr>, ana.rodriguez@altavista.cr')).toEqual([
      { nombre: 'Méndez, Luis', correo: 'luis.mendez@altavista.cr' },
      { nombre: '', correo: 'ana.rodriguez@altavista.cr' },
    ]);
  });

  it('quita el historial citado de Gmail y de Outlook', () => {
    expect(sinCitas('Listo, va.\n\nEl 2026-11-17 a las 14:00, Sergio Vargas <s@altavista.cr> escribió:\n> ¿Puedes revisar...?')).toBe('Listo, va.');
    expect(sinCitas('Listo.\n\n________________________________\nDe: Sergio Vargas\n¿Puedes revisar...?')).toBe('Listo.');
    expect(sinCitas('Arriba.\n> línea citada suelta\nAbajo.')).toBe('Arriba.\nAbajo.');
  });

  it('limpia el HTML: sin estilos, con entidades y párrafos', () => {
    expect(textoDeHtml('<style>p{margin:0}</style><p>Valeria,&nbsp;¿puedes?</p><p>A &amp; B</p>')).toBe('Valeria, ¿puedes?\nA & B');
  });

  it('prefiere text/plain, usa HTML si no hay y no lee adjuntos', () => {
    const adjunto = { mimeType: 'text/plain', filename: 'contrato.txt', body: { size: 3, data: codificarBase64Url('NO') } };
    const html = { mimeType: 'text/html', body: { size: 1, data: codificarBase64Url('<p>Solo HTML</p>') } };
    expect(textoDeCuerpoGmail({ mimeType: 'multipart/mixed', body: { size: 0 }, parts: [adjunto, html] })).toBe('Solo HTML');
    const plano = { mimeType: 'text/plain', body: { size: 1, data: codificarBase64Url('Plano') } };
    expect(textoDeCuerpoGmail({ mimeType: 'multipart/alternative', body: { size: 0 }, parts: [plano, html] })).toBe('Plano');
  });
});

describe('cuentas y etiquetas', () => {
  it('solo conecta cuentas de Google Workspace de la empresa', () => {
    expect(() => validarCuentaGmail('ana.rodriguez@altavista.cr', EMPRESA_ALTAVISTA)).not.toThrow();
    expect(() => validarCuentaGmail('ana.rodriguez@gmail.com', EMPRESA_ALTAVISTA)).toThrow(/cuentas personales de Gmail/);
    expect(() => validarCuentaGmail('ana@translog.cr', EMPRESA_ALTAVISTA)).toThrow(ErrorDominio);
  });

  it('no lee borradores, spam ni papelera', () => {
    const base = { headers: [{ name: 'From', value: 'Ana <ana.rodriguez@altavista.cr>' }, { name: 'Message-ID', value: '<x@altavista.cr>' }] };
    const buzon = normalizarBuzonGmail(
      {
        personaId: 'carla-fernandez',
        direccion: 'carla.fernandez@altavista.cr',
        mensajes: [mensaje({ ...base, id: 'a', labelIds: ['DRAFT'] }), mensaje({ ...base, id: 'b', labelIds: ['SPAM'] }), mensaje({ ...base, id: 'c', labelIds: ['TRASH'] }), mensaje({ ...base, id: 'd' })],
      },
      EMPRESA_ALTAVISTA,
    );
    expect(buzon.mensajes.map((m) => m.idEnBuzon)).toEqual(['d']);
  });

  it('Promociones cuenta como boletín aunque no traiga List-Unsubscribe, y su cuerpo no se abre', () => {
    const m = normalizarMensajeGmail(
      mensaje({ labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'], texto: '¿Puedes comprar hoy?', headers: [{ name: 'From', value: 'Tienda <ventas@altavista.cr>' }] }),
      'ana.rodriguez@altavista.cr',
      EMPRESA_ALTAVISTA,
    );
    expect(m).toMatchObject({ automatico: true, texto: '' });
  });

  it('el cuerpo de un correo personal ni se decodifica', () => {
    const m = normalizarMensajeGmail(
      mensaje({ texto: '¿Puedes traer el postre?', headers: [{ name: 'From', value: 'Mamá <mama@correo-personal.com>' }] }),
      'carla.fernandez@altavista.cr',
      EMPRESA_ALTAVISTA,
    );
    expect(m.texto).toBe('');
  });
});

describe('buzones de Altavista en formato Gmail', () => {
  const gmail = construirBuzonesGmail();

  it('el mismo correo tiene otro id y otro threadId en cada buzón, y el mismo Message-ID', () => {
    const copias = gmail.flatMap((b) => b.mensajes.filter((m) => m.payload.headers?.some((h) => h.name === 'Message-ID' && h.value === '<h1-m1@altavista.cr>')).map((m) => ({ b: b.personaId, m })));
    expect(copias.map((x) => x.b).sort()).toEqual(['ana-rodriguez', 'luis-mendez', 'roberto-solano']);
    expect(new Set(copias.map((x) => x.m.id)).size).toBe(3);
    expect(new Set(copias.map((x) => x.m.threadId)).size).toBe(3);
  });

  it('une el hilo entre buzones aunque cada uno tenga su threadId', () => {
    const { hilos } = unirBuzones(construirBuzonesEjemplo('gmail'), EMPRESA_ALTAVISTA, SIETE);
    const h1 = hilos.find((h) => h.asunto === 'Revisión contrato TransLog')!;
    expect(h1.id).toBe('hilo-h1-m1');
    expect(h1.mensajes.map((m) => m.internetMessageId)).toEqual(['<h1-m1@altavista.cr>', '<h1-m2@altavista.cr>']);
    expect(h1.mensajes[1]!.enlaces['luis-mendez']).toMatch(/^https:\/\/mail\.google\.com\/mail\/u\/\?authuser=luis\.mendez%40altavista\.cr#all\/[0-9a-f]{16}$/);
  });

  it('decodifica asuntos con tilde y quita la cita de la respuesta', () => {
    const luis = construirBuzonesEjemplo('gmail').find((b) => b.personaId === 'luis-mendez')!;
    const respuesta = luis.mensajes.find((m) => m.idInternet === '<h1-m2@altavista.cr>')!;
    expect(respuesta.asunto).toBe('RE: Revisión contrato TransLog');
    expect(respuesta.texto).not.toContain('¿Puedes revisar');
  });

  it('el borrador de Roberto no se lee ni cuenta', () => {
    const roberto = construirBuzonesEjemplo('gmail').find((b) => b.personaId === 'roberto-solano')!;
    expect(roberto.mensajes.some((m) => m.idInternet.includes('borrador'))).toBe(false);
  });
});

describe('Gmail y Outlook dan el mismo resultado', () => {
  function resumen(m: ModeloCorreo) {
    return {
      compromisos: m.compromisos.map(({ evidencias, ...c }) => ({ ...c, citas: evidencias.map((e) => [e.cita, e.mensajeId, Object.keys(e.enlaces).sort()]) })),
      proyectos: m.proyectos,
      cuellos: m.cuellos,
      conteos: m.conteos.map(({ proveedor: _p, ...k }) => k),
    };
  }

  it('mismos compromisos, cadenas, cuellos de botella y conteos', () => {
    const entrada = { empresa: EMPRESA_ALTAVISTA, correcciones: [], ahora: SIETE };
    const deGmail = calcularModeloCorreo({ ...entrada, buzones: construirBuzonesEjemplo('gmail') });
    const deOutlook = calcularModeloCorreo({ ...entrada, buzones: construirBuzonesEjemplo('outlook') });
    expect(deGmail.compromisos).toHaveLength(7);
    expect(resumen(deGmail)).toEqual(resumen(deOutlook));
    expect(deGmail.conteos.every((k) => k.proveedor === 'gmail')).toBe(true);
  });
});
