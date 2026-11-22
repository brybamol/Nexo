// Ingesta de correo: reglas 12–14b de docs/08 sobre hechos ya extraídos (correo/lectura.ts). Puro y determinista.
//
// Cada hecho se aplica sobre la instantánea que dejaron los anteriores de la misma lectura (aplicarEnMemoria), así
// que una entrega encuentra el trabajo que su pedido creó un momento antes y los ids (M01, S…) no chocan.
// Los hechos de un mismo pedido se unen por `compromisoClave` a través de las evidencias guardadas (también las de los
// descartados: un descartado nunca vuelve por una fuente nueva). Si un mensaje ya procesado aparece en un buzón nuevo,
// no se vuelve a aplicar: se suman sus buzones y enlaces a la evidencia que ya existe (y puede confirmar por fuentes).
import {
  BONO_ACTOR_ESPERA,
  HORAS_LABORALES_NORMAL,
  MAX_CITA_EVIDENCIA,
  MIN_URGENTE,
  UMBRAL_ENLACE_ESPERA,
  UMBRAL_MISMO_HECHO,
} from '@/dominio/constantes';
import { formatearColones, formatearFecha } from '@/dominio/formato';
import { sumarHorasLaborales, sumarMinutos } from '@/dominio/tiempo';
import { normalizar, similitud } from '@/dominio/texto';
import {
  ErrorDominio,
  type EvidenciaNueva,
  type MensajeLeidoNuevo,
  type Persona,
  type ResultadoLectura,
  type ResumenLectura,
  type TipoEvidencia,
  type Trabajo,
} from '@/dominio/tipos';
import type { CopiaLeida, EmpresaCorreo, EsperaCorreo, HechoCorreo, PedidoCorreo } from '@/correo/tipos';
import { efectosActualizacion } from '@/motor/actualizacion';
import { cubreDosPartes } from '@/motor/confianza';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { AvisosPorPersona, efectosEntrega, efectosRecepcion } from '@/motor/entregas';
import { nombrador, siguienteIdSeguimiento, siguienteIdTrabajoCorreo, siguienteNumeroTrabajo, type Instantanea } from '@/motor/instantanea';
import { efectosBloqueo } from '@/motor/propagacion';
import { seguimientoDePropuesta } from '@/motor/propuestas';

// ─── Piezas puras (exportadas por contrato) ───────────────────────────────────

const abierto = (t: Trabajo) => t.estado !== 'resuelto' && t.confirmacion !== 'descartado';
const compararIds = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

/**
 * Regla 12b: id del trabajo (no resuelto, no descartado, de cualquier origen) que es el mismo hecho que el pedido:
 * mismo responsable, sin solicitante o con el mismo solicitante, y similitud de títulos ≥ UMBRAL_MISMO_HECHO. Gana el
 * de mayor similitud; empate: id menor. null si no hay.
 */
export function mismoHecho(inst: Instantanea, p: PedidoCorreo): string | null {
  if (p.responsableId === null) return null;
  let mejor: { id: string; s: number } | null = null;
  for (const t of inst.trabajos) {
    if (!abierto(t) || t.responsableId !== p.responsableId) continue;
    if (t.solicitadoPorId !== null && t.solicitadoPorId !== p.solicitanteId) continue;
    const s = similitud(p.titulo, t.titulo);
    if (s < UMBRAL_MISMO_HECHO) continue;
    if (!mejor || s > mejor.s || (s === mejor.s && compararIds(t.id, mejor.id) < 0)) mejor = { id: t.id, s };
  }
  return mejor?.id ?? null;
}

/**
 * ¿Nombra `actor` al responsable? Por su primer nombre, su área o una palabra de su rol (el departamento del correo
 * sale de ahí: «Contabilidad y facturación», «Ejecutiva de ventas», «Encargada de compras», «Bodega»…).
 */
