// Extracción local por hilo (docs/06 §7). Determinista y deliberadamente simple: sirve para los correos de ejemplo.
// En producción la hará Claude con un esquema zod; esto quedará como respaldo. Nada se inventa: sin señal de
// plazo, el plazo es null («no lo sé»).
import { enCR, partesCR } from '@/dominio/tiempo';
import type { Compromiso, EmpresaCorreo, Espera, EsperaCorreo, Evidencia, HechoCorreo, Hilo, MensajeUnido, PersonaCorreo } from '@/correo/tipos';
import { asuntoBase } from '@/correo/union';
import { MAX_CITA_EVIDENCIA } from '@/dominio/constantes';

const MAX_CITA = MAX_CITA_EVIDENCIA;

const MESES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

const RE_PEDIDO = /¿\s*(?:puedes|podr[ií]as|me ayudas a)\s+([^?]+)\?/i;
const RE_ESPERA = /\b(?:en cuanto|cuando)\s+([^,.;]+)/i;
const RE_ENTREGA = /\b(te adjunto|adjunto|te env[ií]o|quedan? list[oa]s?|ya est[áa] list[oa]|ya qued[óo])\b/i;
const RE_ACEPTA = /\b(l[oa] reviso|l[oa] gestiono|me encargo|l[oa] veo|de acuerdo)\b/i;
const RE_INSISTE = /\b(seguimos sin|sigo esperando|c[óo]mo vamos con|alg[úu]n avance)\b/i;
const RE_MONTO = /₡\s?(\d{1,3}(?:\.\d{3})+|\d+)/;
const RE_FECHA = new RegExp(
  `antes del?\\s+(?:(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(MESES).join('|')})`,
  'i',
);
const RE_MANANA = /ma[ñn]ana\s+antes\s+de\s+las\s+(\d{1,2}):(\d{2})/i;
const RE_HOY = /\bhoy\s+antes\s+de\s+las\s+(\d{1,2}):(\d{2})/i;
const CLITICOS = new Set(['me', 'nos', 'te', 'se', 'le', 'les', 'lo', 'la', 'los', 'las']);

