// Opciones A/B/C y decisor: R6, R7 (§4.2 regla 8). Puro. Tarea 3.3.
// Todas las cifras salen de `repuestos` (precio, plazo de entrega) y de las necesidades y dependencias de la instantánea.
import {
  HORA_ENTREGA_LOCAL,
  HORA_LLEGADA_HABITUAL,
  HORA_PLAZO_SIN_HORA,
  ROL_GERENTE,
  ROL_JEFE_OPERACIONES,
  UMBRAL_GERENTE,
} from '@/dominio/constantes';
import { formatearColones, formatearFecha } from '@/dominio/formato';
import { enCR, esDiaHabil, partesCR, siguienteDiaHabil } from '@/dominio/tiempo';
import type { CambioFecha, LineaOpcion, OpcionCalculada, PropuestaCompra, Proveedor, Repuesto, Trabajo } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';
import { desplazarCadena } from '@/motor/plazos';

export type { CambioFecha, OpcionCalculada, PropuestaCompra };

const MS_DIA = 24 * 60 * 60 * 1000;

/** Llegada del proveedor local: hoy 15:00 si ahora < 15:00 en día hábil; si no, el siguiente día hábil 15:00. */
export function llegadaLocal(ahora: Date): Date {
  const hoy = enCR(partesCR(ahora).fecha, HORA_ENTREGA_LOCAL);
  if (esDiaHabil(ahora) && ahora.getTime() < hoy.getTime()) return hoy;
  return enCR(partesCR(siguienteDiaHabil(ahora)).fecha, HORA_ENTREGA_LOCAL);
}

/** Llegada del proveedor habitual: hoy + `dias_habitual` días naturales, 07:00. */
export function llegadaHabitual(ahora: Date, r: Repuesto): Date {
  return enCR(partesCR(new Date(ahora.getTime() + r.diasHabitual * MS_DIA)).fecha, HORA_LLEGADA_HABITUAL);
}

function plural(palabra: string): string {
  return /[aeiouáéíóú]$/i.test(palabra) ? `${palabra}s` : `${palabra}es`;
}

/** «3 compresores de 2 HP», «1 compresor de 2 HP», «20 metros de empaque de puerta». */
export function cantidadDeRepuesto(r: Repuesto, n: number): string {
  const nombre = r.nombre.charAt(0).toLowerCase() + r.nombre.slice(1);
  if (r.unidad !== 'unidad') return `${n} ${n === 1 ? r.unidad : plural(r.unidad)} de ${nombre}`;
  if (n === 1) return `1 ${nombre}`;
  const corte = nombre.indexOf(' de ');
  const cabeza = corte >= 0 ? nombre.slice(0, corte) : nombre;
  const resto = corte >= 0 ? nombre.slice(corte) : '';
  return `${n} ${cabeza.split(' ').map(plural).join(' ')}${resto}`;
}

const dia = (d: Date) => formatearFecha(d).split(',')[0] ?? '';

/**
 * Trabajos que dependen de la compra: necesidades no atendidas y sin fecha de llegada del repuesto, ordenadas por
 * plazo (empate: bloqueado primero), que la existencia real no cubre (faltante reportado = 0), hasta la cantidad.
 */
function trabajosPorCubrir(inst: Instantanea, r: Repuesto, p: PropuestaCompra): Trabajo[] {
  const trabajos = new Map(inst.trabajos.map((t) => [t.id, t]));
  const necesidades = inst.necesidades
    .filter((n) => n.repuestoId === r.id && !n.atendida && n.fechaDisponible === null)
    .map((n) => ({ n, t: trabajos.get(n.trabajoId) }))
    .filter((x): x is { n: (typeof x)['n']; t: Trabajo } => x.t !== undefined && x.t.estado !== 'resuelto')
    .sort(
      (a, b) =>
        a.t.plazo.getTime() - b.t.plazo.getTime() ||
        Number(b.t.estado === 'bloqueado') - Number(a.t.estado === 'bloqueado') ||
        (a.t.id < b.t.id ? -1 : 1),
    );
  let existencia = p.existenciaReal ?? (r.faltanteReportadoEn ? 0 : r.existencia);
  let comprado = 0;
  const res: Trabajo[] = [];
  for (const { n, t } of necesidades) {
    if (existencia >= n.cantidad) {
      existencia -= n.cantidad;
      continue;
    }
    if (comprado + n.cantidad > p.cantidad) continue;
    comprado += n.cantidad;
    res.push(t);
  }
  return res;
}