function actorCoincide(actor: string, p: Persona | undefined): boolean {
  if (!p) return false;
  const a = normalizar(actor);
  if (a === '') return false;
  if (a === normalizar(p.nombre.split(' ')[0] ?? '') || a === normalizar(p.area)) return true;
  return ` ${normalizar(p.rol)} `.includes(` ${a} `);
}

/**
 * Regla 13: trabajo al que corresponde lo que se espera, o null. Candidatos: los no resueltos ni descartados, menos
 * `propioId`. Puntaje = similitud(objeto, título) + BONO_ACTOR_ESPERA si el actor nombra al responsable; mínimo
 * UMBRAL_ENLACE_ESPERA; empate: id menor. Objeto pronominal («me los envíe»): el trabajo más reciente del actor nombrado
 * que pidió quien espera.
 */
export function enlazarEspera(inst: Instantanea, espera: EsperaCorreo, propioId: string | null): string | null {
  const personas = new Map(inst.personas.map((p) => [p.id, p]));
  const candidatos = inst.trabajos.filter((t) => abierto(t) && t.id !== propioId);
  const nombra = (t: Trabajo) => espera.actor !== null && actorCoincide(espera.actor, personas.get(t.responsableId));

  if (normalizar(espera.objeto) === '') {
    if (espera.quienEsperaId === null) return null;
    const delActor = candidatos
      .filter((t) => nombra(t) && t.solicitadoPorId === espera.quienEsperaId)
      .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime() || compararIds(a.id, b.id));
    return delActor.at(-1)?.id ?? null;
  }

  let mejor: { id: string; puntaje: number } | null = null;
  for (const t of candidatos) {
    const puntaje = similitud(espera.objeto, t.titulo) + (nombra(t) ? BONO_ACTOR_ESPERA : 0);
    if (!mejor || puntaje > mejor.puntaje || (puntaje === mejor.puntaje && compararIds(t.id, mejor.id) < 0)) mejor = { id: t.id, puntaje };
  }
  return mejor && mejor.puntaje >= UMBRAL_ENLACE_ESPERA ? mejor.id : null;
}

/**
 * Regla 12 (proyecto): el del trabajo enlazado; si no, por el asunto normalizado, en este orden: «pedido» o un número
 * 1041–1047 → P4; «trigal» → P2; «colina» → P1; «repuesto», «inventario» o «reorden» → P3; si no, OD.
 */
export function proyectoDelPedido(inst: Instantanea, p: PedidoCorreo, enlazadoId: string | null): string {
  const enlazado = enlazadoId ? inst.trabajos.find((t) => t.id === enlazadoId) : undefined;
  if (enlazado) return enlazado.proyectoId;
  const asunto = normalizar(p.asunto);
  if (asunto.includes('pedido') || /\b104[1-7]\b/.test(asunto)) return 'P4';
  if (asunto.includes('trigal')) return 'P2';
  if (asunto.includes('colina')) return 'P1';
  if (['repuesto', 'inventario', 'reorden'].some((w) => asunto.includes(w))) return 'P3';
  return 'OD';
}

// ─── Plan de una lectura ──────────────────────────────────────────────────────

/** Qué produjo un hecho: su resultado de lectura y los trabajos que tocó. */
interface Salida {
  resultado: ResultadoLectura;
  trabajoIds: string[];
}

/** Prioridad para el resultado de un mensaje con varios hechos. */
const PRIORIDAD: ResultadoLectura[] = [
  'creo',
  'propuso',
  'reconocio',
  'entrega',
  'recepcion',
  'espera',
  'aceptacion',
  'insistencia',
  'sin_plazo',
  'sin_parte',
  'descartado',
];

const recortar = (s: string) => (s.length <= MAX_CITA_EVIDENCIA ? s : `${s.slice(0, MAX_CITA_EVIDENCIA - 1)}…`);
const unicos = <T>(xs: T[]) => [...new Set(xs)];

class Lectura {
  efectos: Efecto[] = [];
  inst: Instantanea;
  resumen: ResumenLectura = { leidos: 0, laborales: 0, descartados: 0, creados: [], propuestos: [], reconocidos: [], entregas: [], sinConvertir: 0 };

