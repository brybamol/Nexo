// Preguntas sobre el estado de la empresa (C13). Tarea 4.3.
// La respuesta se CALCULA desde los datos (trabajos, estados, marcas, plazos, notas). La IA solo clasifica la pregunta
// y redacta el texto con esos hechos; si no hay datos para responder, Nexo dice «no lo sé» y no cita fuentes.
import { preguntas } from '@/db/esquema';
import { ErrorDominio } from '@/dominio/tipos';
import { formatearFecha } from '@/dominio/formato';
import { partesCR } from '@/dominio/tiempo';
import { construirContextoCaptura } from '@/ia/contexto';
import type { HechosPregunta, ResultadoIA, TemaPregunta } from '@/ia/interprete';
import {
  proyectoMencionado,
  TEXTO_NO_LO_SE,
  type DatosAtrasados,
  type DatosPedidos,
  type DatosPendientes,
  type DatosProyectos,
  type EstadoPedido,
  type ItemTrabajo,
  type PedidoDato,
} from '@/ia/local/preguntas-local';
import type { Instantanea } from '@/motor/instantanea';
import { cargarVistasTrabajos } from '@/servicios/consultas-trabajos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { MetaIA, RespuestaPregunta, TrabajoVista } from '@/servicios/vistas';

const MAX_TEXTO = 1000;
const RE_TITULO_PEDIDO = /^Entregar pedido (\d+)(?:\s·\s(.+?))?(?:\s·\s(.+))?$/u;

type Fuente = { trabajoId: string; etiqueta: string };
type Calculo = { hechos: HechosPregunta; hayDatos: boolean };

function plazoTexto(plazo: Date, ahora: Date): string {
  const p = partesCR(plazo);
  return p.fecha === partesCR(ahora).fecha ? `hoy a las ${p.hora}` : formatearFecha(plazo);
}

function pendienteDe(v: TrabajoVista, porId: Map<string, TrabajoVista>): TrabajoVista | null {
  for (const id of v.dependeDe) {
    const d = porId.get(id);
    if (d && d.estado !== 'resuelto') return d;
  }
  return null;
}

// ───────── pedidos_semana ─────────

function calcularPedidos(vistas: TrabajoVista[], ahora: Date): Calculo {
  const porId = new Map(vistas.map((v) => [v.id, v]));
  const pedidos: PedidoDato[] = [];
  for (const v of vistas) {
    const m = RE_TITULO_PEDIDO.exec(v.titulo);
    if (!m) continue;
    const estado: EstadoPedido =
      v.estado === 'resuelto' ? 'entregado' : v.marcas.atrasado ? 'atrasado' : v.estado === 'en_curso' ? 'en_ruta' : 'pendiente';
    const rel = estado === 'entregado' ? null : pendienteDe(v, porId);
    pedidos.push({
      pedido: Number(m[1]),
      trabajoId: v.id,
      producto: m[2] ?? '',
      cliente: m[3] ?? '',
      estado,
      plazo: plazoTexto(v.plazo, ahora),
      responsable: v.responsable.nombre,
      bloqueado: v.estado === 'bloqueado',
      nota: estado === 'atrasado' ? (v.notas.at(-1)?.texto ?? null) : null,
      relacionado: rel
        ? { trabajoId: rel.id, titulo: rel.titulo, responsable: rel.responsable.nombre, plazo: plazoTexto(rel.plazo, ahora) }
        : null,
    });
  }
  pedidos.sort((a, b) => a.pedido - b.pedido);
  const numeros = (e: EstadoPedido) => pedidos.filter((p) => p.estado === e).map((p) => p.pedido);
  const datos: DatosPedidos = {
    total: pedidos.length,
    entregados: numeros('entregado'),
    enRutaHoy: numeros('en_ruta'),
    atrasados: numeros('atrasado'),
    pendientes: numeros('pendiente'),
    pedidos,
  };
  const fuentes: Fuente[] = pedidos.map((p) => ({
    trabajoId: p.trabajoId,
    etiqueta: `Pedido ${p.pedido}${p.cliente ? ` · ${p.cliente}` : ''} (${p.trabajoId})`,
  }));
  return { hechos: { tema: 'pedidos_semana', datos: { ...datos }, fuentes }, hayDatos: pedidos.length > 0 };
}

