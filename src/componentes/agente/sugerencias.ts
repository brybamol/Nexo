// Arranques del panel de Nexo. Solo datos: el componente pone los iconos.
// Las de un clic se envían sin que la persona las revise, por eso solo pueden ser preguntas (no cambian nada).
// tests/captura/sugerencias-agente.test.ts fija que el intérprete Local las responde y no crea trabajos.
import type { TemaPregunta } from '@/ia/interprete';

export type SugerenciaPregunta = { texto: string; tema: Exclude<TemaPregunta, 'desconocido'> };

export const SUGERENCIAS_PREGUNTA: readonly SugerenciaPregunta[] = [
  { texto: '¿Qué tengo pendiente?', tema: 'mis_pendientes' },
  { texto: '¿Qué está atrasado o en riesgo?', tema: 'atrasados' },
  { texto: '¿Cómo vamos con los pedidos de la semana?', tema: 'pedidos_semana' },
  { texto: '¿Cómo van los proyectos?', tema: 'estado_proyectos' },
];

/** Arranques que solo rellenan la caja: la persona termina la frase y decide si la envía. */
export const ARRANQUES_FRASE: readonly { etiqueta: string; texto: string }[] = [
  { etiqueta: 'Contar un problema', texto: 'No puedo avanzar con ' },
  { etiqueta: 'Pedir algo a alguien', texto: 'Necesito que ' },
  { etiqueta: 'Proponer una compra', texto: 'Propongo comprar ' },
];