  constructor(inicial: Instantanea) {
    this.inst = inicial;
  }

  /** Agrega efectos y deja la instantánea al día para el siguiente hecho. */
  emitir(es: Efecto[]): void {
    this.efectos.push(...es);
    this.inst = aplicarEnMemoria(this.inst, es);
  }

  nombre(personaId: string | null): string {
    if (!personaId) return 'alguien de fuera de la empresa';
    return this.inst.personas.find((p) => p.id === personaId)?.nombre ?? 'alguien de la empresa';
  }

  nombres(ids: string[]): string {
    const ns = ids.map((id) => this.nombre(id));
    return ns.length <= 1 ? (ns[0] ?? '') : `${ns.slice(0, -1).join(', ')} y ${ns.at(-1)}`;
  }

  origen(h: HechoCorreo): string {
    return `Correo de ${this.nombre(h.autorId)} (${formatearFecha(h.en)}): «${h.cita}»`;
  }

  evidencia(h: HechoCorreo, trabajoId: string, tipo: TipoEvidencia): EvidenciaNueva {
    return {
      trabajoId,
      tipo,
      fuente: 'correo',
      compromisoClave: h.compromisoClave,
      mensajeId: h.mensajeId,
      buzones: [...h.buzones],
      enlaces: { ...h.enlaces },
      autorId: h.autorId,
      en: h.en,
      cita: recortar(h.cita),
    };
  }

  /** Trabajo (vivo o descartado) de un pedido ya leído, por su clave. */
  trabajoDeClave(clave: string): { id: string; descartado: boolean } | null {
    const e = this.inst.evidencias.find((x) => x.compromisoClave === clave && x.tipo === 'pedido');
    if (!e) return null;
    return { id: e.trabajoId, descartado: !this.inst.trabajos.some((t) => t.id === e.trabajoId) };
  }

