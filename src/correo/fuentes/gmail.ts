// Adaptador de Gmail (docs/06 §13): lleva un buzón de la API de Gmail (Google Workspace) a `Buzon`.
// Reglas: solo cuentas del dominio de la empresa (nunca @gmail.com); no se leen borradores, spam ni papelera;
// el cuerpo de lo que no es laboral ni se decodifica.
import { clasificarMensaje } from '@/correo/privacidad';
import type { Buzon, BuzonGmail, EmpresaCorreo, MensajeCorreo, MensajeGmail, ParteGmail } from '@/correo/tipos';
import { ErrorDominio } from '@/dominio/tipos';
import { decodificarEncabezado, direccionesDe, idsDe, sinCitas, textoDeHtml } from './comun';

/** Etiquetas que Nexo no lee. */
export const ETIQUETAS_IGNORADAS = ['DRAFT', 'SPAM', 'TRASH'];
/** Categorías automáticas de Gmail que cuentan como boletín. */
export const CATEGORIAS_AUTOMATICAS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS'];
/** Dominios de cuentas personales de Google: Nexo no las conecta. */
export const DOMINIOS_PERSONALES = ['gmail.com', 'googlemail.com'];

export function decodificarBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function codificarBase64Url(texto: string): string {
  let binario = '';
  for (const b of new TextEncoder().encode(texto)) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function todasLasPartes(p: ParteGmail): ParteGmail[] {
  return [p, ...(p.parts ?? []).flatMap(todasLasPartes)];
}

/** Texto plano del mensaje: prefiere `text/plain`; si solo hay HTML, lo limpia. Ignora adjuntos. */
export function textoDeCuerpoGmail(payload: ParteGmail): string {
  const partes = todasLasPartes(payload).filter((p) => !p.filename && p.body.data);
  const plano = partes.find((p) => p.mimeType === 'text/plain');
  if (plano?.body.data) return decodificarBase64Url(plano.body.data).replace(/\r\n/g, '\n').trim();
  const html = partes.find((p) => p.mimeType === 'text/html');
  if (html?.body.data) return textoDeHtml(decodificarBase64Url(html.body.data));
  return '';
}

function encabezados(payload: ParteGmail): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const h of payload.headers ?? []) {
    const nombre = h.name.toLowerCase();
    if (!mapa.has(nombre)) mapa.set(nombre, h.value);
  }
  return mapa;
}

/** Valida que la cuenta sea de Google Workspace de la empresa. Lanza ErrorDominio si no. */
export function validarCuentaGmail(direccion: string, empresa: EmpresaCorreo): void {
  const dominio = (direccion.split('@')[1] ?? '').toLowerCase();
  if (DOMINIOS_PERSONALES.includes(dominio)) {
    throw new ErrorDominio('Nexo no conecta cuentas personales de Gmail: solo cuentas de Google Workspace de la empresa.');
  }
  if (dominio !== empresa.dominio) {
    throw new ErrorDominio(`La cuenta ${direccion} no es del dominio de ${empresa.nombre} (${empresa.dominio}).`);
  }
}

export function enlaceGmail(direccionBuzon: string, id: string): string {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(direccionBuzon)}#all/${id}`;
}

export function normalizarMensajeGmail(m: MensajeGmail, direccionBuzon: string, empresa: EmpresaCorreo): MensajeCorreo {
  const h = encabezados(m.payload);
  const leer = (nombre: string) => decodificarEncabezado(h.get(nombre) ?? '');
  const sinCuerpo: MensajeCorreo = {
    idEnBuzon: m.id,
    hiloEnBuzon: m.threadId,
    idInternet: idsDe(h.get('message-id') ?? '')[0] ?? `<gmail-${m.id}@${empresa.dominio}>`,
    respondeA: [...new Set([...idsDe(h.get('in-reply-to') ?? ''), ...idsDe(h.get('references') ?? '')])],
    asunto: leer('subject'),
    de: direccionesDe(leer('from'))[0] ?? { nombre: '', correo: '' },
    para: direccionesDe(leer('to')).map((d) => d.correo),
    cc: direccionesDe(leer('cc')).map((d) => d.correo),
    enviado: new Date(Number(m.internalDate)),
    texto: '',
    enlace: enlaceGmail(direccionBuzon, m.id),
    automatico: h.has('list-unsubscribe') || m.labelIds.some((l) => CATEGORIAS_AUTOMATICAS.includes(l)),
  };
  // Privacidad: solo se abre el cuerpo de lo laboral.
  if (clasificarMensaje(sinCuerpo, empresa) !== 'laboral') return sinCuerpo;
  return { ...sinCuerpo, texto: sinCitas(textoDeCuerpoGmail(m.payload)) };
}

export function normalizarBuzonGmail(buzon: BuzonGmail, empresa: EmpresaCorreo): Buzon {
  validarCuentaGmail(buzon.direccion, empresa);
  return {
    personaId: buzon.personaId,
    direccion: buzon.direccion,
    proveedor: 'gmail',
    mensajes: buzon.mensajes
      .filter((m) => !m.labelIds.some((l) => ETIQUETAS_IGNORADAS.includes(l)))
      .map((m) => normalizarMensajeGmail(m, buzon.direccion, empresa)),
  };
}