function consecuencia(inst: Instantanea, lineas: LineaOpcion[], cambios: CambioFecha[]): string {
  const ids = new Set([...lineas.flatMap((l) => l.trabajoIds), ...cambios.map((c) => c.trabajoId)]);
  if (ids.size === 0) return 'Repone el inventario: ningún trabajo abierto espera esta compra y no cambia ninguna fecha.';
  const proyectoIds: string[] = [];
  for (const t of inst.trabajos) if (ids.has(t.id) && !proyectoIds.includes(t.proyectoId)) proyectoIds.push(t.proyectoId);
  const partes = proyectoIds.map((pid) => {
    const nombre = inst.proyectos.find((p) => p.id === pid)?.nombre ?? pid;
    const cs = cambios.filter((c) => inst.trabajos.find((t) => t.id === c.trabajoId)?.proyectoId === pid);
    if (cs.length === 0) return `${nombre}: a tiempo, sin cambios de fecha`;
    const final = cs.reduce((m, c) => (c.a.getTime() > m.getTime() ? c.a : m), cs[0]!.a);
    return `${nombre}: se atrasa hasta el ${dia(final)} (${cs.map((c) => `${c.trabajoId} al ${dia(c.a)}`).join(', ')})`;
  });
  return `${partes.join('. ')}.`;
}

export function calcularOpciones(inst: Instantanea, p: PropuestaCompra): OpcionCalculada[] {
  const r = inst.repuestos.find((x) => x.id === p.repuestoId);
  if (!r || !Number.isInteger(p.cantidad) || p.cantidad <= 0) return [];
  const pendientes = trabajosPorCubrir(inst, r, p);
  const precio: Record<Proveedor, number> = {
    local: r.precioLocal,
    habitual: Math.round(r.precioHabitual * (1 + (p.ajustePrecioPct ?? 0) / 100)),
  };
  const llegada: Record<Proveedor, Date> = { local: llegadaLocal(inst.ahora), habitual: llegadaHabitual(inst.ahora, r) };
  const linea = (proveedor: Proveedor, cantidad: number, ts: Trabajo[]): LineaOpcion => ({
    proveedor,
    cantidad,
    precioUnitario: precio[proveedor],
    llegada: llegada[proveedor],
    trabajoIds: ts.map((t) => t.id),
  });

  const construir = (letra: OpcionCalculada['letra'], lineas: LineaOpcion[]): OpcionCalculada => {
    const nuevos = new Map<string, Date>();
    for (const l of lineas) {
      for (const id of l.trabajoIds) {
        const t = pendientes.find((x) => x.id === id) as Trabajo;
        if (l.llegada.getTime() > t.plazo.getTime()) nuevos.set(id, enCR(partesCR(l.llegada).fecha, HORA_PLAZO_SIN_HORA));
      }
    }
    const cambiosFecha = desplazarCadena(inst, nuevos);
    const compra = lineas
      .map((l) => `${l.cantidad} al proveedor ${l.proveedor} (${formatearColones(l.precioUnitario)} c/u), ${l.cantidad === 1 ? 'llega' : 'llegan'} el ${formatearFecha(l.llegada)}`)
      .join('; ');
    return {
      letra,
      descripcion: `Comprar ${cantidadDeRepuesto(r, p.cantidad)}: ${compra}.`,
      costo: lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0),
      lineas,
      cambiosFecha,
      consecuencia: consecuencia(inst, lineas, cambiosFecha),
    };
  };

  const opciones = [
    construir('A', [linea('local', p.cantidad, pendientes)]),
    construir('B', [linea('habitual', p.cantidad, pendientes)]),
  ];
  if (p.cantidad >= 2 && pendientes.length >= 2) {
    opciones.push(construir('C', [linea('local', 1, pendientes.slice(0, 1)), linea('habitual', p.cantidad - 1, pendientes.slice(1))]));
  }
  return opciones;
}

/** personaId: jefe de operaciones si el costo máximo ≤ ₡100.000; si no, gerente general. */
export function decisorPara(inst: Instantanea, opciones: OpcionCalculada[]): string {
  const maximo = Math.max(0, ...opciones.map((o) => o.costo));
  const rol = maximo <= UMBRAL_GERENTE ? ROL_JEFE_OPERACIONES : ROL_GERENTE;
  const persona = inst.personas.find((x) => x.rol === rol);
  if (!persona) throw new Error(`No hay nadie con el rol «${rol}».`);
  return persona.id;
}
