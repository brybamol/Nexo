// Reglas simples cuando no hay frase guardada (§4.3 de docs/05). Tarea 2.1.
// Orden: pregunta → agradecimiento → terminación con seguimiento pendiente → trabajo nuevo SIN confirmar.
// Regla del producto: si no se puede interpretar con seguridad, se dice (no_es_trabajo con el motivo, o
// responsableSeguro=false para que Nexo pida confirmación); nunca se inventa un trabajo seguro.
import { referenciasEnTexto } from '@/dominio/nombres';
import { normalizar } from '@/dominio/texto';
import type { ContextoCaptura, Interpretacion } from '@/ia/interprete';

const PALABRAS_PREGUNTA = new Set(['como', 'que', 'cuantos', 'cuantas', 'cuanto', 'cuanta', 'cual', 'cuales', 'cuando', 'donde', 'quien', 'quienes']);

const PALABRAS_AGRADECIMIENTO = new Set([
  'gracias', 'muchas', 'mil', 'mucho', 'muy', 'a', 'todos', 'todas', 'por', 'todo', 'el', 'la', 'los', 'las', 'de', 'su', 'sus', 'les', 'te',
  'buen', 'buena', 'buenos', 'buenas', 'excelente', 'gran', 'trabajo', 'equipo', 'ayuda', 'apoyo', 'ayer', 'hoy', 'genial', 'bien', 'se',
  'agradece', 'agradezco', 'y', 'felicidades', 'felicitaciones', 'ok', 'vale', 'perfecto', 'compas', 'companeros', 'mae', 'maes',
]);

const INICIOS_TERMINACION = new Set(['listo', 'lista', 'hecho', 'hecha', 'terminado', 'terminada', 'resuelto', 'resuelta', 'ya']);

const PALABRAS_VACIAS = new Set([
  'ya', 'la', 'lo', 'las', 'los', 'el', 'un', 'una', 'de', 'del', 'al', 'en', 'se', 'me', 'que', 'y', 'a', 'listo', 'lista', 'hecho', 'hecha',
  'termine', 'envie', 'hice', 'mande', 'quedo', 'esta', 'estan', 'para', 'con', 'por',
]);

const palabras = (n: string) => n.split(' ').filter(Boolean);

// Frases habituales con las que un empleado solicita información por correo,
// aunque redacte el mensaje de forma cordial y omita los signos de interrogación.
const INICIOS_CONSULTA = [
  'me gustaria saber',
  'me gustaria conocer',
  'me gustaria consultar',
  'me gustaria preguntar',
  'quisiera saber',
  'quisiera conocer',
  'quisiera consultar',
  'quisiera preguntar',
  'quiero saber',
  'quiero conocer',
  'necesito saber',
  'necesito conocer',
  'necesito consultar',
  'podrias decirme',
  'puedes decirme',
  'me podrias indicar',
  'podrias indicarme',
  'quisiera informacion sobre',
  'necesito informacion sobre',
];

function esPregunta(texto: string, normal: string): boolean {
  const contieneInterrogativa = palabras(normal).some((p) => PALABRAS_PREGUNTA.has(p));
  const solicitaInformacion = INICIOS_CONSULTA.some((inicio) => normal.includes(inicio));

  // Las preguntas explícitas conservan su comportamiento; las fórmulas de
  // consulta también se reconocen sin ¿ ni ?, como sucede en correos reales.
  if (solicitaInformacion) return true;
  return /[¿?]/.test(texto) && contieneInterrogativa;
}

function esSoloAgradecimiento(normal: string): boolean {
  const ps = palabras(normal);
  const agradece = ps.some((p) => p === 'gracias' || p === 'agradezco' || p === 'agradece');
  return agradece && ps.length <= 10 && ps.every((p) => PALABRAS_AGRADECIMIENTO.has(p));
}

/** El único trabajo con seguimiento pendiente, o el que más comparte palabras con la frase si hay varios. */
function trabajoReferido(normal: string, ctx: ContextoCaptura): string | null {
  const pendientes = ctx.seguimientosPendientesDelAutor;
  if (pendientes.length === 1) return pendientes[0]!;
  if (pendientes.length === 0) return null;
  const significativas = new Set(palabras(normal).filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p)));
  let mejor: string | null = null;
  let mejorPuntaje = 0;
  let empate = false;
  for (const id of pendientes) {
    const t = ctx.trabajosAbiertos.find((x) => x.id === id);
    if (!t) continue;
    const comunes = palabras(normalizar(t.titulo)).filter((p) => significativas.has(p)).length;
    if (comunes > mejorPuntaje) {
      mejor = id;
      mejorPuntaje = comunes;
      empate = false;
    } else if (comunes === mejorPuntaje && comunes > 0) {
      empate = true;
    }
  }
  return mejorPuntaje > 0 && !empate ? mejor : null;
}

