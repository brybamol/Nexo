// Decisiones: crear, aplicar (R8) y rechazar (§4.2 regla 9). Puro. Tarea 3.3.
// Nada con costo se ejecuta al crear (R6): la decisión se prepara y espera aprobación.
// Las acciones salen con capturaId = null: servicios/aplicar.ts les pone la captura de origen.
import { HORA_PLAZO_SIN_HORA, ROL_COMPRAS, ROL_SERVICIO_CLIENTE, UMBRAL_GERENTE } from '@/dominio/constantes';
import { formatearColones, formatearFecha } from '@/dominio/formato';
import { citaConReferencia, enumerar, referenciaDecision, referenciaTrabajo, tituloDecision } from '@/dominio/nombres';
import { minusculaInicial } from '@/dominio/texto';
import { enCR, partesCR } from '@/dominio/tiempo';
import { ErrorDominio, type Decision, type LetraOpcion, type PropuestaCompra, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import {
  cadenaDependientes,
  nombrador,
  porId,
  siguienteIdDecision,
  siguienteIdTrabajo,
  siguienteNumeroDecision,
  siguienteNumeroTrabajo,
  type Instantanea,
} from '@/motor/instantanea';
import { calcularMarcas } from '@/motor/marcas';
import { calcularOpciones, cantidadDeRepuesto, decisorPara } from '@/motor/opciones';
import { causaCitada } from '@/motor/propagacion';

const nombreDe = (inst: Instantanea, id: string) => inst.personas.find((p) => p.id === id)?.nombre ?? id;

/** R5: lo que un mismo hecho le cambia a cada persona va en un solo aviso. */
class Avisos {
  private readonly grupos = new Map<string, { trabajoIds: string[]; lineas: string[] }>();
  constructor(private readonly excluir: string) {}
  agregar(personaId: string, trabajoIds: string[], linea: string): void {
    if (personaId === this.excluir) return;
    const g = this.grupos.get(personaId) ?? { trabajoIds: [], lineas: [] };
    for (const id of trabajoIds) if (!g.trabajoIds.includes(id)) g.trabajoIds.push(id);
    if (!g.lineas.includes(linea)) g.lineas.push(linea);
    this.grupos.set(personaId, g);
  }
  entradas() {
    return [...this.grupos.entries()];
  }
}

function accionAviso(
  inst: Instantanea,
  o: { personaId: string; tipo: 'aviso'; titulo: string; cuerpo: string; motivo: string; hecho: string; trabajoIds: string[]; decisionId: string },
): Efecto {
  return {
    tipo: 'accion',
    accion: {
      en: inst.ahora,
      tipo: o.tipo,
      motivo: o.motivo,
      hechoOrigen: o.hecho,
      trabajoIds: o.trabajoIds,
      decisionId: o.decisionId,
      destinatarioId: o.personaId,
      capturaId: null,
    },
    aviso: { personaId: o.personaId, en: inst.ahora, titulo: o.titulo, cuerpo: o.cuerpo, trabajoIds: o.trabajoIds },
  };
}

export function efectosDecisionNueva(
  inst: Instantanea,
  p: PropuestaCompra,
  proponenteId: string,
  proyectoId: string,
  capturaId: number | null,
): Efecto[] {
  const r = inst.repuestos.find((x) => x.id === p.repuestoId);
  if (!r) return [];
  const proponente = nombreDe(inst, proponenteId);
  const hecho = `${proponente} propuso comprar ${cantidadDeRepuesto(r, p.cantidad)}`;
  const efectos: Efecto[] = [];

  // Corrección de existencia (C11: el sistema decía 3, en bodega hay 0).
  const corrige = p.existenciaReal !== null && p.existenciaReal !== r.existencia;
  if (corrige) {
    efectos.push({ tipo: 'actualizar_repuesto', repuestoId: r.id, cambios: { existencia: p.existenciaReal as number }, actorId: proponenteId });
    efectos.push({
      tipo: 'accion',
      accion: {
        en: inst.ahora,
        tipo: 'corregir_existencia',
        motivo: `${proponente} informó que hay ${p.existenciaReal} de ${minusculaInicial(r.nombre)}; el sistema decía ${r.existencia}.`,
        hechoOrigen: hecho,
        trabajoIds: [],
        decisionId: null,
        destinatarioId: null,
        capturaId,
      },
      aviso: null,
    });
  }

  const corregida = aplicarEnMemoria(inst, efectos);
  const opciones = calcularOpciones(corregida, p);
  if (opciones.length === 0) return [];
  const decisorId = decisorPara(corregida, opciones, proyectoId, proponenteId);
  const id = siguienteIdDecision(inst);
  const numero = siguienteNumeroDecision(inst, proyectoId);
  const trabajos = porId(inst.trabajos);
  const nombres = nombrador(inst);
  const clave = inst.proyectos.find((x) => x.id === proyectoId)?.clave;
  const citaNueva = citaConReferencia(tituloDecision(r, p.cantidad), referenciaDecision(clave, numero));

  // Afectados: los trabajos que esperan la compra y su cadena de dependientes no resueltos.
  const cubiertos = opciones[0]?.lineas.flatMap((l) => l.trabajoIds) ?? [];
  const afectados: string[] = [];
  for (const tid of cubiertos) {
    for (const x of [tid, ...cadenaDependientes(inst, tid)]) {
      if (!afectados.includes(x) && trabajos.get(x)?.estado !== 'resuelto') afectados.push(x);
    }
  }
  const personaIds = [...new Set(afectados.map((x) => trabajos.get(x)?.responsableId).filter((x): x is string => !!x))];

  // Qué pasó (R7).
  const partes = [`${proponente} propone comprar ${cantidadDeRepuesto(r, p.cantidad)}${p.proveedor ? ` al proveedor ${p.proveedor}` : ''}.`];
  if (p.ajustePrecioPct) partes.push(`El precio habitual sube ${p.ajustePrecioPct} %.`);
  if (corrige) partes.push(`Existencia corregida: el sistema decía ${r.existencia}, hay ${p.existenciaReal}.`);
  if (cubiertos.length > 0) {
    const lista = cubiertos.map((x) => {
      const t = trabajos.get(x) as Trabajo;
      const ref = nombres.referencia(t.id);
      const extra = [ref, t.estado === 'bloqueado' ? 'bloqueado' : ''].filter(Boolean).join(', ');
      return `«${t.titulo}»${extra ? ` (${extra})` : ''}`;
    });
    partes.push(`Esperan el repuesto: ${enumerar(lista)}.`);
  } else {
    partes.push('La existencia cubre los trabajos abiertos: la compra repone inventario.');
  }
  const causa = causaCitada(inst, r.id);
  if (causa) partes.push(`Causa: el conteo no está conciliado con el sistema: ${nombres.cita(causa)}.`);
  const contexto = partes.join(' ');

  const decision: Decision = {
    id,
    creadaEn: inst.ahora,
    proyectoId,
    numero,
    proponenteId,
    decisorId,
    capturaId,
    repuestoId: r.id,
    cantidad: p.cantidad,
    contexto,
    afectados: { trabajoIds: afectados, personaIds },
    opcionPropuesta: p.proveedor === 'local' ? 'A' : p.proveedor === 'habitual' ? 'B' : null,
    estado: 'pendiente',
    opcionElegida: null,
    decididaEn: null,
    motivoRechazo: null,
    opciones,
  };
  efectos.push({ tipo: 'crear_decision', decision });
  efectos.push({
    tipo: 'evento',
    evento: {
      en: inst.ahora,
      actorId: proponenteId,
      tipo: 'decision_creada',
      trabajoId: null,
      decisionId: id,
      datos: { repuestoId: r.id, cantidad: p.cantidad, decisorId, costos: Object.fromEntries(opciones.map((o) => [o.letra, o.costo])) },
    },
  });
  const resumenOpciones = opciones.map((o) => `${o.letra} ${formatearColones(o.costo)}`).join(', ');
  const decisor = nombreDe(inst, decisorId);
  const tope = formatearColones(UMBRAL_GERENTE);
  const responsableProyecto = inst.proyectos.find((x) => x.id === proyectoId)?.responsableId;
  const porQueDecide =
    Math.max(0, ...opciones.map((o) => o.costo)) > UMBRAL_GERENTE
      ? `supera el tope de ${tope}`
      : decisorId === responsableProyecto
        ? `no supera el tope de ${tope} y es responsable del proyecto`
        : `no supera el tope de ${tope}, pero quien propone es el responsable del proyecto y nadie aprueba su propia propuesta`;
  efectos.push({
    tipo: 'accion',
    accion: {
      en: inst.ahora,
      tipo: 'crear_decision',
      motivo: `Tiene costo (R6): decide ${decisor} (${porQueDecide}). Opciones: ${resumenOpciones}.`,
      hechoOrigen: hecho,
      trabajoIds: afectados,
      decisionId: id,
      destinatarioId: null,
      capturaId,
    },
    aviso: null,
  });
  if (decisorId !== proponenteId) {
    efectos.push(
      accionAviso(inst, {
        personaId: decisorId,
        tipo: 'aviso',
        titulo: `Decisión pendiente: ${citaNueva}`,
        cuerpo: `${contexto} Opciones: ${opciones.map((o) => `${o.letra}) ${o.descripcion} ${formatearColones(o.costo)}. ${o.consecuencia}`).join(' ')}`,
        motivo: `Decisión con costo para ${decisor} (R6, R7): ${resumenOpciones}.`,
        hecho,
        trabajoIds: afectados,
        decisionId: id,
      }),
    );
  }
  return efectos.map((e) => (e.tipo === 'accion' && e.accion.capturaId === null && capturaId !== null ? { ...e, accion: { ...e.accion, capturaId } } : e));
}