export function oraciones(texto: string): string[] {
  return texto
    .split(/(?<=[.?!])\s+(?=[¿¡\p{Lu}])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cita(oracion: string): string {
  return oracion.length > MAX_CITA ? `${oracion.slice(0, MAX_CITA - 1).trimEnd()}…` : oracion;
}

/** «enviarme los estados…» → «Enviar los estados…»; corta montos y plazos que no son parte del qué. */
export function tituloDesdePedido(frase: string): string {
  let t = frase.trim();
  t = t.split(/\s+(?:por\s+₡|antes\s+del?\s)/i)[0] ?? t;
  t = t.replace(/^(\p{L}+?(?:ar|er|ir))(me|nos|te|le|les)\b/u, '$1');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function diaSiguiente(fecha: string): string {
  return partesCR(new Date(enCR(fecha, '12:00').getTime() + 24 * 60 * 60 * 1000)).fecha;
}

/** Plazo escrito en el texto, en hora de Costa Rica; sin hora → 17:00. null si no hay señal. */
export function plazoDesdeTexto(texto: string, enviado: Date): Date | null {
  const fechaEnvio = partesCR(enviado).fecha;
  const manana = RE_MANANA.exec(texto);
  if (manana) {
    const hora = `${manana[1]!.padStart(2, '0')}:${manana[2]}`;
    return enCR(diaSiguiente(fechaEnvio), hora);
  }
  const hoy = RE_HOY.exec(texto);
  if (hoy) return enCR(fechaEnvio, `${hoy[1]!.padStart(2, '0')}:${hoy[2]}`);
  const f = RE_FECHA.exec(texto);
  if (f) {
    const dia = f[1]!.padStart(2, '0');
    const mes = MESES[f[2]!.toLowerCase()]!;
    const [anioEnvio, mesEnvio] = fechaEnvio.split('-');
    const anio = Number(mes) < Number(mesEnvio) ? Number(anioEnvio) + 1 : Number(anioEnvio);
    return enCR(`${anio}-${mes}-${dia}`, '17:00');
  }
  return null;
}

export function montoDesdeTexto(texto: string): number | null {
  const m = RE_MONTO.exec(texto);
  return m ? Number(m[1]!.replaceAll('.', '')) : null;
}

/** «Finanzas confirme la garantía» → actor Finanzas, objeto «la garantía». «Pablo me los envíe» → objeto vacío. */
export function esperaDesdeTexto(texto: string, tipo: Espera['tipo']): Espera | null {
  const m = RE_ESPERA.exec(texto);
  if (!m) return null;
  const clausula = m[1]!.trim();
  const palabras = clausula.split(/\s+/);
  let i = 0;
  let actor: string | null = null;
  if (palabras[0] && /^\p{Lu}/u.test(palabras[0])) {
    actor = palabras[0];
    i = 1;
  }
  while (i < palabras.length && CLITICOS.has(palabras[i]!.toLowerCase())) i++;
  i++; // el verbo
  return { tipo, texto: clausula, actor, objeto: palabras.slice(i).join(' '), compromisoId: null };
}

function idCompromiso(m: MensajeUnido): string {
  const local = m.internetMessageId.replace(/^</, '').split('@')[0] ?? m.internetMessageId;
  return `c-${local.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}`;
}

function oracionCon(texto: string, re: RegExp): string {
  return oraciones(texto).find((o) => re.test(o)) ?? oraciones(texto)[0] ?? texto;
}

function evidencia(m: MensajeUnido, oracion: string, autor: PersonaCorreo | undefined): Evidencia {
  return { cita: cita(oracion), autorId: autor?.id ?? null, en: m.enviado, mensajeId: m.internetMessageId, enlaces: m.enlaces };
}

/** Recorre el hilo en orden y devuelve sus compromisos, aún sin enlazar con otros hilos ni agrupar en proyectos. */
export function extraerDeHilo(hilo: Hilo, empresa: EmpresaCorreo): Compromiso[] {
  const porCorreo = new Map(empresa.personas.map((p) => [p.correo.toLowerCase(), p]));
  const compromisos: Compromiso[] = [];

  for (const m of hilo.mensajes) {
    const autor = porCorreo.get(m.deCorreo);
    const abiertos = compromisos.filter((c) => c.estado !== 'resuelto');

    // 1. Respuesta de quien debe hacerlo: espera, entrega o aceptación.
    const propio = autor ? [...abiertos].reverse().find((c) => c.responsableId === autor.id) : undefined;
    if (propio) {
      const espera = esperaDesdeTexto(m.texto, 'bloqueo');
      if (espera) {
        propio.estado = 'bloqueado';
        propio.esperaA = espera;
        propio.evidencias.push(evidencia(m, oracionCon(m.texto, RE_ESPERA), autor));
      } else if (RE_ENTREGA.test(m.texto)) {
        propio.estado = 'resuelto';
        propio.resueltoEn = m.enviado;
        propio.esperaA = null;
        propio.evidencias.push(evidencia(m, oracionCon(m.texto, RE_ENTREGA), autor));
      } else if (RE_ACEPTA.test(m.texto)) {
        propio.estado = 'en_curso';
        propio.evidencias.push(evidencia(m, oracionCon(m.texto, RE_ACEPTA), autor));
      }
    }

    // 2. Insistencia de quien lo pidió.
    const pedidoPorAutor = autor ? [...abiertos].reverse().find((c) => c.solicitanteId === autor.id) : undefined;
    if (pedidoPorAutor && RE_INSISTE.test(m.texto)) {
      pedidoPorAutor.insistencias++;
      pedidoPorAutor.evidencias.push(evidencia(m, oracionCon(m.texto, RE_INSISTE), autor));
    }

    // 3. Pedido nuevo a un destinatario directo de la empresa.
    const pedido = RE_PEDIDO.exec(m.texto);
    const destinatario = m.paraCorreos.map((c) => porCorreo.get(c)).find((p) => p !== undefined);
    if (pedido && destinatario && destinatario.id !== autor?.id) {
      compromisos.push({
        id: idCompromiso(m),
        titulo: tituloDesdePedido(pedido[1]!),
        solicitanteId: autor?.id ?? null,
        responsableId: destinatario.id,
        plazo: plazoDesdeTexto(m.texto, m.enviado),
        monto: montoDesdeTexto(m.texto),
        estado: 'abierto',
        resueltoEn: null,
        esperaA: esperaDesdeTexto(m.texto, 'dependencia'),
        insistencias: 0,
        evidencias: [evidencia(m, oracionCon(m.texto, RE_PEDIDO), autor)],
        hiloId: hilo.id,
        asunto: hilo.asunto,
        proyecto: '',
        revision: { tipo: 'propuesto', porId: null, en: null },
      });
    }
  }
  return compromisos;
}

// ── Reformas v2 (docs/08 regla 11): hechos por mensaje (sustituye a extraerDeHilo, que retira R9). ──────────

const RE_RECIBIDO = /\b(recibido|recibidas?|recibidos|ya l[oa]s? recib[ií]|l[oa]s? recib[ií])\b/i;

/**
 * «… en cuanto Paola envíe la cotización» → `{ texto: 'en cuanto Paola envíe la cotización', actor: 'Paola', objeto:
 * 'la cotización' }`. Objeto pronominal («en cuanto Diego me los envíe») → objeto ''.
 */
export function esperaCorreoDesdeTexto(texto: string, clase: EsperaCorreo['clase'], quienEsperaId: string | null): EsperaCorreo | null {
  const m = RE_ESPERA.exec(texto);
  const base = esperaDesdeTexto(texto, clase);
  if (!m || !base) return null;
  return { clase, texto: m[0].trim(), actor: base.actor, objeto: base.objeto, quienEsperaId };
}

/** 'c-h3-m1' desde '<h3-m1@friodelvalle.cr>': une los hechos de un mismo pedido entre lecturas. */
export function claveCompromiso(idInternet: string): string {
  const local = idInternet.replace(/^</, '').split('@')[0] ?? idInternet;
  return `c-${local.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}`;
}

interface PedidoDelHilo {
  clave: string;
  solicitanteId: string | null;
  responsableId: string | null;
  entregado: boolean;
}

/**
 * Hechos de un hilo, en el orden de sus mensajes. Dentro de un mensaje: primero el `pedido` nuevo (con su espera
 * `dependencia` dentro: no sale como hecho aparte) y después lo que el mensaje responde sobre los pedidos anteriores del
 * hilo: `aceptacion`, `espera` (`bloqueo`, del responsable) o `entrega` del responsable (una sola, en ese orden de
 * prioridad: espera > entrega > aceptación), y `recepcion` (tras una entrega) e `insistencia` del solicitante.
 * Sin señal de plazo, `plazo = null`. Un pedido a nadie de la empresa sale con `responsableId = null` (regla 12a).
 */
export function extraerHechos(hilo: Hilo, empresa: EmpresaCorreo): HechoCorreo[] {
  const porCorreo = new Map(empresa.personas.map((p) => [p.correo.toLowerCase(), p]));
  const pedidos: PedidoDelHilo[] = [];
  const hechos: HechoCorreo[] = [];

  for (const m of hilo.mensajes) {
    const autor = porCorreo.get(m.deCorreo.toLowerCase());
    const autorId = autor?.id ?? null;
    const base = (clave: string, re: RegExp) => ({
      compromisoClave: clave,
      mensajeId: m.internetMessageId,
      autorId,
      en: m.enviado,
      cita: cita(oracionCon(m.texto, re)),
      enlaces: { ...m.enlaces },
      buzones: Object.keys(m.enlaces),
    });
    const anteriores = [...pedidos];
    const delMensaje: HechoCorreo[] = [];

    // 1. Pedido nuevo: «¿puedes …?» a un destinatario directo.
    const pedido = RE_PEDIDO.exec(m.texto);
    const destinatario = m.paraCorreos.map((c) => porCorreo.get(c.toLowerCase())).find((p) => p !== undefined);
    if (pedido && (!destinatario || destinatario.id !== autorId)) {
      const clave = claveCompromiso(m.internetMessageId);
      delMensaje.push({
        tipo: 'pedido',
        ...base(clave, RE_PEDIDO),
        asunto: asuntoBase(m.asunto),
        titulo: tituloDesdePedido(pedido[1]!),
        solicitanteId: autorId,
        responsableId: destinatario?.id ?? null,
        plazo: plazoDesdeTexto(m.texto, m.enviado),
        monto: montoDesdeTexto(m.texto),
        espera: esperaCorreoDesdeTexto(m.texto, 'dependencia', autorId),
      });
      pedidos.push({ clave, solicitanteId: autorId, responsableId: destinatario?.id ?? null, entregado: false });
    }

    if (autorId) {
      // 2. Respuesta de quien debe hacerlo (sobre el último pedido del hilo a su cargo sin entregar).
      const propio = [...anteriores].reverse().find((p) => p.responsableId === autorId && !p.entregado);
      if (propio) {
        const espera = esperaCorreoDesdeTexto(m.texto, 'bloqueo', autorId);
        if (espera) delMensaje.push({ tipo: 'espera', ...base(propio.clave, RE_ESPERA), ...espera });
        else if (RE_ENTREGA.test(m.texto)) {
          delMensaje.push({ tipo: 'entrega', ...base(propio.clave, RE_ENTREGA) });
          propio.entregado = true;
        } else if (RE_ACEPTA.test(m.texto)) delMensaje.push({ tipo: 'aceptacion', ...base(propio.clave, RE_ACEPTA) });
      }
      // 3. De quien lo pidió: «recibido» tras una entrega, o insistencia.
      const pedidoPorAutor = [...anteriores].reverse().find((p) => p.solicitanteId === autorId);
      if (pedidoPorAutor) {
        if (pedidoPorAutor.entregado && RE_RECIBIDO.test(m.texto)) {
          delMensaje.push({ tipo: 'recepcion', ...base(pedidoPorAutor.clave, RE_RECIBIDO) });
        } else if (RE_INSISTE.test(m.texto)) {
          delMensaje.push({ tipo: 'insistencia', ...base(pedidoPorAutor.clave, RE_INSISTE) });
        }
      }
    }
    hechos.push(...delMensaje);
  }
  return hechos;
}
