// Bandeja de decisiones: listar, aprobar (R8) y rechazar. Tarea 3.3.
import { NoImplementado, type EstadoDecision, type LetraOpcion } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { DecisionVista } from '@/servicios/vistas';

const N = 'servicios/decisiones.ts (3.3)';

export async function listarDecisiones(
  ctx: ContextoServicio,
  f?: { decisorId?: string; estado?: EstadoDecision },
): Promise<DecisionVista[]> {
  void ctx;
  void f;
  throw new NoImplementado(N);
}

export async function obtenerDecision(ctx: ContextoServicio, id: string): Promise<DecisionVista | null> {
  void ctx;
  void id;
  throw new NoImplementado(N);
}

/** Lanza ErrorDominio si la persona no es el decisor o la decisión no está pendiente. */
export async function aprobarDecision(
  ctx: ContextoServicio,
  id: string,
  letra: LetraOpcion,
  personaId: string,
): Promise<{ trabajosCreados: string[]; avisosA: string[] }> {
  void ctx;
  void id;
  void letra;
  void personaId;
  throw new NoImplementado(N);
}

export async function rechazarDecision(
  ctx: ContextoServicio,
  id: string,
  personaId: string,
  motivo: string,
): Promise<{ avisosA: string[] }> {
  void ctx;
  void id;
  void personaId;
  void motivo;
  throw new NoImplementado(N);
}