/**
 * El único trabajo abierto que la frase cita por su referencia visible («sigo con COLINA-4») o, por compatibilidad,
 * por su id interno («T04»). Varios o ninguno → null.
 */
function trabajoCitado(texto: string, normal: string, ctx: ContextoCaptura): string | null {
  const ids = new Set<string>();
  for (const ref of referenciasEnTexto(texto)) {
    const t = ctx.trabajosAbiertos.find((x) => x.referencia === ref);
    if (t) ids.add(t.id);
  }
  for (const p of palabras(normal)) {
    const t = /^t\d{2,}$/.test(p) ? ctx.trabajosAbiertos.find((x) => x.id === p.toUpperCase()) : undefined;
    if (t) ids.add(t.id);
  }
  return ids.size === 1 ? [...ids][0]! : null;
}

const RE_SIGUE = /\b(sigo|continuo|retomo|empece|empiezo|arranco|arranque|voy con|en curso)\b/;

function titulo(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ').replace(/[.!\s]+$/, '');
  const corto = limpio.length > 120 ? `${limpio.slice(0, 117)}...` : limpio;
  return corto.charAt(0).toUpperCase() + corto.slice(1);
}

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Interpreta fechas explícitas como «27 de noviembre de 2026 a las 17:00». */
function plazoExplicito(normal: string, ahora: string): { dia: string; hora?: string } | null {
  const m = normal.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?(?:\s+a\s+las\s+(\d{1,2})(?:(?::|\s+)(\d{2}))?)?\b/,
  );
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = MESES[m[2]!];
  const anio = Number(m[3] ?? ahora.slice(0, 4));
  if (!mes || !Number.isInteger(anio) || anio < 2000) return null;

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;

  if (m[4] === undefined) return { dia: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` };

  const hora = Number(m[4]);
  const minuto = Number(m[5] ?? '0');
  if (hora > 23 || minuto > 59) return null;

  return {
    dia: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    hora: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
  };
}

/** Reconoce actualizaciones dirigidas a un código de trabajo explícito. */
function actualizarTrabajoPorCodigo(normal: string, ctx: ContextoCaptura): Interpretacion | null {
  const solicitaCambio = /\b(actualizar|actualiza|actualicemos|modificar|modifica|cambiar|cambia|reprogramar|reprograma|mover|mueve)\b/.test(normal);
  if (!solicitaCambio) return null;

  const codigo = normal.match(/\b(t\d+)\b/)?.[1]?.toUpperCase();
  if (!codigo) return null;

  const trabajo = ctx.trabajosAbiertos.find((t) => t.id.toUpperCase() === codigo);
  if (!trabajo) {
    return { tipo: 'no_es_trabajo', motivo: `No encontré el trabajo ${codigo} entre los trabajos abiertos. No cambié nada.` };
  }

  const plazo = plazoExplicito(normal, ctx.ahora);
  if (!plazo) {
    return { tipo: 'no_es_trabajo', motivo: `Identifiqué el trabajo ${codigo}, pero no pude interpretar la nueva fecha. Indica el día y, si corresponde, la hora. No cambié nada.` };
  }

  return {
    tipo: 'actualizacion',
    trabajoId: trabajo.id,
    nuevoEstado: null,
    nota: null,
    hayProblema: false,
    reprogramar: [{ trabajoId: trabajo.id, plazo }],
    notasRelacionadas: [],
  };
}

const ALIAS_PROYECTOS: Record<string, string[]> = {
  P1: ['la colina'],
  P2: ['trigal'],
  P3: [],
  P4: [],
  OD: [],
};

/** Identifica proyectos mediante nombres completos o alias explícitos. */
function proyectoExplicito(
  normal: string,
  ctx: ContextoCaptura,
): string | null {
  const texto = ` ${normal} `;

  const coincidencias = ctx.proyectos.filter((proyecto) => {
    const nombre = normalizar(proyecto.nombre);
    const alias = ALIAS_PROYECTOS[proyecto.id] ?? [];

    return [nombre, ...alias].some((termino) => {
      const buscado = normalizar(termino);
      return buscado.length > 0 && texto.includes(` ${buscado} `);
    });
  });

  return coincidencias.length === 1
    ? coincidencias[0]!.id
    : null;
}

/** Solo confirma a una persona si el correo expresa una asignación inequívoca. */
function responsableAsignado(normal: string, ctx: ContextoCaptura): string | null {
  const marcadores = [
    'asignarlo a', 'asignarla a', 'asignar a', 'asignado a', 'asignada a',
    'responsable es', 'responsable sera', 'responsable:', 'encargado a',
    'encargada a', 'a cargo de', 'que se encargue',
  ];
  const posiciones = marcadores.map((m) => normal.lastIndexOf(m)).filter((i) => i >= 0);
  if (posiciones.length === 0) return null;
  const posicionMarcador = Math.max(...posiciones);
  const candidatos = ctx.personas.filter((persona) => {
    const nombre = normalizar(persona.nombre);
    const posicionNombre = normal.indexOf(nombre);
    return posicionNombre > posicionMarcador;
  });
  return candidatos.length === 1 ? candidatos[0]!.id : null;
}

/** Extrae la acción principal para no convertir todo el correo en el título del trabajo. */
function tituloTrabajo(texto: string): string {
  // Conservar formulaciones completas ya admitidas por el comportamiento anterior.
  // La extracción abreviada se reserva para correos con contexto adicional.
  if (/^\s*hay que\b/i.test(texto)) return titulo(texto);

  const accion = texto.match(
    /\b((?:conseguir|comprar|adquirir|revisar|instalar|coordinar|cotizar|reemplazar|cambiar|reparar|realizar|preparar|enviar|entregar|recoger|solicitar)\s+[^.!?]+?)(?=\s+(?:para completar|para gestionar|para coordinar|para la instalacion|del proyecto|en el proyecto|y coordinar|y completar)|[.!?]|$)/i,
  );
  if (accion?.[1]) return titulo(accion[1].replace(/\s+/g, ' '));
  return titulo(texto);
}

export function interpretarPorHeuristicas(texto: string, ctx: ContextoCaptura): Interpretacion {
  const normal = normalizar(texto);

  if (normal === '') {
    return { tipo: 'no_es_trabajo', motivo: 'No entendí el mensaje: no contiene texto interpretable.' };
  }

  if (esPregunta(texto, normal)) return { tipo: 'pregunta', pregunta: texto.trim() };

  if (esSoloAgradecimiento(normal)) {
    return { tipo: 'no_es_trabajo', motivo: 'Es un agradecimiento; no hay nada que hacer.' };
  }

  const actualizacionExplicita = actualizarTrabajoPorCodigo(normal, ctx);
  if (actualizacionExplicita) return actualizacionExplicita;

  const ps = palabras(normal);
  const termina = INICIOS_TERMINACION.has(ps[0]!) && ps.length <= 12;

  // La frase nombra un trabajo por su referencia (COLINA-4): es una actualización de ese trabajo.
  const citado = trabajoCitado(texto, normal, ctx);
  if (citado) {
    return {
      tipo: 'actualizacion',
      trabajoId: citado,
      nuevoEstado: termina ? 'resuelto' : RE_SIGUE.test(normal) ? 'en_curso' : null,
      nota: titulo(texto),
      hayProblema: false,
      reprogramar: [],
      notasRelacionadas: [],
    };
  }

  if (termina) {
    const id = trabajoReferido(normal, ctx);
    if (id) {
      return {
        tipo: 'actualizacion',
        trabajoId: id,
        nuevoEstado: 'resuelto',
        nota: titulo(texto),
        hayProblema: false,
        reprogramar: [],
        notasRelacionadas: [],
      };
    }
    // Suena a cierre, pero no hay un trabajo claro al que referirlo: no se inventa uno.
    return {
      tipo: 'no_es_trabajo',
      motivo: 'Parece un aviso de que algo quedó listo, pero no pude saber a qué trabajo se refiere. Indica cuál.',
    };
  }

  const jefeId = ctx.personas.find((p) => p.id === ctx.autor.id)?.jefeId ?? null;
  const proyectoId = proyectoExplicito(normal, ctx) ?? 'OD';
  const responsableIdExplicito = responsableAsignado(normal, ctx);
  return {
    tipo: 'trabajo_nuevo',
    titulo: tituloTrabajo(texto),
    proyectoId,
    responsableId: responsableIdExplicito ?? jefeId ?? ctx.autor.id,
    responsableSeguro: responsableIdExplicito !== null,
    plazo: { dia: 'hoy' },
    urgente: /\burgent/.test(normal),
    conCostoProbable: false,
    relacionados: [],
    bloquea: [],
    repuestoFaltante: null,
  };
}