function pendiente(inst: Instantanea, decisionId: string): Decision {
  const d = inst.decisiones.find((x) => x.id === decisionId);
  if (!d) throw new ErrorDominio('No existe esa decisión.');
  if (d.estado !== 'pendiente') throw new ErrorDominio(`La decisión ${nombrador(inst).citaDecision(d.id)} ya está ${d.estado}.`);
  return d;
}

export function aplicarDecision(inst: Instantanea, decisionId: string, letra: LetraOpcion, decisorId: string): Efecto[] {
  const d = pendiente(inst, decisionId);
  const opcion = d.opciones.find((o) => o.letra === letra);
  const nombres = nombrador(inst);
  const citaD = nombres.citaDecision(d.id);
  if (!opcion) throw new ErrorDominio(`La decisión ${citaD} no tiene opción ${letra}.`);
  const r = inst.repuestos.find((x) => x.id === d.repuestoId);
  if (!r) throw new ErrorDominio(`No existe el repuesto ${d.repuestoId}.`);
  const decisor = nombreDe(inst, decisorId);
  const hecho = `${decisor} aprobó la opción ${letra} de ${citaD}: ${opcion.descripcion}`;
  const trabajos = porId(inst.trabajos);
  const compras = inst.personas.find((p) => p.rol === ROL_COMPRAS);
  if (!compras) throw new ErrorDominio(`No hay nadie con el rol «${ROL_COMPRAS}».`);

  const efectos: Efecto[] = [
    { tipo: 'actualizar_decision', decisionId: d.id, cambios: { estado: 'aprobada', opcionElegida: letra, decididaEn: inst.ahora } },
    {
      tipo: 'evento',
      evento: { en: inst.ahora, actorId: decisorId, tipo: 'decision_aprobada', trabajoId: null, decisionId: d.id, datos: { letra, costo: opcion.costo } },
    },
  ];
  const avisos = new Avisos(decisorId);
  const creados: Trabajo[] = [];
  const claves = new Map(inst.proyectos.map((x) => [x.id, x.clave]));
  /** Cita de un trabajo, también de los que se crean en esta decisión (aún no están en `inst`). */
  const citar = (t: Trabajo) => citaConReferencia(t.titulo, referenciaTrabajo(claves.get(t.proyectoId), t.numero));
  const crear = (t: Omit<Trabajo, 'id' | 'numero'>): Trabajo => {
    const actual = aplicarEnMemoria(inst, efectos);
    const trabajo = { ...t, id: siguienteIdTrabajo(actual), numero: siguienteNumeroTrabajo(actual, t.proyectoId) };
    efectos.push({ tipo: 'crear_trabajo', trabajo, necesidades: [], actorId: decisorId });
    creados.push(trabajo);
    return trabajo;
  };
  const base = {
    proyectoId: d.proyectoId,
    solicitadoPorId: decisorId,
    estado: 'abierto' as const,
    urgente: false,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    etiqueta: null,
    origen: 'decision' as const,
    capturaId: null,
    decisionId: d.id,
    creadoEn: inst.ahora,
    resueltoEn: null,
    confirmacion: 'confirmado' as const,
    duenoPropuestaId: null,
    confirmadoPorId: null,
    entrega: null,
  };

  // 1. Un trabajo de compra por línea, para la encargada de compras; la necesidad cubierta recibe su fecha.
  const llegadaDe = new Map<string, Date>();
  for (const l of opcion.lineas) {
    const t = crear({
      ...base,
      titulo: `Comprar ${cantidadDeRepuesto(r, l.cantidad)} al proveedor ${l.proveedor}`,
      responsableId: compras.id,
      plazo: l.llegada,
      repuestoId: r.id,
      cantidadRepuesto: l.cantidad,
      relacionados: l.trabajoIds,
    });
    avisos.agregar(compras.id, [t.id], `Nuevo trabajo ${citar(t)}, plazo ${formatearFecha(t.plazo)} (${formatearColones(l.cantidad * l.precioUnitario)}).`);
    for (const tid of l.trabajoIds) {
      llegadaDe.set(tid, l.llegada);
      if (inst.necesidades.some((n) => n.trabajoId === tid && n.repuestoId === r.id)) {
        efectos.push({ tipo: 'actualizar_necesidad', trabajoId: tid, repuestoId: r.id, cambios: { fechaDisponible: l.llegada } });
      }
    }
  }
  const llegadas = opcion.lineas.map((l) => l.llegada.getTime());
  const primera = llegadas.length > 0 ? new Date(Math.min(...llegadas)) : null;

  // 2. Los bloqueados por un trabajo del mismo repuesto reciben fecha de solución; el bloqueante pasa a en curso.
  const bloqueantes = new Set<string>();
  for (const t of inst.trabajos) {
    if (t.estado !== 'bloqueado' || !t.bloqueadoPorId) continue;
    const b = trabajos.get(t.bloqueadoPorId);
    if (!b || b.repuestoId !== r.id || b.estado === 'resuelto') continue;
    const fecha = llegadaDe.get(t.id) ?? primera;
    if (!fecha) continue;
    bloqueantes.add(b.id);
    efectos.push({ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { fechaSolucion: fecha }, actorId: decisorId });
    avisos.agregar(t.responsableId, [t.id], `${citar(t)} sigue bloqueado; fecha de solución: ${formatearFecha(fecha)}.`);
  }

  // 3. Cambios de fecha de la opción.
  for (const c of opcion.cambiosFecha) {
    const t = trabajos.get(c.trabajoId);
    if (!t || t.estado === 'resuelto') continue;
    efectos.push({ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { plazo: c.a }, actorId: decisorId });
    avisos.agregar(t.responsableId, [t.id], `El plazo de ${citar(t)} pasa de ${formatearFecha(c.de)} a ${formatearFecha(c.a)}.`);
  }

  if (primera) {
    for (const bid of bloqueantes) {
      const b = trabajos.get(bid) as Trabajo;
      efectos.push({
        tipo: 'actualizar_trabajo',
        trabajoId: b.id,
        cambios: { ...(b.estado === 'en_curso' ? {} : { estado: 'en_curso' as const }), plazo: primera },
        actorId: decisorId,
      });
      avisos.agregar(b.responsableId, [b.id], `${citar(b)} pasa a en curso con plazo ${formatearFecha(primera)}: el repuesto llega entonces.`);
    }
  }

  // 4. Si cambian fechas comprometidas, servicio al cliente avisa a los clientes.
  if (opcion.cambiosFecha.length > 0) {
    const servicio = inst.personas.find((p) => p.rol === ROL_SERVICIO_CLIENTE);
    const proyectoIds: string[] = [];
    for (const t of inst.trabajos) {
      if (opcion.cambiosFecha.some((c) => c.trabajoId === t.id) && !proyectoIds.includes(t.proyectoId)) proyectoIds.push(t.proyectoId);
    }
    const clientes = [...new Set(proyectoIds.map((pid) => inst.proyectos.find((p) => p.id === pid)?.cliente).filter((c): c is string => !!c))];
    if (servicio) {
      const t = crear({
        ...base,
        titulo: `Avisar del atraso a ${clientes.length > 0 ? enumerar(clientes) : 'los clientes'}`,
        responsableId: servicio.id,
        plazo: enCR(partesCR(inst.ahora).fecha, HORA_PLAZO_SIN_HORA),
        repuestoId: null,
        cantidadRepuesto: null,
        relacionados: opcion.cambiosFecha.map((c) => c.trabajoId),
      });
      avisos.agregar(servicio.id, [t.id], `Nuevo trabajo ${citar(t)}, plazo ${formatearFecha(t.plazo)}. ${opcion.consecuencia}`);
    }
  }

  // 5. Quienes pierden el riesgo (R8) y el proponente.
  const despues = aplicarEnMemoria(inst, efectos);
  const mAntes = calcularMarcas(inst);
  const mDespues = calcularMarcas(despues);
  for (const t of despues.trabajos) {
    if (mAntes.get(t.id)?.enRiesgo && !mDespues.get(t.id)?.enRiesgo) {
      avisos.agregar(t.responsableId, [t.id], `${citar(t)} ya no está en riesgo.`);
    }
  }
  avisos.agregar(d.proponenteId, [], `${decisor} aprobó tu propuesta ${citaD} con la opción ${letra} (${formatearColones(opcion.costo)}).`);

  const tocados = [...new Set(efectos.flatMap((e) => (e.tipo === 'actualizar_trabajo' ? [e.trabajoId] : e.tipo === 'crear_trabajo' ? [e.trabajo.id] : [])))];
  efectos.push({
    tipo: 'accion',
    accion: {
      en: inst.ahora,
      tipo: 'aplicar_decision',
      motivo: `${decisor} aprobó la opción ${letra} de ${citaD} (${formatearColones(opcion.costo)}). Creé ${enumerar(creados.map(citar))}. ${opcion.consecuencia}`,
      hechoOrigen: hecho,
      trabajoIds: tocados,
      decisionId: d.id,
      destinatarioId: null,
      capturaId: null,
    },
    aviso: null,
  });
  for (const [personaId, g] of avisos.entradas()) {
    const cuerpo = `${decisor} aprobó la opción ${letra} de ${citaD}: ${opcion.descripcion} ${g.lineas.join(' ')}`;
    efectos.push(
      accionAviso(inst, {
        personaId,
        tipo: 'aviso',
        titulo: `«${nombres.tituloDecision(d.id)}» aprobada: opción ${letra}`,
        cuerpo,
        motivo: `R8: ${g.lineas.join(' ')}`,
        hecho,
        trabajoIds: g.trabajoIds,
        decisionId: d.id,
      }),
    );
  }
  return efectos;
}