// ───────── estado_proyectos ─────────

function calcularProyectos(inst: Instantanea, vistas: TrabajoVista[], texto: string): Calculo {
  const elegido = proyectoMencionado(texto, inst.proyectos);
  const proyectos = inst.proyectos.filter((p) => !elegido || p.id === elegido);
  const datos: DatosProyectos = {
    proyectos: proyectos.map((p) => {
      const t = vistas.filter((v) => v.proyecto.id === p.id);
      const cuenta = (e: string) => t.filter((v) => v.estado === e).length;
      return {
        id: p.id,
        nombre: p.nombre,
        responsable: inst.personas.find((x) => x.id === p.responsableId)?.nombre ?? p.responsableId,
        total: t.length,
        abiertos: cuenta('abierto'),
        enCurso: cuenta('en_curso'),
        bloqueados: cuenta('bloqueado'),
        resueltos: cuenta('resuelto'),
        atrasados: t.filter((v) => v.estado !== 'resuelto' && v.marcas.atrasado).length,
        enRiesgo: t.filter((v) => v.estado !== 'resuelto' && v.marcas.enRiesgo).length,
      };
    }),
  };
  const ids = new Set(proyectos.map((p) => p.id));
  const fuentes: Fuente[] = vistas
    .filter((v) => ids.has(v.proyecto.id) && v.estado !== 'resuelto' && (v.marcas.atrasado || v.marcas.enRiesgo || v.estado === 'bloqueado'))
    .map((v) => ({ trabajoId: v.id, etiqueta: `${v.id} · ${v.titulo}` }));
  return { hechos: { tema: 'estado_proyectos', datos: { ...datos }, fuentes }, hayDatos: proyectos.length > 0 };
}

// ───────── atrasados (incluye bloqueados y en riesgo) ─────────

function item(v: TrabajoVista, detalle: string, ahora: Date): ItemTrabajo {
  return {
    trabajoId: v.id,
    titulo: v.titulo,
    responsable: v.responsable.nombre,
    estado: v.estado,
    plazo: plazoTexto(v.plazo, ahora),
    detalle,
  };
}

function calcularAtrasados(vistas: TrabajoVista[], ahora: Date): Calculo {
  const abiertos = vistas.filter((v) => v.estado !== 'resuelto');
  const atrasados = abiertos.filter((v) => v.marcas.atrasado).map((v) => item(v, `plazo vencido: ${plazoTexto(v.plazo, ahora)}`, ahora));
  const bloqueados = abiertos
    .filter((v) => v.estado === 'bloqueado')
    .map((v) => {
      const por = v.bloqueadoPor ? `bloqueado por ${v.bloqueadoPor.id}` : 'bloqueado';
      const sol = v.fechaSolucion ? `, solución prevista ${plazoTexto(v.fechaSolucion, ahora)}` : ', sin fecha de solución';
      return item(v, `${por}${sol}`, ahora);
    });
  const enRiesgo = abiertos
    .filter((v) => v.marcas.enRiesgo)
    .map((v) => {
      const origenes = [...new Set(v.marcas.causas.map((c) => c.trabajoId ?? c.repuestoId).filter((x): x is string => !!x))];
      return item(v, origenes.length > 0 ? `en riesgo por ${origenes.join(', ')}` : 'en riesgo', ahora);
    });
  const datos: DatosAtrasados = { atrasados, bloqueados, enRiesgo };
  const vistos = new Set<string>();
  const fuentes: Fuente[] = [];
  for (const i of [...atrasados, ...bloqueados, ...enRiesgo]) {
    if (vistos.has(i.trabajoId)) continue;
    vistos.add(i.trabajoId);
    fuentes.push({ trabajoId: i.trabajoId, etiqueta: `${i.trabajoId} · ${i.titulo}` });
  }
  // Con 0 casos la respuesta es un dato verdadero («no hay atrasados»), no una laguna.
  return { hechos: { tema: 'atrasados', datos: { ...datos }, fuentes }, hayDatos: true };
}

