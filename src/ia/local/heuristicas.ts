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

function esPregunta(texto: string, normal: string): boolean {
  if (!/[¿?]/.test(texto)) return false;
  return palabras(normal).some((p) => PALABRAS_PREGUNTA.has(p));
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

export function interpretarPorHeuristicas(texto: string, ctx: ContextoCaptura): Interpretacion {
  const normal = normalizar(texto);

  if (normal === '') {
    return { tipo: 'no_es_trabajo', motivo: 'No entendí el mensaje: no contiene texto interpretable.' };
  }

  if (esPregunta(texto, normal)) return { tipo: 'pregunta', pregunta: texto.trim() };

  if (esSoloAgradecimiento(normal)) {
    return { tipo: 'no_es_trabajo', motivo: 'Es un agradecimiento; no hay nada que hacer.' };
  }

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
  return {
    tipo: 'trabajo_nuevo',
    titulo: titulo(texto),
    proyectoId: 'OD',
    responsableId: jefeId ?? ctx.autor.id,
    responsableSeguro: false,
    plazo: { dia: 'hoy' },
    urgente: /\burgent/.test(normal),
    conCostoProbable: false,
    relacionados: [],
    bloquea: [],
    repuestoFaltante: null,
  };
}
