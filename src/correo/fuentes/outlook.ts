// Adaptador de Outlook (docs/06 §4): lleva un buzón de Microsoft Graph a `Buzon`.
import { clasificarMensaje } from '@/correo/privacidad';
import type { Buzon, BuzonGraph, EmpresaCorreo, MensajeCorreo, MensajeGraph } from '@/correo/tipos';
import { idsDe, sinCitas, textoDeHtml } from './comun';

export function normalizarMensajeGraph(m: MensajeGraph, empresa: EmpresaCorreo): MensajeCorreo {
  const cabecera = (nombre: string) => (m.internetMessageHeaders ?? []).find((h) => h.name.toLowerCase() === nombre)?.value ?? '';
  const sinCuerpo: MensajeCorreo = {
    idEnBuzon: m.id,
    hiloEnBuzon: m.conversationId,
    idInternet: m.internetMessageId,
    respondeA: [...new Set([...idsDe(cabecera('in-reply-to')), ...idsDe(cabecera('references'))])],
    asunto: m.subject,
    de: { nombre: m.from.emailAddress.name, correo: m.from.emailAddress.address.toLowerCase() },
    para: m.toRecipients.map((d) => d.emailAddress.address.toLowerCase()),
    cc: m.ccRecipients.map((d) => d.emailAddress.address.toLowerCase()),
    enviado: new Date(m.sentDateTime),
    texto: '',
    enlace: m.webLink,
    automatico: cabecera('list-unsubscribe') !== '',
  };
  // Privacidad: solo se usa el cuerpo de lo laboral.
  if (clasificarMensaje(sinCuerpo, empresa) !== 'laboral') return sinCuerpo;
  const texto = m.body.contentType === 'html' ? textoDeHtml(m.body.content) : m.body.content;
  return { ...sinCuerpo, texto: sinCitas(texto) };
}

export function normalizarBuzonGraph(buzon: BuzonGraph, empresa: EmpresaCorreo): Buzon {
  return {
    personaId: buzon.personaId,
    direccion: buzon.direccion,
    proveedor: 'outlook',
    mensajes: buzon.mensajes.map((m) => normalizarMensajeGraph(m, empresa)),
  };
}