  /** Regla 14b: un propuesto cuyas evidencias `pedido` cubren las dos partes pasa a confirmado (sin revisión, sin aviso). */
  confirmarPorFuentes(trabajoId: string): void {
    const t = this.inst.trabajos.find((x) => x.id === trabajoId);
    if (!t || t.confirmacion !== 'propuesto' || !cubreDosPartes(t, this.inst.evidencias)) return;
    const cierre: Efecto[] = this.inst.seguimientos
      .filter((s) => s.trabajoId === t.id && s.tipo === 'propuesta' && s.estado === 'pendiente')
      .map((s) => ({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } }));
    this.emitir([{ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { confirmacion: 'confirmado', confirmadoPorId: null }, actorId: null }, ...cierre]);
    this.avisarEntregaConfirmada(t.id);
  }

  /**
   * Regla 20 al quedar confirmado por fuentes un trabajo que ya traía una entrega: se trata como cualquier entrega de
   * un confirmado (aviso a quien lo pidió y seguimiento `recepcion`, nivel 0 = ese aviso), salvo que quien lo pidió sea
   * el responsable o ya haya un seguimiento `recepcion` pendiente.
   */
  avisarEntregaConfirmada(trabajoId: string): void {
    const x = this.inst.trabajos.find((t) => t.id === trabajoId);
    if (!x || x.confirmacion !== 'confirmado' || x.estado === 'resuelto' || !x.entrega) return;
    const solicitanteId = x.solicitadoPorId;
    if (solicitanteId === null || solicitanteId === x.responsableId) return;
    if (this.inst.seguimientos.some((s) => s.trabajoId === x.id && s.tipo === 'recepcion' && s.estado === 'pendiente')) return;

    const ahora = this.inst.ahora;
    const cita = nombrador(this.inst).cita(x.id);
    const responsable = this.nombre(x.entrega.porId);
    const detalle = [x.entrega.nota ? `«${x.entrega.nota}»` : null, x.entrega.enlace ? `enlace: ${x.entrega.enlace}` : null].filter(Boolean).join(' · ');
    const avisos = new AvisosPorPersona(x.entrega.porId, this.inst);
    avisos.agregar(
      solicitanteId,
      [x.id],
      `${responsable} entregó ${cita}${detalle ? `: ${detalle}` : ''}. ¿Lo recibiste? Confírmalo en Nexo o, si no está bien, rechaza la entrega con el motivo.`,
      `${responsable} entregó «${x.titulo}». ¿Lo recibiste?`,
    );
    const hechoOrigen = `${responsable} entregó ${cita} y el pedido quedó confirmado: lo vieron los dos buzones`;
    this.emitir(avisos.efectos(ahora, hechoOrigen, `${responsable} entregó «${x.titulo}». ¿Lo recibiste?`));
    this.emitir([
      {
        tipo: 'crear_seguimiento',
        seguimiento: {
          id: siguienteIdSeguimiento(this.inst),
          trabajoId: x.id,
          plazoReferencia: ahora,
          nivel: 0,
          destinatarioId: solicitanteId,
          urgente: x.urgente,
          proximoEn: x.urgente ? sumarMinutos(ahora, MIN_URGENTE) : sumarHorasLaborales(ahora, HORAS_LABORALES_NORMAL),
          estado: 'pendiente',
          iniciadoEn: ahora,
          escaladosA: [],
          tipo: 'recepcion',
        },
      },
    ]);
  }

  /** El mismo mensaje en un buzón nuevo: suma buzones y enlaces a la evidencia que ya existe. Su trabajo, o null. */
  sumarBuzones(h: HechoCorreo, tipo: TipoEvidencia): string | null {
    const previa = this.inst.evidencias.find((e) => e.mensajeId === h.mensajeId && e.tipo === tipo && e.compromisoClave === h.compromisoClave);
    if (!previa) return null;
    const buzones = unicos([...previa.buzones, ...h.buzones]);
    const enlaces = { ...previa.enlaces, ...h.enlaces };
    if (buzones.length !== previa.buzones.length || Object.keys(enlaces).length !== Object.keys(previa.enlaces).length) {
      this.emitir([{ tipo: 'actualizar_evidencia', evidenciaId: previa.id, cambios: { buzones, enlaces } }]);
    }
    return previa.trabajoId;
  }

  // ── Pedido (regla 12) ──

  pedido(p: PedidoCorreo): Salida {
    // Ya leído en otro buzón: misma evidencia, más buzones.
    const conocido = this.trabajoDeClave(p.compromisoClave);
    if (conocido) {
      if (conocido.descartado) return { resultado: 'descartado', trabajoIds: [conocido.id] };
      this.sumarBuzones(p, 'pedido');
      this.confirmarPorFuentes(conocido.id);
      return { resultado: 'reconocio', trabajoIds: [conocido.id] };
    }

    // (a) Sin parte interna conectada.
    const partes = unicos([p.solicitanteId, p.responsableId].filter((x): x is string => x !== null));
    if (p.responsableId === null || !partes.some((x) => p.buzones.includes(x))) return { resultado: 'sin_parte', trabajoIds: [] };

    // (b) Mismo hecho que un trabajo que ya existe.
    const mismo = mismoHecho(this.inst, p);
    if (mismo) {
      this.reconocer(p, mismo);
      return { resultado: 'reconocio', trabajoIds: [mismo] };
    }

    // (c) Sin plazo: no se inventa uno.
    if (p.plazo === null) {
      this.resumen.sinConvertir++;
      return { resultado: 'sin_plazo', trabajoIds: [] };
    }

    // (d) Nuevo.
    return this.crear(p, p.responsableId, p.plazo);
  }

  reconocer(p: PedidoCorreo, trabajoId: string): void {
    const cita = nombrador(this.inst).cita(trabajoId);
    this.emitir([
      { tipo: 'agregar_evidencia', evidencia: this.evidencia(p, trabajoId, 'pedido') },
      {
        tipo: 'accion',
        accion: {
          en: this.inst.ahora,
          tipo: 'reconocer_correo',
          motivo: `El correo de ${this.nombre(p.solicitanteId)} a ${this.nombre(p.responsableId)} es el mismo hecho que ${cita}: no se crea otro trabajo; el correo queda como evidencia.`,
          hechoOrigen: this.origen(p),
          trabajoIds: [trabajoId],
          decisionId: null,
          destinatarioId: null,
          capturaId: null,
        },
        aviso: null,
      },
    ]);
    if (p.espera) this.dependencia(p.espera, trabajoId);
    this.confirmarPorFuentes(trabajoId);
  }

  crear(p: PedidoCorreo, responsableId: string, plazo: Date): Salida {
    const enlazado = p.espera ? enlazarEspera(this.inst, p.espera, null) : null;
    const proyectoId = proyectoDelPedido(this.inst, p, enlazado);
    const id = siguienteIdTrabajoCorreo(this.inst);
    const solicitanteId = p.solicitanteId;
    const dosFuentes =
      solicitanteId !== null && solicitanteId !== responsableId && p.buzones.includes(solicitanteId) && p.buzones.includes(responsableId);
    // Dueño de la propuesta: la parte en cuyo buzón está (el solicitante primero).
    const dueno = dosFuentes ? null : ([solicitanteId, responsableId].find((x) => x !== null && p.buzones.includes(x)) ?? null);
    const trabajo: Trabajo = {
      id,
      proyectoId,
      numero: siguienteNumeroTrabajo(this.inst, proyectoId),
      titulo: p.titulo,
      responsableId,
      solicitadoPorId: solicitanteId,
      plazo,
      estado: 'abierto',
      urgente: false,
      conCostoProbable: p.monto !== null,
      bloqueadoPorId: null,
      motivoBloqueo: null,
      fechaSolucion: null,
      repuestoId: null,
      cantidadRepuesto: null,
      etiqueta: null,
      relacionados: [],
      origen: 'correo',
      capturaId: null,
      decisionId: null,
      creadoEn: this.inst.ahora,
      resueltoEn: null,
      confirmacion: dosFuentes ? 'confirmado' : 'propuesto',
      duenoPropuestaId: dueno,
      confirmadoPorId: null,
      entrega: null,
    };
    this.emitir([
      { tipo: 'crear_trabajo', trabajo, necesidades: [], actorId: null },
      { tipo: 'agregar_evidencia', evidencia: this.evidencia(p, id, 'pedido') },
    ]);

    const cita = nombrador(this.inst).cita(id);
    const costo = p.monto !== null ? ` Tiene costo (${formatearColones(p.monto)}): si implica una compra, pásalo por una decisión.` : '';
    const quien = `a cargo de ${this.nombre(responsableId)}, pedido por ${this.nombre(solicitanteId)}, plazo ${formatearFecha(plazo)}`;
    const motivo = dosFuentes
      ? `Nexo leyó el pedido en los buzones de ${this.nombres([solicitanteId, responsableId])} y creó ${cita}, ${quien}: lo vieron los dos buzones.${costo}`
      : `Nexo propone ${cita}, ${quien}: lo vio solo en el buzón de ${this.nombre(dueno)}. Solo ${this.nombre(dueno)} lo ve hasta que lo confirme.${costo}`;
    this.emitir([
      {
        tipo: 'accion',
        accion: {
          en: this.inst.ahora,
          tipo: dosFuentes ? 'crear_trabajo' : 'proponer_trabajo',
          motivo,
          hechoOrigen: this.origen(p),
          trabajoIds: [id],
          decisionId: null,
          destinatarioId: dueno,
          capturaId: null,
        },
        aviso: null,
      },
    ]);
    if (!dosFuentes) this.emitir(seguimientoDePropuesta(this.inst, id));
    if (p.espera) this.dependencia(p.espera, id, enlazado);

    if (dosFuentes) this.resumen.creados.push(id);
    else this.resumen.propuestos.push(id);
    return { resultado: dosFuentes ? 'creo' : 'propuso', trabajoIds: [id] };
  }

  /** Espera escrita al pedir: dependencia del trabajo `propioId` con lo enlazado (regla 13). */
  dependencia(espera: EsperaCorreo, propioId: string, enlazadoYa?: string | null): void {
    const enlazado = enlazadoYa !== undefined ? enlazadoYa : enlazarEspera(this.inst, espera, propioId);
    if (!enlazado) {
      this.notaSinEnlace(espera, propioId);
      return;
    }
    if (enlazado === propioId || this.inst.dependencias.some((d) => d.trabajoId === propioId && d.dependeDeId === enlazado)) return;
    this.emitir([{ tipo: 'crear_dependencia', dependencia: { trabajoId: propioId, dependeDeId: enlazado }, actorId: espera.quienEsperaId }]);
  }

  notaSinEnlace(espera: EsperaCorreo, trabajoId: string): void {
    this.emitir([{ tipo: 'agregar_nota', trabajoId, autorId: null, texto: `Espera «${espera.texto}»: no sé a qué trabajo corresponde.` }]);
  }

  // ── Lo que responde un mensaje sobre un pedido ya leído ──

  /** Trabajo vivo y no resuelto del pedido del hecho; null si no hay (pedido sin trabajo, descartado o resuelto). */
  vivo(h: HechoCorreo): Trabajo | null {
    const c = this.trabajoDeClave(h.compromisoClave);
    if (!c || c.descartado) return null;
    const t = this.inst.trabajos.find((x) => x.id === c.id);
    return t && t.estado !== 'resuelto' ? t : null;
  }

  /** Sustituye en los efectos de R4 los datos del mensaje: evidencia (mensaje, buzones, enlaces, envío, cita) y entrega.en. */
  conDatosDelMensaje(es: Efecto[], h: HechoCorreo, trabajoId: string): Efecto[] {
    return es.map((e) => {
      if (e.tipo === 'agregar_evidencia' && e.evidencia.trabajoId === trabajoId && (e.evidencia.tipo === 'entrega' || e.evidencia.tipo === 'recepcion')) {
        return { ...e, evidencia: this.evidencia(h, trabajoId, e.evidencia.tipo) };
      }
      if (e.tipo === 'actualizar_trabajo' && e.trabajoId === trabajoId && e.cambios.entrega) {
        return { ...e, cambios: { ...e.cambios, entrega: { ...e.cambios.entrega, en: h.en } } };
      }
      return e;
    });
  }

  /** Intenta efectos de R4; si la regla no lo permite, deja solo la evidencia. */
  intentar(calcular: () => Efecto[], h: HechoCorreo, t: Trabajo, tipo: TipoEvidencia): void {
    let es: Efecto[];
    try {
      es = this.conDatosDelMensaje(calcular(), h, t.id);
    } catch (e) {
      if (!(e instanceof ErrorDominio)) throw e;
      es = [];
    }
    if (!es.some((e) => e.tipo === 'agregar_evidencia' && e.evidencia.trabajoId === t.id && e.evidencia.tipo === tipo)) {
      es.push({ tipo: 'agregar_evidencia', evidencia: this.evidencia(h, t.id, tipo) });
    }
    this.emitir(es);
  }

  respuesta(h: Exclude<HechoCorreo, PedidoCorreo>): Salida | null {
    const yaVisto = this.sumarBuzones(h, h.tipo);
    if (yaVisto) return { resultado: h.tipo, trabajoIds: [yaVisto] };
    const t = this.vivo(h);
    if (!t) return null;
    const autor = h.autorId;

    switch (h.tipo) {
      case 'entrega': {
        if (!autor) return null;
        const conOtro = t.solicitadoPorId !== null && t.solicitadoPorId !== t.responsableId;
        this.intentar(
          () =>
            conOtro
              ? efectosEntrega(this.inst, t.id, autor, { nota: h.cita, enlace: null, fuente: 'correo' })
              : efectosActualizacion(
                  this.inst,
                  { tipo: 'actualizacion', trabajoId: t.id, nuevoEstado: 'resuelto', nota: null, hayProblema: false, reprogramar: [], notasRelacionadas: [] },
                  autor,
                  { texto: h.cita, fuente: 'correo' },
                ),
          h,
          t,
          'entrega',
        );
        // Solo cuenta como entrega si la regla 19 la dejó pasar (si no, queda la evidencia y nada más).
        const despues = this.inst.trabajos.find((x) => x.id === t.id);
        if (despues && (despues.entrega !== null || despues.estado === 'resuelto')) this.resumen.entregas.push(t.id);
        return { resultado: 'entrega', trabajoIds: [t.id] };
      }
      case 'recepcion': {
        if (!autor) return null;
        this.intentar(() => efectosRecepcion(this.inst, t.id, autor, h.cita, 'correo'), h, t, 'recepcion');
        return { resultado: 'recepcion', trabajoIds: [t.id] };
      }
      case 'aceptacion': {
        const es: Efecto[] =
          autor && t.estado === 'abierto'
            ? efectosActualizacion(
                this.inst,
                { tipo: 'actualizacion', trabajoId: t.id, nuevoEstado: 'en_curso', nota: null, hayProblema: false, reprogramar: [], notasRelacionadas: [] },
                autor,
              )
            : [];
        this.emitir([...es, { tipo: 'agregar_evidencia', evidencia: this.evidencia(h, t.id, 'aceptacion') }]);
        return { resultado: 'aceptacion', trabajoIds: [t.id] };
      }
      case 'insistencia': {
        this.emitir([{ tipo: 'agregar_evidencia', evidencia: this.evidencia(h, t.id, 'insistencia') }]);
        return { resultado: 'insistencia', trabajoIds: [t.id] };
      }
      case 'espera': {
        const espera: EsperaCorreo = { clase: h.clase, texto: h.texto, actor: h.actor, objeto: h.objeto, quienEsperaId: h.quienEsperaId };
        this.emitir([{ tipo: 'agregar_evidencia', evidencia: this.evidencia(h, t.id, 'espera') }]);
        if (h.clase === 'dependencia') {
          this.dependencia(espera, t.id);
          return { resultado: 'espera', trabajoIds: [t.id] };
        }
        const enlazado = enlazarEspera(this.inst, espera, t.id);
        if (!enlazado) {
          this.notaSinEnlace(espera, t.id);
          return { resultado: 'espera', trabajoIds: [t.id] };
        }
        this.emitir(
          efectosBloqueo(this.inst, {
            trabajoBloqueadoId: t.id,
            bloqueanteId: enlazado,
            motivo: espera.texto,
            repuestoFaltanteId: null,
            autorId: autor ?? t.responsableId,
            descripcion: this.origen(h),
          }),
        );
        return { resultado: 'espera', trabajoIds: [t.id, enlazado] };
      }
    }
  }
}

