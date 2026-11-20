// Las tres cifras de la demo (03 §5, §5 de docs/05). Puro. Tarea 4.4.
import { MIN_POR_PREGUNTA, MIN_POR_SEGUIMIENTO } from '@/dominio/constantes';
import type { Accion, Cifras, Evento, Trabajo } from '@/dominio/tipos';
import { TIPOS_ACCION_SEGUIMIENTO } from '@/dominio/tipos';

export function calcularCifras(d: {
  trabajos: Trabajo[];
  eventos: Evento[];
  acciones: Accion[];
  preguntasRespondidas: number;
  gerenteId: string;
}): Cifras {
  // Cifra 1: resueltos sin ningún evento de la gerente sobre ese trabajo (en cualquier fecha).
  const intervenidos = new Set(
    d.eventos.filter((e) => e.actorId === d.gerenteId && e.trabajoId !== null).map((e) => e.trabajoId as string),
  );
  const resueltos = d.trabajos.filter((t) => t.estado === 'resuelto');
  const resueltosSinGerente = resueltos.filter((t) => !intervenidos.has(t.id)).length;
  const resueltosTotal = resueltos.length;
  const porcentaje = resueltosTotal === 0 ? 0 : Math.round((resueltosSinGerente / resueltosTotal) * 100);

  // Cifra 2: acciones de seguimiento hechas por Nexo.
  const tiposSeguimiento: readonly string[] = TIPOS_ACCION_SEGUIMIENTO;
  const seguimientos = d.acciones.filter((a) => tiposSeguimiento.includes(a.tipo)).length;

  // Cifra 3: estimación en minutos (hipótesis, no medición) y horas con un decimal.
  const minutosAhorrados = seguimientos * MIN_POR_SEGUIMIENTO + d.preguntasRespondidas * MIN_POR_PREGUNTA;
  const horasAhorradas = Math.round(minutosAhorrados / 6) / 10;

  return {
    resueltosSinGerente,
    resueltosTotal,
    porcentaje,
    seguimientos,
    preguntasRespondidas: d.preguntasRespondidas,
    minutosAhorrados,
    horasAhorradas,
  };
}
