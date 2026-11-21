// Correos de ejemplo de Grupo Altavista (docs/06 §8 y §13). Cada mensaje se escribe una vez y se copia al buzón
// de cada persona interna que lo tiene: en «Enviados» de quien lo manda y en la bandeja de cada destinatario.
//
// Se generan en dos formas reales:
// - Gmail (API de Gmail, `format=full`): cada copia tiene su propio `id` y su propio `threadId`; el cuerpo va en
//   partes MIME en base64url, los asuntos con tildes van codificados (RFC 2047) y las respuestas citan el correo
//   anterior. Es la forma de la demo.
// - Outlook (Microsoft Graph): cada copia tiene su propio `id` y `webLink`.
// En las dos, el mismo correo comparte `Message-ID`: por eso Nexo tiene que unirlos.
import { normalizarBuzonGmail, codificarBase64Url } from '@/correo/fuentes/gmail';
import { normalizarBuzonGraph } from '@/correo/fuentes/outlook';
import type { Buzon, BuzonGmail, BuzonGraph, DireccionGraph, EmpresaCorreo, MensajeGmail, MensajeGraph, ParteGmail, Proveedor } from '@/correo/tipos';
import { enCR } from '@/dominio/tiempo';
import { EMPRESA_ALTAVISTA } from './empresa';

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
  'mama.fernandez@correo-personal.com': 'Mamá',
  'noreply@boletin-juridico.com': 'Boletín Jurídico',
  'ofertas@licencias-software.com': 'Licencias Software',
};

const A = 'ana.rodriguez@altavista.cr';
const L = 'luis.mendez@altavista.cr';
const C = 'carla.fernandez@altavista.cr';
const P = 'pablo.rojas@altavista.cr';
const S = 'sergio.vargas@altavista.cr';
const V = 'valeria.castro@altavista.cr';
const R = 'roberto.solano@altavista.cr';

