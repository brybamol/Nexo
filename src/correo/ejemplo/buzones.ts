// Correos de ejemplo de Frío del Valle (docs/08 §5). Cada mensaje se escribe una vez y se copia al buzón de cada
// persona interna que lo tiene: en «Enviados» de quien lo manda y en la bandeja de cada destinatario.
//
// Se generan en dos formas reales:
// - Gmail (API de Gmail, `format=full`): cada copia tiene su propio `id` y su propio `threadId`; el cuerpo va en
//   partes MIME en base64url, los asuntos con tildes van codificados (RFC 2047) y las respuestas citan el correo
//   anterior. Es la forma de la demo.
// - Outlook (Microsoft Graph): cada copia tiene su propio `id` y `webLink`.
// En las dos, el mismo correo comparte `Message-ID`: por eso Nexo tiene que unirlos.
//
// Solo hay buzones conectados para 8 de las 12 personas (`BUZONES_DEMO`): los mensajes de Diego, José, Daniela y
// Mario existen, pero Nexo solo los ve cuando están en el buzón de alguien conectado.
import { normalizarBuzonGmail, codificarBase64Url } from '@/correo/fuentes/gmail';
import { normalizarBuzonGraph } from '@/correo/fuentes/outlook';
import type { Buzon, BuzonGmail, BuzonGraph, DireccionGraph, EmpresaCorreo, MensajeGmail, MensajeGraph, ParteGmail, Proveedor } from '@/correo/tipos';
import { enCR } from '@/dominio/tiempo';
import { EMPRESA_FRIO_DEL_VALLE } from './empresa';

export interface MensajeBase {
  clave: string;
  hilo: string;
  asunto: string;
  de: string;
  para: string[];
  cc?: string[];
  fecha: string;
  hora: string;
  texto: string;
  cabeceras?: { name: string; value: string }[];
  /** Categoría de Gmail en la bandeja de quien lo recibe (por defecto, Principal). */
  categoria?: string;
  /** Borrador sin enviar: solo existe en el buzón de quien lo escribe y Nexo no lo lee. */
  borrador?: boolean;
  /** Cuerpo solo en HTML (sin parte de texto plano). */
  soloHtml?: boolean;
}

const NOMBRES_EXTERNOS: Record<string, string> = {
  'alertas@banco-personal.com': 'Banco Personal',
  'mama.navarro@correo-personal.com': 'Mamá',
  'ofertas@frioindustrial.com': 'Frío Industrial Ofertas',
  'noreply@boletin-tributario.cr': 'Boletín Tributario',
};

const MARCELA = 'marcela.solis@friodelvalle.cr';
const ANDRES = 'andres.vargas@friodelvalle.cr';
const RICARDO = 'ricardo.brenes@friodelvalle.cr';
const PAOLA = 'paola.herrera@friodelvalle.cr';
const SOFIA = 'sofia.navarro@friodelvalle.cr';
const KARLA = 'karla.jimenez@friodelvalle.cr';
const LUCIA = 'lucia.mora@friodelvalle.cr';
const DIEGO = 'diego.rojas@friodelvalle.cr';
const ESTEBAN = 'esteban.castro@friodelvalle.cr';
const JOSE = 'jose.alfaro@friodelvalle.cr';
const DANIELA = 'daniela.quesada@friodelvalle.cr';
const MARIO = 'mario.chaves@friodelvalle.cr';

/** Buzones conectados en la demo (todos Gmail): lo que la semilla inserta en la tabla `buzones` (docs/08 §2.5). */
export const BUZONES_DEMO: readonly { personaId: string; direccion: string; proveedor: Proveedor }[] = [
  { personaId: 'marcela-solis', direccion: MARCELA, proveedor: 'gmail' },
  { personaId: 'andres-vargas', direccion: ANDRES, proveedor: 'gmail' },
  { personaId: 'ricardo-brenes', direccion: RICARDO, proveedor: 'gmail' },
  { personaId: 'paola-herrera', direccion: PAOLA, proveedor: 'gmail' },
  { personaId: 'sofia-navarro', direccion: SOFIA, proveedor: 'gmail' },
  { personaId: 'karla-jimenez', direccion: KARLA, proveedor: 'gmail' },
  { personaId: 'lucia-mora', direccion: LUCIA, proveedor: 'gmail' },
  { personaId: 'esteban-castro', direccion: ESTEBAN, proveedor: 'gmail' },
];

