// Unión de buzones (docs/06 §4.2–4.3): filtra por privacidad, quita duplicados entre buzones y agrupa en hilos.
// Recibe buzones ya normalizados (Gmail u Outlook, ver src/correo/fuentes).
import { clasificarMensaje } from '@/correo/privacidad';
import type { Buzon, ConteoBuzon, EmpresaCorreo, Hilo, MensajeUnido } from '@/correo/tipos';

const PREFIJOS_RESPUESTA = /^\s*((re|rv|fw|fwd|reenviar)\s*:\s*)+/i;

export function asuntoBase(asunto: string): string {
  return asunto.replace(PREFIJOS_RESPUESTA, '').trim();
}

export interface ResultadoUnion {
  hilos: Hilo[];
  conteos: ConteoBuzon[];
}

/** Conjuntos disjuntos sobre claves de texto. */
class Grupos {
  private padre = new Map<string, string>();
  raiz(x: string): string {
    let r = x;
    while (this.padre.has(r) && this.padre.get(r) !== r) r = this.padre.get(r)!;
    this.padre.set(x, r);
    return r;
  }
  unir(a: string, b: string): void {
    const ra = this.raiz(a);
    const rb = this.raiz(b);
    if (ra !== rb) this.padre.set(rb, ra);
  }
}

function parteLocal(idInternet: string): string {
  return (idInternet.replace(/^</, '').split('@')[0] ?? idInternet).replace(/[^A-Za-z0-9_-]/g, '-');
}

/**
 * Solo los mensajes enviados hasta `ahora` existen para Nexo. Un mismo `Message-ID` en varios buzones es un
 * solo mensaje; cada buzón aporta su enlace.
 *
 * Hilos: el identificador de hilo del proveedor solo vale dentro de un buzón (en Gmail cada persona tiene su
 * `threadId`), así que dos mensajes van al mismo hilo si uno responde al otro (`In-Reply-To`/`References`) o si
 * comparten hilo dentro de algún buzón. El hilo se nombra por su primer mensaje y se ordenan por él.
 */
export function unirBuzones(buzones: Buzon[], empresa: EmpresaCorreo, ahora: Date): ResultadoUnion {
  const mensajes = new Map<string, MensajeUnido>();
  const conteos: ConteoBuzon[] = [];
  const grupos = new Grupos();

  for (const buzon of buzones) {
    const conteo: ConteoBuzon = { personaId: buzon.personaId, proveedor: buzon.proveedor, leidos: 0, laborales: 0, personales: 0, boletines: 0 };
    for (const m of buzon.mensajes) {
      if (m.enviado.getTime() > ahora.getTime()) continue;
      conteo.leidos++;
      const clase = clasificarMensaje(m, empresa);
      if (clase === 'personal') {
        conteo.personales++;
        continue;
      }
      if (clase === 'boletin') {
        conteo.boletines++;
        continue;
      }
      conteo.laborales++;
      grupos.unir(`buzon:${buzon.personaId}:${m.hiloEnBuzon}`, m.idInternet);
      for (const anterior of m.respondeA) grupos.unir(anterior, m.idInternet);
      const existente = mensajes.get(m.idInternet);
      if (existente) {
        existente.enlaces[buzon.personaId] = m.enlace;
        continue;
      }
      mensajes.set(m.idInternet, {
        internetMessageId: m.idInternet,
        hiloId: '',
        asunto: m.asunto,
        deCorreo: m.de.correo,
        paraCorreos: m.para,
        ccCorreos: m.cc,
        enviado: m.enviado,
        texto: m.texto,
        enlaces: { [buzon.personaId]: m.enlace },
      });
    }
    conteos.push(conteo);
  }

  const porGrupo = new Map<string, MensajeUnido[]>();
  for (const m of mensajes.values()) {
    const clave = grupos.raiz(m.internetMessageId);
    const lista = porGrupo.get(clave) ?? [];
    lista.push(m);
    porGrupo.set(clave, lista);
  }
  const hilos: Hilo[] = [...porGrupo.values()].map((ms) => {
    ms.sort((a, b) => a.enviado.getTime() - b.enviado.getTime() || a.internetMessageId.localeCompare(b.internetMessageId));
    const id = `hilo-${parteLocal(ms[0]?.internetMessageId ?? '')}`;
    for (const m of ms) m.hiloId = id;
    return { id, asunto: asuntoBase(ms[0]?.asunto ?? ''), mensajes: ms };
  });
  hilos.sort((a, b) => (a.mensajes[0]?.enviado.getTime() ?? 0) - (b.mensajes[0]?.enviado.getTime() ?? 0));
  return { hilos, conteos };
}
