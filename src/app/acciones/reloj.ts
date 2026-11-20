'use server';
// Botones del reloj: +5 min, +30 min y «Siguiente evento». Tarea 1.7.
import { NoImplementado } from '@/dominio/tipos';
import type { ResultadoTick } from '@/servicios/vistas';

export async function avanzar(minutos: number): Promise<ResultadoTick> {
  void minutos;
  throw new NoImplementado('app/acciones/reloj.ts (1.7)');
}

export async function siguienteEvento(): Promise<ResultadoTick> {
  throw new NoImplementado('app/acciones/reloj.ts (1.7)');
}