export const MENSAJES_BASE: MensajeBase[] = [
  // H1 · Revisión contrato TransLog
  {
    clave: 'h1-m1', hilo: 'H1', asunto: 'Revisión contrato TransLog', de: A, para: [L], cc: [R], fecha: '2026-11-18', hora: '09:12',
    texto: 'Hola Luis. ¿Puedes revisar el contrato de TransLog? Necesitamos firmarlo antes del 4 de diciembre para arrancar operaciones el 7. Gracias, Ana.',
  },
  {
    clave: 'h1-m2', hilo: 'H1', asunto: 'RE: Revisión contrato TransLog', de: L, para: [A], cc: [R], fecha: '2026-11-20', hora: '15:40',
    texto: 'Ana, lo reviso en cuanto Finanzas confirme la garantía bancaria de cumplimiento. Sin eso no puedo aprobar la cláusula 8. Saludos, Luis.',
  },
  // H2 · Garantía de cumplimiento TransLog
  {
    clave: 'h2-m1', hilo: 'H2', asunto: 'Garantía de cumplimiento TransLog', de: A, para: [C], fecha: '2026-11-17', hora: '11:00',
    texto: 'Carla, para el contrato con TransLog el proveedor pide una garantía. ¿Puedes gestionar la garantía bancaria de cumplimiento con el banco? El monto es ₡25.000.000 y la necesitamos antes del 30 de noviembre. Gracias.',
  },
  {
    clave: 'h2-m2', hilo: 'H2', asunto: 'RE: Garantía de cumplimiento TransLog', de: C, para: [A], fecha: '2026-11-24', hora: '17:20',
    texto: 'Ana, la gestiono con el banco, pero primero me piden los estados financieros auditados 2025. La solicito en cuanto Pablo me los envíe.',
  },
  // H3 · Estados financieros auditados 2025
  {
    clave: 'h3-m1', hilo: 'H3', asunto: 'Estados financieros auditados 2025', de: C, para: [P], fecha: '2026-11-24', hora: '17:05',
    texto: 'Pablo, el banco nos pide documentación para una garantía. ¿Puedes enviarme los estados financieros auditados 2025 firmados? Los necesito mañana antes de las 10:00.',
  },
  // H4 · Alta de TransLog en el ERP (escrito desde un cliente que solo manda HTML)
  {
    clave: 'h4-m1', hilo: 'H4', asunto: 'Alta de TransLog en el ERP', de: A, para: [V], fecha: '2026-11-20', hora: '08:45', soloHtml: true,
    texto: 'Valeria, ¿puedes dar de alta a TransLog como proveedor en el ERP? Lo necesitamos antes del 7 de diciembre. Se puede hacer cuando firmemos el contrato con TransLog.',
  },
  // H5 · Presupuesto campaña Navidad
  {
    clave: 'h5-m1', hilo: 'H5', asunto: 'Presupuesto campaña Navidad', de: S, para: [C], fecha: '2026-11-16', hora: '08:30',
    texto: 'Carla, ¿puedes aprobar el presupuesto de la campaña de Navidad por ₡18.000.000? Lo necesito antes del viernes 20 de noviembre para reservar la pauta.',
  },
  {
    clave: 'h5-m2', hilo: 'H5', asunto: 'RE: Presupuesto campaña Navidad', de: S, para: [C], cc: [R], fecha: '2026-11-21', hora: '09:00',
    texto: 'Carla, seguimos sin la aprobación del presupuesto. Si no reservamos la pauta el lunes perdemos los espacios.',
  },
  // H6 · Bases legales promoción Navidad
  {
    clave: 'h6-m1', hilo: 'H6', asunto: 'Bases legales promoción Navidad', de: S, para: [L], fecha: '2026-11-17', hora: '14:00',
    texto: 'Luis, ¿puedes revisar las bases legales de la promoción de Navidad? Las necesitamos antes del 24 de noviembre.',
  },
  {
    clave: 'h6-m2', hilo: 'H6', asunto: 'RE: Bases legales promoción Navidad', de: L, para: [S], fecha: '2026-11-21', hora: '11:30',
    texto: 'Sergio, te adjunto las bases revisadas con los cambios aprobados. Quedan listas para publicar.',
  },
  // H7 · Landing campaña Navidad
  {
    clave: 'h7-m1', hilo: 'H7', asunto: 'Landing campaña Navidad', de: V, para: [S], fecha: '2026-11-19', hora: '10:00',
    texto: 'Sergio, para publicar la landing de la campaña: ¿puedes enviarme los textos finales de la campaña de Navidad? Los necesito antes del 26 de noviembre.',
  },
  {
    clave: 'h7-m2', hilo: 'H7', asunto: 'RE: Landing campaña Navidad', de: S, para: [V], fecha: '2026-11-24', hora: '12:00',
    texto: 'Valeria, los textos finales te los paso cuando Finanzas apruebe el presupuesto de la campaña, porque dependen de la pauta.',
  },
  // Ruido: no debe producir nada (docs/06 §8)
  {
    clave: 'r-personal-ana', hilo: 'R1', asunto: 'Estado de cuenta de su tarjeta', de: 'alertas@banco-personal.com', para: [A], fecha: '2026-11-22', hora: '06:00',
    texto: 'Estimada clienta, ya está disponible el estado de cuenta de su tarjeta terminada en 4821.',
  },
  {
    clave: 'r-personal-carla', hilo: 'R2', asunto: 'Almuerzo del domingo', de: 'mama.fernandez@correo-personal.com', para: [C], fecha: '2026-11-23', hora: '19:30',
    texto: 'Hija, ¿puedes traer el postre el domingo? Te espero a las 12.',
  },
  {
    clave: 'r-boletin-luis', hilo: 'R3', asunto: 'Boletín jurídico semanal', de: 'noreply@boletin-juridico.com', para: [L], fecha: '2026-11-23', hora: '07:00',
    texto: 'Las reformas más importantes de la semana. ¿Puedes leer este resumen en cinco minutos?',
    cabeceras: [{ name: 'List-Unsubscribe', value: '<mailto:baja@boletin-juridico.com>' }],
    categoria: 'CATEGORY_UPDATES',
  },
  {
    clave: 'r-boletin-valeria', hilo: 'R4', asunto: 'Ofertas de licencias de fin de año', de: 'ofertas@licencias-software.com', para: [V], fecha: '2026-11-24', hora: '08:00',
    texto: 'Renueve sus licencias antes del 31 de diciembre con 20 % de descuento.',
    cabeceras: [{ name: 'List-Unsubscribe', value: '<https://licencias-software.com/baja>' }],
    categoria: 'CATEGORY_PROMOTIONS',
  },
  {
    clave: 'r-cumple', hilo: 'R5', asunto: 'Cumpleaños de Pablo', de: S, para: [A, L, C, P, V, R], fecha: '2026-11-23', hora: '10:00',
    texto: 'Equipo, el viernes celebramos el cumpleaños de Pablo a las 4 p. m. en la sala del piso 3. ¡Los esperamos!',
  },
  {
    clave: 'r-borrador-roberto', hilo: 'R6', asunto: 'Flujo de caja de diciembre', de: R, para: [C], fecha: '2026-11-24', hora: '18:00', borrador: true,
    texto: 'Carla, ¿puedes enviarme el flujo de caja de diciembre antes del viernes?',
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
export function construirBuzonesGraph(empresa: EmpresaCorreo = EMPRESA_ALTAVISTA, mensajes: MensajeBase[] = MENSAJES_BASE): BuzonGraph[] {
  return empresa.personas.map((persona) => ({
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
export function construirBuzonesGmail(empresa: EmpresaCorreo = EMPRESA_ALTAVISTA, mensajes: MensajeBase[] = MENSAJES_BASE): BuzonGmail[] {
  return empresa.personas.map((persona) => {
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

/** Buzones normalizados de Grupo Altavista. La demo usa Gmail (Google Workspace). */
export function construirBuzonesEjemplo(proveedor: Proveedor = 'gmail', empresa: EmpresaCorreo = EMPRESA_ALTAVISTA): Buzon[] {
  if (proveedor === 'outlook') return construirBuzonesGraph(empresa).map((b) => normalizarBuzonGraph(b, empresa));
  return construirBuzonesGmail(empresa).map((b) => normalizarBuzonGmail(b, empresa));
}
