// Hora de Costa Rica (UTC−6 fija), horario laboral y días hábiles. Todas puras. Tarea 1.3.
import { DESFASE_CR, HORA_FIN, HORA_INICIO, HORA_PLAZO_SIN_HORA, HORA_PLAZO_URGENTE_HOY } from '@/dominio/constantes';
import type { PlazoPropuesto } from '@/dominio/tipos';

const MS_MIN = 60_000;
const MS_DIA = 24 * 60 * MS_MIN;
const DESFASE_MS = 6 * 60 * MS_MIN; // CR = UTC−6, sin horario de verano

/** Desplaza el instante para poder leer la fecha y hora locales de CR con los getters UTC. */
function local(d: Date): Date {
  return new Date(d.getTime() - DESFASE_MS);
}

const dos = (n: number) => String(n).padStart(2, '0');

/** '2026-11-25', '12:00' → instante de esa hora en Costa Rica. */
export function enCR(fecha: string, hora: string): Date {
  const h = /^\d{1,2}:\d{2}$/.test(hora) ? `${hora.padStart(5, '0')}:00` : hora;
  return new Date(`${fecha}T${h}${DESFASE_CR}`);
}

export function partesCR(d: Date): { fecha: string; hora: string; diaSemana: number } {
  const l = local(d);
  return {
    fecha: `${l.getUTCFullYear()}-${dos(l.getUTCMonth() + 1)}-${dos(l.getUTCDate())}`,
    hora: `${dos(l.getUTCHours())}:${dos(l.getUTCMinutes())}`,
    diaSemana: l.getUTCDay(),
  };
}

/** Lunes a viernes (en Costa Rica). */
export function esDiaHabil(d: Date): boolean {
  const dia = partesCR(d).diaSemana;
  return dia >= 1 && dia <= 5;
}

export function sumarMinutos(d: Date, m: number): Date {
  return new Date(d.getTime() + m * MS_MIN);
}

const apertura = (d: Date) => enCR(partesCR(d).fecha, `${dos(HORA_INICIO)}:00`);
const cierre = (d: Date) => enCR(partesCR(d).fecha, `${dos(HORA_FIN)}:00`);

/** Salta noches y fines de semana (jornada 7:00–17:00). Si `d` cae fuera de jornada, empieza en la próxima apertura. */
export function sumarHorasLaborales(d: Date, h: number): Date {
  let restante = Math.round(h * 60); // minutos
  if (restante <= 0) return d;
  let actual = d;
  for (;;) {
    if (!esDiaHabil(actual) || actual.getTime() >= cierre(actual).getTime()) {
      actual = apertura(siguienteDiaHabil(actual));
      continue;
    }
    if (actual.getTime() < apertura(actual).getTime()) {
      actual = apertura(actual);
      continue;
    }
    const disponible = (cierre(actual).getTime() - actual.getTime()) / MS_MIN;
    if (restante <= disponible) return sumarMinutos(actual, restante);
    restante -= disponible;
    actual = cierre(actual);
  }
}

/** Conserva la hora. n negativo retrocede. */
export function sumarDiasHabiles(d: Date, n: number): Date {
  const paso = n < 0 ? -MS_DIA : MS_DIA;
  let faltan = Math.abs(n);
  let actual = d;
  while (faltan > 0) {
    actual = new Date(actual.getTime() + paso);
    if (esDiaHabil(actual)) faltan -= 1;
  }
  return actual;
}

/** Días hábiles entre fechas de calendario de Costa Rica, b ≥ a (cuenta los días en (a, b]). */
export function diasHabilesEntre(a: Date, b: Date): number {
  const fa = partesCR(a).fecha;
  const fb = partesCR(b).fecha;
  let cursor = Date.UTC(+fa.slice(0, 4), +fa.slice(5, 7) - 1, +fa.slice(8, 10));
  const fin = Date.UTC(+fb.slice(0, 4), +fb.slice(5, 7) - 1, +fb.slice(8, 10));
  let cuenta = 0;
  for (cursor += MS_DIA; cursor <= fin; cursor += MS_DIA) {
    const dia = new Date(cursor).getUTCDay();
    if (dia >= 1 && dia <= 5) cuenta += 1;
  }
  return cuenta;
}

/** Mismo reloj, día hábil siguiente. */
export function siguienteDiaHabil(d: Date): Date {
  return sumarDiasHabiles(d, 1);
}

/** Ver §4.1 de docs/05: con hora → ese día a esa hora; 'hoy' urgente → 12:00 o 17:00; 'manana' → siguiente día hábil 17:00. */
export function resolverPlazo(p: PlazoPropuesto, urgente: boolean, ahora: Date): Date {
  const hoy = partesCR(ahora);
  let fecha: string;
  if (p.dia === 'hoy') fecha = hoy.fecha;
  else if (p.dia === 'manana') fecha = partesCR(siguienteDiaHabil(ahora)).fecha;
  else fecha = p.dia;

  if (p.hora) return enCR(fecha, p.hora);
  if (p.dia === 'hoy' && urgente && hoy.hora < HORA_PLAZO_URGENTE_HOY) return enCR(fecha, HORA_PLAZO_URGENTE_HOY);
  return enCR(fecha, HORA_PLAZO_SIN_HORA);
}
