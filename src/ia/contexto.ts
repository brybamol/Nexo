// Construye el contexto que recibe la IA para una captura. Puro. Tarea 2.3.
import { ErrorDominio } from '@/dominio/tipos';
import type { ContextoCaptura } from '@/ia/interprete';
import type { Instantanea } from '@/motor/instantanea';

const DESFASE_MS = 6 * 60 * 60 * 1000; // Costa Rica = UTC−6, sin horario de verano

/** Instante → texto ISO con el desfase de Costa Rica: '2026-11-25T07:05:00-06:00'. */
export function isoCR(d: Date): string {
  return `${new Date(d.getTime() - DESFASE_MS).toISOString().slice(0, 19)}-06:00`;
}

/**
 * Lo que la IA necesita para interpretar una frase del autor: personas, proyectos, trabajos NO resueltos
 * (con su bloqueante y su repuesto), existencias y los trabajos con un seguimiento pendiente dirigido al autor.
 */
export function construirContextoCaptura(inst: Instantanea, autorId: string): ContextoCaptura {
  const autor = inst.personas.find((p) => p.id === autorId);
  if (!autor) throw new ErrorDominio(`No existe la persona ${autorId}.`);

  const seguimientosPendientesDelAutor: string[] = [];
  for (const s of inst.seguimientos) {
    if (s.estado === 'pendiente' && s.destinatarioId === autorId && !seguimientosPendientesDelAutor.includes(s.trabajoId)) {
      seguimientosPendientesDelAutor.push(s.trabajoId);
    }
  }

  return {
    ahora: isoCR(inst.ahora),
    autor: { id: autor.id, nombre: autor.nombre, rol: autor.rol, area: autor.area },
    personas: inst.personas.map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol, area: p.area, jefeId: p.jefeId })),
    proyectos: inst.proyectos.map((p) => ({ id: p.id, nombre: p.nombre, responsableId: p.responsableId })),
    trabajosAbiertos: inst.trabajos
      .filter((t) => t.estado !== 'resuelto')
      .map((t) => ({
        id: t.id,
        titulo: t.titulo,
        proyectoId: t.proyectoId,
        responsableId: t.responsableId,
        estado: t.estado,
        plazo: isoCR(t.plazo),
        bloqueadoPorId: t.bloqueadoPorId,
        repuestoId: t.repuestoId,
      })),
    repuestos: inst.repuestos.map((r) => ({ id: r.id, nombre: r.nombre, existencia: r.existencia })),
    seguimientosPendientesDelAutor,
  };
}