/**
 * Plan de una lectura: los efectos (trabajos M01…, evidencias, dependencias, bloqueos, entregas, recepciones,
 * acciones `leer_correo`/`proponer_trabajo`/`reconocer_correo`/`crear_trabajo`, seguimientos `propuesta`,
 * `registrar_mensajes`) y su resumen. `yaLeidos`: claves `${personaId}|${idInternet}` (db/instantanea.ts claveLeido).
 * Solo procesa las copias que no están en `yaLeidos`; con 0 copias nuevas devuelve `{ efectos: [], resumen }` vacío.
 *
 * Un hecho se procesa si su mensaje tiene al menos una copia nueva. Cada copia nueva va a `registrar_mensajes` con el
 * resultado de su mensaje (lo personal y los boletines: `descartado`, sin abrirse). Al final, una acción `leer_correo`.
 */
export function planLectura(
  inst: Instantanea,
  e: { hechos: HechoCorreo[]; copias: CopiaLeida[]; yaLeidos: Set<string>; empresa: EmpresaCorreo },
): { efectos: Efecto[]; resumen: ResumenLectura } {
  const vistas = new Set<string>();
  const nuevas = e.copias.filter((c) => {
    const clave = `${c.personaId}|${c.idInternet}`;
    if (e.yaLeidos.has(clave) || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
  const l = new Lectura(inst);
  if (nuevas.length === 0) return { efectos: [], resumen: l.resumen };

  const conCopiaNueva = new Set(nuevas.filter((c) => c.clase === 'laboral').map((c) => c.idInternet));
  const porMensaje = new Map<string, Salida[]>();
  for (const h of e.hechos) {
    if (!conCopiaNueva.has(h.mensajeId)) continue;
    const salida = h.tipo === 'pedido' ? l.pedido(h) : l.respuesta(h);
    if (salida) porMensaje.set(h.mensajeId, [...(porMensaje.get(h.mensajeId) ?? []), salida]);
    if (salida?.resultado === 'reconocio' && !l.resumen.reconocidos.includes(salida.trabajoIds[0]!)) l.resumen.reconocidos.push(salida.trabajoIds[0]!);
  }

  const resultadoDe = (idInternet: string): Salida => {
    const salidas = porMensaje.get(idInternet) ?? [];
    const resultado = PRIORIDAD.find((r) => salidas.some((s) => s.resultado === r)) ?? 'sin_compromisos';
    return { resultado, trabajoIds: unicos(salidas.flatMap((s) => s.trabajoIds)) };
  };
  const mensajes: MensajeLeidoNuevo[] = nuevas.map((c) => {
    const s = c.clase === 'laboral' ? resultadoDe(c.idInternet) : { resultado: 'descartado' as const, trabajoIds: [] };
    return { personaId: c.personaId, idInternet: c.idInternet, enviado: c.enviado, leidoEn: inst.ahora, clase: c.clase, resultado: s.resultado, trabajoIds: s.trabajoIds };
  });

  const r = l.resumen;
  r.leidos = nuevas.length;
  r.laborales = conCopiaNueva.size;
  r.descartados = nuevas.filter((c) => c.clase !== 'laboral').length;

  const personas = unicos(nuevas.map((c) => c.personaId));
  const partes = [
    `${r.laborales} ${r.laborales === 1 ? 'mensaje' : 'mensajes'} de trabajo`,
    `${r.descartados} ${r.descartados === 1 ? 'personal o boletín descartado' : 'personales o boletines descartados'} sin abrir`,
  ];
  const hizo = [
    r.creados.length > 0 ? `creó ${r.creados.length}` : null,
    r.propuestos.length > 0 ? `propuso ${r.propuestos.length}` : null,
    r.reconocidos.length > 0 ? `reconoció ${r.reconocidos.length} que ya existían` : null,
    r.entregas.length > 0 ? `registró ${r.entregas.length} ${r.entregas.length === 1 ? 'entrega' : 'entregas'}` : null,
    r.sinConvertir > 0 ? `dejó ${r.sinConvertir} sin convertir por no tener plazo` : null,
  ].filter((x): x is string => x !== null);
  const motivo = `Nexo leyó ${r.leidos} ${r.leidos === 1 ? 'copia nueva' : 'copias nuevas'} en ${personas.length} ${personas.length === 1 ? 'buzón' : 'buzones'}: ${partes.join(' y ')}.${hizo.length > 0 ? ` De lo leído, ${hizo.join(', ')}.` : ' No había pedidos nuevos.'}`;

  l.efectos.push(
    { tipo: 'registrar_mensajes', mensajes },
    {
      tipo: 'accion',
      accion: {
        en: inst.ahora,
        tipo: 'leer_correo',
        motivo,
        hechoOrigen: `Lectura de los buzones conectados de ${l.nombres(personas)}`,
        trabajoIds: unicos([...r.creados, ...r.propuestos, ...r.reconocidos, ...r.entregas]),
        decisionId: null,
        destinatarioId: null,
        capturaId: null,
      },
      aviso: null,
    },
  );
  void e.empresa;
  return { efectos: l.efectos, resumen: r };
}