export function rechazarDecision(inst: Instantanea, decisionId: string, decisorId: string, motivo: string): Efecto[] {
  const d = pendiente(inst, decisionId);
  const decisor = nombreDe(inst, decisorId);
  const nombres = nombrador(inst);
  const citaD = nombres.citaDecision(d.id);
  const efectos: Efecto[] = [
    { tipo: 'actualizar_decision', decisionId: d.id, cambios: { estado: 'rechazada', decididaEn: inst.ahora, motivoRechazo: motivo } },
    { tipo: 'evento', evento: { en: inst.ahora, actorId: decisorId, tipo: 'decision_rechazada', trabajoId: null, decisionId: d.id, datos: { motivo } } },
  ];
  if (d.proponenteId !== decisorId) {
    efectos.push(
      accionAviso(inst, {
        personaId: d.proponenteId,
        tipo: 'aviso',
        titulo: `«${nombres.tituloDecision(d.id)}» rechazada`,
        cuerpo: `${decisor} rechazó la decisión ${citaD}. Motivo: ${motivo}`,
        motivo: `Decisión rechazada; se avisa a quien la propuso (R8). Motivo: ${motivo}`,
        hecho: `${decisor} rechazó ${citaD}: «${motivo}»`,
        trabajoIds: d.afectados.trabajoIds,
        decisionId: d.id,
      }),
    );
  }
  return efectos;
}
