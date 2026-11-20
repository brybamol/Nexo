// Las tres cifras de la demo (03 §5, §5 de docs/05). Puro. Tarea 4.4.
import type { Accion, Cifras, Evento, Trabajo } from '@/dominio/tipos';

export function calcularCifras(d: {
  trabajos: Trabajo[];
  eventos: Evento[];
  acciones: Accion[];
  preguntasRespondidas: number;
  gerenteId: string;
}): Cifras {
  void d;
  return {
    resueltosSinGerente: 0,
    resueltosTotal: 0,
    porcentaje: 0,
    seguimientos: 0,
    preguntasRespondidas: 0,
    minutosAhorrados: 0,
    horasAhorradas: 0,
  };
}