// ───────── mis_pendientes ─────────

function calcularPendientes(vistas: TrabajoVista[], personaId: string, nombre: string, ahora: Date): Calculo {
  const mios = vistas
    .filter((v) => v.responsable.id === personaId && v.estado !== 'resuelto')
    .sort(
      (a, b) =>
        Number(b.urgente) - Number(a.urgente) ||
        Number(b.marcas.atrasado) - Number(a.marcas.atrasado) ||
        a.plazo.getTime() - b.plazo.getTime(),
    );
  const pendientes = mios.map((v) => {
    const marcas = [v.urgente ? 'urgente' : '', v.marcas.atrasado ? 'atrasado' : '', v.marcas.enRiesgo ? 'en riesgo' : '', v.estado === 'bloqueado' ? 'bloqueado' : '']
      .filter(Boolean)
      .join(', ');
    return item(v, `${v.estado.replace('_', ' ')}, plazo ${plazoTexto(v.plazo, ahora)}${marcas ? `, ${marcas}` : ''}`, ahora);
  });
  const datos: DatosPendientes = { persona: nombre, pendientes };
  const fuentes: Fuente[] = pendientes.map((i) => ({ trabajoId: i.trabajoId, etiqueta: `${i.trabajoId} · ${i.titulo}` }));
  return { hechos: { tema: 'mis_pendientes', datos: { ...datos }, fuentes }, hayDatos: true };
}

// ───────── servicio ─────────

function meta(r: ResultadoIA<unknown>): MetaIA {
  return { implementacion: r.implementacion, modelo: r.modelo, respaldo: r.respaldo };
}

function noLoSe(tema: TemaPregunta, ia: MetaIA): RespuestaPregunta {
  return { texto: TEXTO_NO_LO_SE, tema, fuentes: [], datos: {}, ia };
}

/**
 * Responde una pregunta con los datos actuales. Solo se guardan (y cuentan para las horas ahorradas) las preguntas
 * respondidas con datos; un «no lo sé» no se guarda.
 */
export async function preguntar(ctx: ContextoServicio, personaId: string, texto: string): Promise<RespuestaPregunta> {
  const pregunta = texto.trim();
  if (!pregunta) throw new ErrorDominio('Escribe una pregunta.');
  if (pregunta.length > MAX_TEXTO) throw new ErrorDominio(`La pregunta es muy larga (máximo ${MAX_TEXTO} caracteres).`);

  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  const persona = inst.personas.find((p) => p.id === personaId);
  if (!persona) throw new ErrorDominio(`No existe la persona ${personaId}.`);

  const clasificada = await ctx.ia.clasificarPregunta(pregunta, construirContextoCaptura(inst, personaId));
  const tema = clasificada.valor;

  let calculo: Calculo | null = null;
  switch (tema) {
    case 'pedidos_semana':
      calculo = calcularPedidos(vistas, inst.ahora);
      break;
    case 'estado_proyectos':
      calculo = calcularProyectos(inst, vistas, pregunta);
      break;
    case 'atrasados':
      calculo = calcularAtrasados(vistas, inst.ahora);
      break;
    case 'mis_pendientes':
      calculo = calcularPendientes(vistas, personaId, persona.nombre, inst.ahora);
      break;
    case 'desconocido':
      break;
  }
  if (!calculo || !calculo.hayDatos) return noLoSe(tema, meta(clasificada));

  const redactada = await ctx.ia.redactarRespuesta(pregunta, calculo.hechos);
  const ia: MetaIA = {
    implementacion: redactada.implementacion,
    modelo: redactada.modelo,
    respaldo: redactada.respaldo || clasificada.respaldo,
  };
  const respuesta: RespuestaPregunta = {
    texto: redactada.valor,
    tema,
    fuentes: calculo.hechos.fuentes,
    datos: calculo.hechos.datos,
    ia,
  };
  await ctx.db.insert(preguntas).values({
    personaId,
    en: inst.ahora,
    texto: pregunta,
    tema,
    respuesta: respuesta.texto,
    fuentes: respuesta.fuentes,
    implementacion: ia.implementacion,
    modelo: ia.modelo,
  });
  return respuesta;
}
