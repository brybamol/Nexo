// Respuestas guardadas del intérprete Local: C01–C15, E1 y E5 como funciones del contexto. Tarea 2.1.
import { UMBRAL_SIMILITUD } from '@/dominio/constantes';
import { normalizar, similitud } from '@/dominio/texto';
import { partesCR } from '@/dominio/tiempo';
import type { ContextoCaptura, Interpretacion } from '@/ia/interprete';

export interface RespuestaGuardada {
  id: string; // 'C01'…'C15', 'E1', 'E5'
  frase: string;
  /** Resuelve ids dinámicos desde el contexto; null si no aplica en este estado. */
  construir(ctx: ContextoCaptura): Interpretacion | null;
}

const DIA_JUEVES = 4;
const DIA_VIERNES = 5;
const MS_DIA = 24 * 60 * 60 * 1000;

/** Fecha 'AAAA-MM-DD' (CR) del próximo día de la semana indicado (0 = domingo), estrictamente después de hoy. */
function proximoDia(ahora: string, diaSemana: number): string {
  let d = new Date(ahora);
  for (let i = 0; i < 8; i++) {
    d = new Date(d.getTime() + MS_DIA);
    if (partesCR(d).diaSemana === diaSemana) return partesCR(d).fecha;
  }
  return partesCR(d).fecha;
}

const abierto = (ctx: ContextoCaptura, id: string) => ctx.trabajosAbiertos.some((t) => t.id === id);

const trabajoNuevoBase = {
  tipo: 'trabajo_nuevo' as const,
  responsableSeguro: true,
  urgente: false,
  conCostoProbable: false,
  relacionados: [] as string[],
  bloquea: [] as string[],
  repuestoFaltante: null,
};

const actualizacionBase = {
  tipo: 'actualizacion' as const,
  nuevoEstado: null,
  nota: null,
  hayProblema: false,
  reprogramar: [] as { trabajoId: string; plazo: { dia: string; hora?: string } }[],
  notasRelacionadas: [] as { trabajoId: string; nota: string }[],
};

