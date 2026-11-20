// Formato para la interfaz. Tarea 1.3.
import { partesCR } from '@/dominio/tiempo';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 1380000 → '₡1.380.000' */
export function formatearColones(n: number): string {
  const r = Math.round(Math.abs(n));
  const grupos = String(r).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 && r > 0 ? '-' : ''}₡${grupos}`;
}

/** 'mié 25 nov, 15:00' (hora de Costa Rica) */
export function formatearFecha(d: Date): string {
  const { fecha, hora, diaSemana } = partesCR(d);
  const dia = Number(fecha.slice(8, 10));
  const mes = Number(fecha.slice(5, 7)) - 1;
  return `${DIAS[diaSemana]} ${dia} ${MESES[mes]}, ${hora}`;
}

/** 205 → '3,4 h' */
export function formatearHoras(min: number): string {
  return `${(min / 60).toFixed(1).replace('.', ',')} h`;
}
