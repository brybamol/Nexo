'use server';
// Aprobar o rechazar una decisión desde la bandeja. Tarea 4.2.
import { NoImplementado, type LetraOpcion } from '@/dominio/tipos';

export async function accionAprobar(
  decisionId: string,
  letra: LetraOpcion,
): Promise<{ trabajosCreados: string[]; avisosA: string[] }> {
  void decisionId;
  void letra;
  throw new NoImplementado('app/acciones/decisiones.ts (4.2)');
}

export async function accionRechazar(decisionId: string, motivo: string): Promise<{ avisosA: string[] }> {
  void decisionId;
  void motivo;
  throw new NoImplementado('app/acciones/decisiones.ts (4.2)');
}
