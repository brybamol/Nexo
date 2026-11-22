// Preguntas en modo Local: clasificar el tema y redactar la respuesta por plantilla. Tarea 4.3.
// Sin red ni clave. La redacción SOLO usa los datos que calculó servicios/preguntar.ts: nunca inventa.
import { citaConReferencia } from '@/dominio/nombres';
import { normalizar, similitud } from '@/dominio/texto';
import type { ContextoCaptura, HechosPregunta, TemaPregunta } from '@/ia/interprete';

// ───────── Forma de los datos (la construye servicios/preguntar.ts, la leen la plantilla y Claude) ─────────

export type EstadoPedido = 'entregado' | 'en_ruta' | 'atrasado' | 'pendiente';

// Cada trabajo lleva su id interno (`trabajoId`, para las fuentes y los enlaces) y su `referencia` visible (PEDIDOS-3).
// Los textos citan SIEMPRE título y referencia; nunca el id interno.

export type PedidoDato = {
  pedido: number;
  trabajoId: string;
  referencia: string;
  cliente: string;
  producto: string;
  estado: EstadoPedido;
  /** Plazo ya formateado: «hoy a las 14:00» o «jue 26 nov, 17:00». */
  plazo: string;
  responsable: string;
  bloqueado: boolean;
  nota: string | null;
  /** Trabajo sin resolver del que depende la entrega (p. ej. reprogramar con el cliente, confirmar el pago). */
  relacionado: { trabajoId: string; referencia: string; titulo: string; responsable: string; plazo: string } | null;
};

export type DatosPedidos = {
  total: number;
  entregados: number[];
  enRutaHoy: number[];
  atrasados: number[];
  pendientes: number[];
  pedidos: PedidoDato[];
};

export type ProyectoDato = {
  id: string;
  nombre: string;
  responsable: string;
  total: number;
  abiertos: number;
  enCurso: number;
  bloqueados: number;
  resueltos: number;
  atrasados: number;
  enRiesgo: number;
};

export type DatosProyectos = { proyectos: ProyectoDato[] };

export type ItemTrabajo = {
  trabajoId: string;
  referencia: string;
  titulo: string;
  responsable: string;
  estado: string;
  plazo: string;
  detalle: string;
};

export type DatosAtrasados = { atrasados: ItemTrabajo[]; bloqueados: ItemTrabajo[]; enRiesgo: ItemTrabajo[] };

export type DatosPendientes = { persona: string; pendientes: ItemTrabajo[] };

export const TEXTO_NO_LO_SE =
  'No lo sé: no tengo datos en Nexo para responder eso. Puedo contarte cómo van los pedidos de la semana, los proyectos, ' +
  'qué está atrasado o en riesgo, y qué tienes pendiente.';

// ───────── Clasificación por reglas ─────────

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'con', 'para']);

/** Palabras distintivas (≥ 4 letras, sin artículos) del nombre de un proyecto. */
function palabrasDe(nombre: string): string[] {
  return normalizar(nombre)
    .split(' ')
    .filter((p) => p.length >= 4 && !PALABRAS_VACIAS.has(p));
}

/** ¿La pregunta nombra un proyecto? (nombre completo, su id como palabra, o todas sus palabras distintivas). */
export function proyectoMencionado(texto: string, proyectos: { id: string; nombre: string }[]): string | null {
  const normal = normalizar(texto);
  const palabras = new Set(normal.split(' '));
  for (const p of proyectos) {
    const nombre = normalizar(p.nombre);
    const distintivas = palabrasDe(p.nombre);
    if (nombre && normal.includes(nombre)) return p.id;
    if (/^p\d+$/i.test(p.id) && palabras.has(p.id.toLowerCase())) return p.id;
    if (distintivas.length >= 2 && distintivas.every((w) => palabras.has(w))) return p.id;
  }
  return null;
}

const RE_PEDIDOS = /\b(pedidos?|entregas?|entregad[oa]s?|despachos?|rutas?)\b/;
const RE_MIS = /\b(mis pendientes|mis tareas|mis trabajos|me toca|me tocan|que tengo|tengo pendiente|que debo|debo hacer|me corresponde)\b/;
const RE_ATRASADOS = /\b(atrasad[oa]s?|atraso|retrasad[oa]s?|retraso|bloquead[oa]s?|bloqueos?|riesgo|vencid[oa]s?)\b/;
const RE_PROYECTOS = /\b(proyectos?|avances?|como vamos|como va|como van|como esta|como estan|estado de)\b/;

export function clasificarPregunta(texto: string, ctx: ContextoCaptura): TemaPregunta {
  const normal = normalizar(texto);
  if (!normal) return 'desconocido';
  if (RE_PEDIDOS.test(normal)) return 'pedidos_semana';
  if (RE_MIS.test(normal)) return 'mis_pendientes';
  if (RE_ATRASADOS.test(normal)) return 'atrasados';
  if (RE_PROYECTOS.test(normal)) return 'estado_proyectos';
  if (proyectoMencionado(texto, ctx.proyectos)) return 'estado_proyectos';
  // Variantes con faltas de ortografía: se compara con frases modelo.
  const modelos: [string, TemaPregunta][] = [
    ['como vamos con los pedidos de la semana', 'pedidos_semana'],
    ['que esta atrasado', 'atrasados'],
    ['como van los proyectos', 'estado_proyectos'],
    ['que tengo pendiente', 'mis_pendientes'],
  ];
  let mejor: TemaPregunta = 'desconocido';
  let puntaje = 0.75;
  for (const [frase, tema] of modelos) {
    const s = similitud(normal, frase);
    if (s >= puntaje) {
      puntaje = s;
      mejor = tema;
    }
  }
  return mejor;
}