const IDS_CONECTADOS: readonly string[] = BUZONES_DEMO.map((b) => b.personaId);

export const MENSAJES_BASE: MensajeBase[] = [
  // H1 · Pago anticipado pedido 1047
  {
    clave: 'h1-m1', hilo: 'H1', asunto: 'Pago anticipado pedido 1047', de: ANDRES, para: [RICARDO], cc: [PAOLA], fecha: '2026-11-23', hora: '09:00',
    texto: 'Ricardo, ¿puedes confirmar el pago anticipado del pedido 1047 de La Colina? Lo necesitamos antes del 26 de noviembre para despachar las vitrinas.',
  },
  // H2 · Cotización cámara fría Hotel Mirador (escrito desde un cliente que solo manda HTML)
  {
    clave: 'h2-m1', hilo: 'H2', asunto: 'Cotización cámara fría Hotel Mirador', de: ANDRES, para: [PAOLA], fecha: '2026-11-24', hora: '15:00', soloHtml: true,
    texto: 'Paola, ¿puedes enviar la cotización de la cámara fría al Hotel Mirador? La necesitan mañana antes de las 12:00.',
  },
  // H3 · Guías de entrega pedidos 1041 y 1042 (Diego no tiene buzón conectado: Nexo ve el hilo por Ricardo)
  {
    clave: 'h3-m1', hilo: 'H3', asunto: 'Guías de entrega pedidos 1041 y 1042', de: RICARDO, para: [DIEGO], fecha: '2026-11-23', hora: '15:00',
    texto: 'Diego, ¿puedes enviarme las guías de entrega firmadas de los pedidos 1041 y 1042? Las necesito antes del 27 de noviembre para facturar.',
  },
  {
    clave: 'h3-m2', hilo: 'H3', asunto: 'RE: Guías de entrega pedidos 1041 y 1042', de: DIEGO, para: [RICARDO], fecha: '2026-11-24', hora: '16:30',
    texto: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.',
  },
  // H4 · Fotos mantenimiento Trigal (Daniela no tiene buzón conectado: Nexo lo ve por Esteban)
  {
    clave: 'h4-m1', hilo: 'H4', asunto: 'Fotos mantenimiento Trigal Heredia y Alajuela', de: ESTEBAN, para: [DANIELA], fecha: '2026-11-24', hora: '17:00',
    texto: 'Daniela, ¿puedes enviarme las fotos del mantenimiento de Heredia y Alajuela? Las necesito antes del 27 de noviembre para el informe de Trigal.',
  },
  // H5 · Factura proforma Hotel Mirador: llega durante la demo (mié 25, 8:20)
  {
    clave: 'h5-m1', hilo: 'H5', asunto: 'Factura proforma Hotel Mirador', de: ANDRES, para: [RICARDO], fecha: '2026-11-25', hora: '08:20',
    texto: 'Ricardo, ¿puedes emitir la factura proforma de la cámara fría del Hotel Mirador? La necesito antes del 27 de noviembre; se puede hacer en cuanto Paola envíe la cotización.',
  },
  // H6 · Reorden de repuestos críticos
  {
    clave: 'h6-m1', hilo: 'H6', asunto: 'Reorden de repuestos críticos', de: LUCIA, para: [KARLA], fecha: '2026-11-24', hora: '10:00',
    texto: 'Karla, ¿puedes cotizar el reorden con dos proveedores? Lo necesito antes del 27 de noviembre para definir la compra.',
  },
  // H7 · Reprogramar entrega 1043 Don Beto (sin plazo: Nexo no inventa uno)
  {
    clave: 'h7-m1', hilo: 'H7', asunto: 'Reprogramar entrega 1043 Don Beto', de: DIEGO, para: [SOFIA], fecha: '2026-11-24', hora: '16:00',
    texto: 'Sofía, ¿puedes reprogramar la entrega 1043 con el cliente? Don Beto estaba cerrado el martes y los congeladores volvieron a bodega.',
  },
  // Ruido: no debe producir nada (docs/08 §5.3)
  {
    clave: 'r-personal-karla', hilo: 'R1', asunto: 'Estado de cuenta de su tarjeta', de: 'alertas@banco-personal.com', para: [KARLA], fecha: '2026-11-24', hora: '06:00',
    texto: 'Estimada clienta, ya está disponible el estado de cuenta de su tarjeta terminada en 4821.',
  },
  {
    clave: 'r-personal-sofia', hilo: 'R2', asunto: 'Almuerzo del domingo', de: 'mama.navarro@correo-personal.com', para: [SOFIA], fecha: '2026-11-23', hora: '19:30',
    texto: 'Hija, ¿puedes traer el postre el domingo? Te espero a las 12.',
  },
  {
    clave: 'r-boletin-lucia', hilo: 'R3', asunto: 'Ofertas de compresores de fin de mes', de: 'ofertas@frioindustrial.com', para: [LUCIA], fecha: '2026-11-24', hora: '08:00',
    texto: '¿Puedes aprovechar nuestras ofertas de compresores antes del 30 de noviembre? Hasta 20 % de descuento.',
    cabeceras: [{ name: 'List-Unsubscribe', value: '<https://frioindustrial.com/baja>' }],
    categoria: 'CATEGORY_PROMOTIONS',
  },
  {
    clave: 'r-boletin-ricardo', hilo: 'R4', asunto: 'Boletín tributario semanal', de: 'noreply@boletin-tributario.cr', para: [RICARDO], fecha: '2026-11-25', hora: '06:00',
    texto: 'Los cambios tributarios más importantes de la semana. ¿Puedes leer este resumen en cinco minutos?',
    cabeceras: [{ name: 'List-Unsubscribe', value: '<mailto:baja@boletin-tributario.cr>' }],
    categoria: 'CATEGORY_UPDATES',
  },
  {
    clave: 'r-cumple', hilo: 'R5', asunto: 'Cumpleaños de Diego', de: PAOLA, para: [MARCELA, ANDRES, RICARDO, SOFIA, KARLA, LUCIA, DIEGO, ESTEBAN, JOSE, DANIELA, MARIO], fecha: '2026-11-23', hora: '10:00',
    texto: 'Equipo, el viernes celebramos el cumpleaños de Diego a las 4 p. m. en la bodega. ¡Los esperamos!',
  },
  {
    clave: 'r-borrador-marcela', hilo: 'R6', asunto: 'Flujo de caja de diciembre', de: MARCELA, para: [RICARDO], fecha: '2026-11-24', hora: '18:00', borrador: true,
    texto: 'Ricardo, ¿puedes enviarme el flujo de caja de diciembre antes del viernes?',
  },
];


