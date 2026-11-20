// Hora de Costa Rica (UTC−6 fija), horario laboral y días hábiles. Todas puras. Tarea 1.3.
import { NoImplementado, type PlazoPropuesto } from '@/dominio/tipos';

const N = 'dominio/tiempo.ts (1.3)';

/** '2026-11-25', '12:00' → instante de esa hora en Costa Rica. */
export function enCR(fecha: string, hora: string): Date {
  void fecha;
  void hora;
  throw new NoImplementado(N);
}

export function partesCR(d: Date): { fecha: string; hora: string; diaSemana: number } {
  void d;
  throw new NoImplementado(N);
}

/** Lunes a viernes (en Costa Rica). */
export function esDiaHabil(d: Date): boolean {
  void d;
  throw new NoImplementado(N);
}

export function sumarMinutos(d: Date, m: number): Date {
  void d;
  void m;
  throw new NoImplementado(N);
}

/** Salta noches y fines de semana (jornada 7:00–17:00). */
export function sumarHorasLaborales(d: Date, h: number): Date {
  void d;
  void h;
  throw new NoImplementado(N);
}

/** Conserva la hora. */
export function sumarDiasHabiles(d: Date, n: number): Date {
  void d;
  void n;
  throw new NoImplementado(N);
}

/** Días hábiles entre fechas de calendario de Costa Rica, b ≥ a. */
export function diasHabilesEntre(a: Date, b: Date): number {
  void a;
  void b;
  throw new NoImplementado(N);
}

/** Mismo reloj, día hábil siguiente. */
export function siguienteDiaHabil(d: Date): Date {
  void d;
  throw new NoImplementado(N);
}

/** Ver §4.1 de docs/05: con hora → ese día a esa hora; 'hoy' urgente → 12:00 o 17:00; 'manana' → siguiente día hábil 17:00. */
export function resolverPlazo(p: PlazoPropuesto, urgente: boolean, ahora: Date): Date {
  void p;
  void urgente;
  void ahora;
  throw new NoImplementado(N);
}