// ───────── Redacción por plantilla ─────────

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

function esLista<T>(x: unknown): x is T[] {
  return Array.isArray(x);
}

function lineaPedido(p: PedidoDato): string {
  const quien = [p.cliente, p.referencia].filter(Boolean).join(', ');
  const base = `${p.pedido} (${quien})`;
  const bloqueo = p.bloqueado ? ', bloqueado' : '';
  switch (p.estado) {
    case 'entregado':
      return base;
    case 'en_ruta':
      return `${base}, entrega ${p.plazo}${bloqueo}`;
    case 'atrasado': {
      const nota = p.nota ? ` (${p.nota})` : '';
      const rel = p.relacionado
        ? `; ${p.relacionado.responsable} lo atiende en ${citaConReferencia(p.relacionado.titulo, p.relacionado.referencia)}, ${p.relacionado.plazo}`
        : '';
      return `${base}, plazo vencido (${p.plazo})${nota}${rel}`;
    }
    case 'pendiente': {
      const rel = p.relacionado
        ? `, a la espera de ${citaConReferencia(p.relacionado.titulo, p.relacionado.referencia)}, de ${p.relacionado.responsable}`
        : '';
      return `${base}, para ${p.plazo}${bloqueo}${rel}`;
    }
  }
}

function redactarPedidos(d: DatosPedidos): string {
  const por = (e: EstadoPedido) => d.pedidos.filter((p) => p.estado === e);
  const resumen =
    `De ${plural(d.total, 'pedido', 'pedidos')} de la semana: ${plural(d.entregados.length, 'entregado', 'entregados')}, ` +
    `${d.enRutaHoy.length} en ruta hoy, ${plural(d.atrasados.length, 'atrasado', 'atrasados')} ` +
    `y ${plural(d.pendientes.length, 'pendiente', 'pendientes')}.`;
  const lineas = [resumen];
  const grupos: [string, EstadoPedido][] = [
    ['Entregados', 'entregado'],
    ['En ruta hoy', 'en_ruta'],
    ['Atrasados', 'atrasado'],
    ['Pendientes', 'pendiente'],
  ];
  for (const [titulo, estado] of grupos) {
    const items = por(estado);
    if (items.length > 0) lineas.push(`${titulo}: ${items.map(lineaPedido).join('; ')}.`);
  }
  return lineas.join('\n');
}

function redactarProyectos(d: DatosProyectos): string {
  return d.proyectos
    .map(
      (p) =>
        `${p.nombre} (responsable: ${p.responsable}): ${plural(p.total, 'trabajo', 'trabajos')}; ` +
        `${p.abiertos} abiertos, ${p.enCurso} en curso, ${p.bloqueados} bloqueados, ${p.resueltos} resueltos; ` +
        `${plural(p.atrasados, 'atrasado', 'atrasados')} y ${p.enRiesgo} en riesgo.`,
    )
    .join('\n');
}

function lineaItem(i: ItemTrabajo): string {
  return `${citaConReferencia(i.titulo, i.referencia)}: ${i.responsable}; ${i.detalle}`;
}

function redactarAtrasados(d: DatosAtrasados): string {
  if (d.atrasados.length + d.bloqueados.length + d.enRiesgo.length === 0) {
    return 'No hay trabajos atrasados, bloqueados ni en riesgo.';
  }
  const lineas: string[] = [];
  const grupos: [string, ItemTrabajo[]][] = [
    ['Atrasados', d.atrasados],
    ['Bloqueados', d.bloqueados],
    ['En riesgo', d.enRiesgo],
  ];
  for (const [titulo, items] of grupos) {
    lineas.push(items.length > 0 ? `${titulo} (${items.length}): ${items.map(lineaItem).join('; ')}.` : `${titulo}: ninguno.`);
  }
  return lineas.join('\n');
}

function redactarPendientes(d: DatosPendientes): string {
  if (d.pendientes.length === 0) return `${d.persona}, no tienes trabajos pendientes.`;
  return (
    `${d.persona}, tienes ${plural(d.pendientes.length, 'trabajo pendiente', 'trabajos pendientes')}:\n` +
    `${d.pendientes.map(lineaItem).join('; ')}.`
  );
}

/** Redacta el texto de la respuesta a partir de los hechos calculados. Si los datos no tienen la forma esperada, dice que no sabe. */
export function redactarRespuesta(pregunta: string, hechos: HechosPregunta): string {
  void pregunta;
  const d = hechos.datos;
  switch (hechos.tema) {
    case 'pedidos_semana':
      return esLista<PedidoDato>(d.pedidos) && d.pedidos.length > 0 ? redactarPedidos(d as unknown as DatosPedidos) : TEXTO_NO_LO_SE;
    case 'estado_proyectos':
      return esLista<ProyectoDato>(d.proyectos) && d.proyectos.length > 0 ? redactarProyectos(d as unknown as DatosProyectos) : TEXTO_NO_LO_SE;
    case 'atrasados':
      return esLista(d.atrasados) && esLista(d.bloqueados) && esLista(d.enRiesgo) ? redactarAtrasados(d as unknown as DatosAtrasados) : TEXTO_NO_LO_SE;
    case 'mis_pendientes':
      return esLista(d.pendientes) && typeof d.persona === 'string' ? redactarPendientes(d as unknown as DatosPendientes) : TEXTO_NO_LO_SE;
    case 'desconocido':
      return TEXTO_NO_LO_SE;
  }
}