// ── Piezas comunes ─────────────────────────────────────────────────────────────────────────────────

function nombreDe(correo: string, empresa: EmpresaCorreo): string {
  return empresa.personas.find((p) => p.correo === correo)?.nombre ?? NOMBRES_EXTERNOS[correo] ?? correo;
}

function idInternet(m: MensajeBase): string {
  return `<${m.clave}@${m.de.split('@')[1] ?? 'externo'}>`;
}

function enviado(m: MensajeBase): Date {
  return enCR(m.fecha, m.hora);
}

/** El mensaje anterior del mismo hilo y todos los anteriores (para `In-Reply-To` y `References`). */
function anteriores(m: MensajeBase, todos: MensajeBase[]): MensajeBase[] {
  return todos
    .filter((x) => x.hilo === m.hilo && !x.borrador && enviado(x).getTime() < enviado(m).getTime())
    .sort((a, b) => enviado(a).getTime() - enviado(b).getTime());
}

function cabecerasDeRespuesta(m: MensajeBase, todos: MensajeBase[]): { name: string; value: string }[] {
  const previos = anteriores(m, todos);
  const ultimo = previos[previos.length - 1];
  if (!ultimo) return [];
  return [
    { name: 'In-Reply-To', value: idInternet(ultimo) },
    { name: 'References', value: previos.map(idInternet).join(' ') },
  ];
}