export const RESPUESTAS_GUARDADAS: RespuestaGuardada[] = [
  {
    id: 'C01',
    frase: 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP',
    construir: () => ({
      ...trabajoNuevoBase,
      titulo: 'Conseguir compresor de 2 HP',
      proyectoId: 'P1',
      responsableId: 'lucia-mora',
      plazo: { dia: 'hoy' },
      urgente: true,
      bloquea: ['T04'],
      repuestoFaltante: { repuestoId: 'compresor-2hp' },
    }),
  },
  {
    id: 'C02',
    frase: 'Listo el mantenimiento de Escazú, Tibás queda para mañana',
    construir: (ctx) =>
      abierto(ctx, 'T12')
        ? {
            ...actualizacionBase,
            trabajoId: 'T12',
            nuevoEstado: 'en_curso',
            nota: 'Listo el mantenimiento de Escazú; Tibás queda para mañana.',
          }
        : null,
  },
  {
    id: 'C03',
    frase: 'Mae, el cliente de Don Beto no estaba, me devolví con los congeladores',
    construir: (ctx) =>
      abierto(ctx, 'T21')
        ? {
            ...actualizacionBase,
            trabajoId: 'T21',
            nota: 'El cliente de Don Beto no estaba; se devolvieron los congeladores a bodega.',
            hayProblema: true,
          }
        : null,
  },
  {
    id: 'C04',
    frase: 'Hay que mandarle la cotización de la cámara fría al Hotel Mirador hoy',
    construir: (ctx) => (abierto(ctx, 'T28') ? { tipo: 'duplicado', trabajoId: 'T28' } : null),
  },
  {
    id: 'C05',
    frase: 'La Colina pregunta si se puede adelantar la entrega de las vitrinas al jueves',
    construir: () => ({
      ...trabajoNuevoBase,
      titulo: 'Responder a La Colina sobre adelantar la entrega del pedido 1047 al jueves',
      proyectoId: 'P4',
      responsableId: 'andres-vargas',
      plazo: { dia: 'hoy' },
      relacionados: ['T26', 'T27'],
    }),
  },
  {
    id: 'C06',
    frase: 'El proveedor subió el precio de los empaques un 12 %, ¿compramos igual?',
    construir: () => ({
      tipo: 'decision',
      proyectoId: 'P3',
      resumen: 'El proveedor subió el precio de los empaques de puerta un 12 %: decidir si se compra igual.',
      compra: { repuestoId: 'empaque-puerta', cantidad: null, proveedor: null, ajustePrecioPct: 12 },
      existenciaReal: null,
      trabajoRelacionadoId: null,
    }),
  },
  {
    id: 'C07',
    frase: 'Gracias a todos, buen trabajo ayer',
    construir: () => ({ tipo: 'no_es_trabajo', motivo: 'Es un agradecimiento; no hay nada que hacer.' }),
  },
  {
    id: 'C08',
    frase: 'Ocupo una escalera de 6 metros para el jueves en Curridabat',
    construir: (ctx) => ({
      ...trabajoNuevoBase,
      titulo: 'Conseguir escalera de 6 metros para Curridabat',
      proyectoId: 'P2',
      responsableId: 'lucia-mora',
      plazo: { dia: proximoDia(ctx.ahora, DIA_JUEVES), hora: '07:00' },
      relacionados: ['T11'],
    }),
  },
  {
    id: 'C09',
    frase: 'Todavía no entra el pago de La Colina por las vitrinas',
    construir: (ctx) =>
      abierto(ctx, 'T27')
        ? {
            ...actualizacionBase,
            trabajoId: 'T27',
            nota: 'Todavía no entra el pago de La Colina por las vitrinas.',
            hayProblema: true,
          }
        : null,
  },
  {
    id: 'C10',
    frase: 'Alguien tiene que revisar el camión, hace un ruido raro',
    construir: () => ({
      ...trabajoNuevoBase,
      titulo: 'Revisar el camión: hace un ruido raro',
      proyectoId: 'OD',
      responsableId: 'lucia-mora',
      responsableSeguro: false,
      plazo: { dia: 'hoy' },
    }),
  },
  {
    id: 'C11',
    frase: 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local',
    construir: (ctx) => ({
      tipo: 'decision',
      proyectoId: 'P1',
      resumen: 'No hay compresores de 2 HP; se propone comprar 3 de urgencia al proveedor local.',
      compra: { repuestoId: 'compresor-2hp', cantidad: 3, proveedor: 'local', ajustePrecioPct: null },
      existenciaReal: 0,
      trabajoRelacionadoId:
        ctx.trabajosAbiertos.find((t) => t.responsableId === ctx.autor.id && t.repuestoId === 'compresor-2hp')?.id ?? null,
    }),
  },
  {
    id: 'C12',
    frase: 'En Cartago el cliente quiere que también le revisemos el aire acondicionado',
    construir: (ctx) => ({
      ...trabajoNuevoBase,
      titulo: 'Cotizar la revisión del aire acondicionado en Cartago',
      proyectoId: 'P2',
      responsableId: 'paola-herrera',
      plazo: { dia: proximoDia(ctx.ahora, DIA_VIERNES) },
    }),
  },
  {
    id: 'C13',
    frase: '¿Cómo vamos con los pedidos de la semana?',
    construir: () => ({ tipo: 'pregunta', pregunta: '¿Cómo vamos con los pedidos de la semana?' }),
  },
  {
    id: 'C14',
    frase: 'Ya llegó el compresor, sigo con la instalación',
    construir: (ctx) => {
      // El trabajo abierto que bloquea al de la instalación (el creado en C01).
      const bloqueado = ctx.trabajosAbiertos.find((t) => t.id === 'T04');
      const bloqueante = bloqueado?.bloqueadoPorId;
      if (!bloqueante || !abierto(ctx, bloqueante)) return null;
      return {
        ...actualizacionBase,
        trabajoId: bloqueante,
        nuevoEstado: 'resuelto',
        nota: 'Ya llegó el compresor; sigue la instalación.',
      };
    },
  },
  {
    id: 'C15',
    frase: 'Se cayó una vitrina del pedido 1045 en bodega, quedó con el vidrio quebrado',
    construir: () => ({
      ...trabajoNuevoBase,
      titulo: 'Resolver la vitrina dañada del pedido 1045',
      proyectoId: 'P4',
      responsableId: 'lucia-mora',
      plazo: { dia: 'hoy' },
      urgente: true,
      conCostoProbable: true,
      bloquea: ['T24'],
    }),
  },
  {
    id: 'E1',
    frase: 'Ya la envié',
    construir: (ctx) => {
      const pendientes = ctx.seguimientosPendientesDelAutor;
      if (pendientes.length !== 1) return null;
      return { ...actualizacionBase, trabajoId: pendientes[0]!, nuevoEstado: 'resuelto', nota: 'Ya la envié.' };
    },
  },
  {
    id: 'E5',
    frase: 'Don Beto recibe mañana jueves en la mañana',
    construir: (ctx) => {
      if (!abierto(ctx, 'T22') || !abierto(ctx, 'T21')) return null;
      return {
        ...actualizacionBase,
        trabajoId: 'T22',
        nuevoEstado: 'resuelto',
        nota: 'Don Beto recibe mañana jueves en la mañana.',
        reprogramar: [{ trabajoId: 'T21', plazo: { dia: proximoDia(ctx.ahora, DIA_JUEVES), hora: '12:00' } }],
        notasRelacionadas: abierto(ctx, 'T29')
          ? [{ trabajoId: 'T29', nota: 'Don Beto recibe los congeladores el jueves en la mañana: incluirlo en la ruta.' }]
          : [],
      };
    },
  },
];

/** Coincidencia exacta tras normalizar; si no, la de mayor similitud ≥ UMBRAL_SIMILITUD. */
export function buscarRespuestaGuardada(texto: string, ctx: ContextoCaptura): Interpretacion | null {
  const buscado = normalizar(texto);
  if (buscado === '') return null;
  let mejor: RespuestaGuardada | null = null;
  let mejorPuntaje = 0;
  for (const r of RESPUESTAS_GUARDADAS) {
    const puntaje = normalizar(r.frase) === buscado ? 1 : similitud(texto, r.frase);
    if (puntaje > mejorPuntaje) {
      mejor = r;
      mejorPuntaje = puntaje;
    }
  }
  if (!mejor || mejorPuntaje < UMBRAL_SIMILITUD) return null;
  return mejor.construir(ctx);
}