function copias(persona: string, mensajes: MensajeBase[]): MensajeBase[] {
  return mensajes.filter((m) => (m.borrador ? m.de === persona : m.de === persona || m.para.includes(persona) || (m.cc ?? []).includes(persona)));
}

// ── Outlook (Microsoft Graph) ──────────────────────────────────────────────────────────────────────

function direccionGraph(correo: string, empresa: EmpresaCorreo): DireccionGraph {
  return { emailAddress: { name: nombreDe(correo, empresa), address: correo } };
}

function citaOutlook(m: MensajeBase, todos: MensajeBase[], empresa: EmpresaCorreo): string {
  const previo = anteriores(m, todos).pop();
  if (!previo) return '';
  return `\n\n________________________________\nDe: ${nombreDe(previo.de, empresa)} <${previo.de}>\nEnviado: ${previo.fecha} ${previo.hora}\nAsunto: ${previo.asunto}\n\n${previo.texto}`;
}

/** Un buzón por persona de la empresa, como lo entregaría Microsoft Graph (`/me/messages`). */
export function construirBuzonesGraph(empresa: EmpresaCorreo = EMPRESA_FRIO_DEL_VALLE, mensajes: MensajeBase[] = MENSAJES_BASE, conectados: readonly string[] = IDS_CONECTADOS): BuzonGraph[] {
  return empresa.personas.filter((p) => conectados.includes(p.id)).map((persona) => ({
    personaId: persona.id,
    direccion: persona.correo,
    mensajes: copias(persona.correo, mensajes)
      .filter((m) => !m.borrador)
      .map((m): MensajeGraph => {
        const id = `AAMk-${persona.id}-${m.clave}`;
        const cabeceras = [...cabecerasDeRespuesta(m, mensajes), ...(m.cabeceras ?? [])];
        return {
          id,
          conversationId: `conv-${m.hilo}`,
          internetMessageId: idInternet(m),
          subject: m.asunto,
          from: direccionGraph(m.de, empresa),
          toRecipients: m.para.map((c) => direccionGraph(c, empresa)),
          ccRecipients: (m.cc ?? []).map((c) => direccionGraph(c, empresa)),
          sentDateTime: enviado(m).toISOString(),
          body: { contentType: 'text', content: m.texto + citaOutlook(m, mensajes, empresa) },
          webLink: `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(id)}&exvsurl=1&viewmodel=ReadMessageItem`,
          ...(cabeceras.length > 0 ? { internetMessageHeaders: cabeceras } : {}),
        };
      }),
  }));
}

// ── Gmail (API de Gmail) ───────────────────────────────────────────────────────────────────────────

/** Identificador de 16 dígitos hexadecimales, estable, con la forma de los de Gmail. */
function idGmail(semilla: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < semilla.length; i++) {
    const c = semilla.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return `18${(a >>> 4).toString(16).padStart(7, '0')}${b.toString(16).padStart(8, '0')}`.slice(0, 16);
}

/** Palabra codificada RFC 2047 si el texto tiene caracteres fuera de ASCII, como llegan los encabezados. */
function codificarPalabra(texto: string): string {
  if (/^[\x20-\x7e]*$/.test(texto)) return texto;
  let binario = '';
  for (const b of new TextEncoder().encode(texto)) binario += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binario)}?=`;
}

function direccionGmail(correo: string, empresa: EmpresaCorreo): string {
  return `${codificarPalabra(nombreDe(correo, empresa))} <${correo}>`;
}

function citaGmail(m: MensajeBase, todos: MensajeBase[], empresa: EmpresaCorreo): string {
  const previo = anteriores(m, todos).pop();
  if (!previo) return '';
  const lineas = previo.texto.split('\n').map((l) => `> ${l}`).join('\n');
  return `\n\nEl ${previo.fecha} a las ${previo.hora}, ${nombreDe(previo.de, empresa)} <${previo.de}> escribió:\n${lineas}`;
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cuerpoGmail(m: MensajeBase, texto: string): ParteGmail {
  const html = `<html><head><style>p{margin:0}</style></head><body><div dir="ltr"><p>${escaparHtml(texto).replace(/\n/g, '<br>').replace(', ', ',&nbsp;')}</p></div></body></html>`;
  const parteHtml: ParteGmail = { partId: m.soloHtml ? '' : '1', mimeType: 'text/html', filename: '', body: { size: html.length, data: codificarBase64Url(html) } };
  if (m.soloHtml) return parteHtml;
  return {
    partId: '',
    mimeType: 'multipart/alternative',
    filename: '',
    body: { size: 0 },
    parts: [{ partId: '0', mimeType: 'text/plain', filename: '', body: { size: texto.length, data: codificarBase64Url(texto) } }, parteHtml],
  };
}

function etiquetasGmail(m: MensajeBase, persona: string): string[] {
  if (m.borrador) return ['DRAFT'];
  const etiquetas: string[] = [];
  if (m.de === persona) etiquetas.push('SENT');
  if (m.para.includes(persona) || (m.cc ?? []).includes(persona)) etiquetas.push('INBOX', m.categoria ?? 'CATEGORY_PERSONAL');
  return etiquetas;
}

/** Un buzón por persona de la empresa, como lo entregaría la API de Gmail (`users.messages.get`, `format=full`). */
export function construirBuzonesGmail(empresa: EmpresaCorreo = EMPRESA_FRIO_DEL_VALLE, mensajes: MensajeBase[] = MENSAJES_BASE, conectados: readonly string[] = IDS_CONECTADOS): BuzonGmail[] {
  return empresa.personas.filter((p) => conectados.includes(p.id)).map((persona) => {
    const propios = copias(persona.correo, mensajes).sort((a, b) => enviado(a).getTime() - enviado(b).getTime());
    const primeroDelHilo = new Map<string, string>();
    return {
      personaId: persona.id,
      direccion: persona.correo,
      mensajes: propios.map((m, i): MensajeGmail => {
        const id = idGmail(`${persona.id}:${m.clave}`);
        // En Gmail el `threadId` es el `id` del primer mensaje del hilo en ese buzón.
        if (!primeroDelHilo.has(m.hilo)) primeroDelHilo.set(m.hilo, id);
        const texto = m.texto + citaGmail(m, mensajes, empresa);
        const headers = [
          { name: 'MIME-Version', value: '1.0' },
          { name: 'Date', value: enviado(m).toUTCString() },
          { name: 'Message-ID', value: idInternet(m) },
          ...cabecerasDeRespuesta(m, mensajes),
          { name: 'Subject', value: codificarPalabra(m.asunto) },
          { name: 'From', value: direccionGmail(m.de, empresa) },
          { name: 'To', value: m.para.map((c) => direccionGmail(c, empresa)).join(', ') },
          ...(m.cc && m.cc.length > 0 ? [{ name: 'Cc', value: m.cc.map((c) => direccionGmail(c, empresa)).join(', ') }] : []),
          ...(m.cabeceras ?? []),
          { name: 'Content-Type', value: m.soloHtml ? 'text/html; charset="UTF-8"' : 'multipart/alternative; boundary="000000000000nexo"' },
        ];
        return {
          id,
          threadId: primeroDelHilo.get(m.hilo) ?? id,
          labelIds: etiquetasGmail(m, persona.correo),
          snippet: m.texto.slice(0, 100),
          historyId: String(1000 + i),
          internalDate: String(enviado(m).getTime()),
          payload: { ...cuerpoGmail(m, texto), headers },
        };
      }),
    };
  });
}

// ── Lo que usa el resto del flujo ──────────────────────────────────────────────────────────────────

/** Buzones normalizados de Frío del Valle: solo los conectados (`BUZONES_DEMO`). La demo usa Gmail (Google Workspace). */
export function construirBuzonesEjemplo(proveedor: Proveedor = 'gmail', empresa: EmpresaCorreo = EMPRESA_FRIO_DEL_VALLE): Buzon[] {
  if (proveedor === 'outlook') return construirBuzonesGraph(empresa).map((b) => normalizarBuzonGraph(b, empresa));
  return construirBuzonesGmail(empresa).map((b) => normalizarBuzonGmail(b, empresa));
}
