// Datos de Frío del Valle (docs/04, §3.3 de docs/05) como constantes tipadas. Tarea 1.4.
import type { notas } from '@/db/esquema';
import { enCR } from '@/dominio/tiempo';
import { PERSONAS, PROYECTOS, REPUESTOS } from '@/dominio/constantes';
import type {
  Dependencia,
  EstadoTrabajo,
  EventoNuevo,
  NecesidadRepuesto,
  Persona,
  Proyecto,
  Repuesto,
  Trabajo,
} from '@/dominio/tipos';

// Días de la semana de la demo (lun 23 a vie 27 de noviembre de 2026).
const LUN_23 = '2026-11-23';
const MAR_24 = '2026-11-24';
const MIE_25 = '2026-11-25';
const JUE_26 = '2026-11-26';
const VIE_27 = '2026-11-27';
const LUN_30 = '2026-11-30';

const CREADO_EN = enCR(LUN_23, '07:00');

/** Trabajo de la semilla: origen 'semilla', sin solicitante, sin bloqueo, sin repuesto propio. */
function trabajo(
  id: string,
  proyectoId: string,
  titulo: string,
  responsableId: string,
  plazo: Date,
  estado: EstadoTrabajo,
  etiqueta: string | null = null,
): Trabajo {
  return {
    id,
    proyectoId,
    titulo,
    responsableId,
    solicitadoPorId: null,
    plazo,
    estado,
    urgente: false,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: null,
    cantidadRepuesto: null,
    etiqueta,
    relacionados: [],
    origen: 'semilla',
    capturaId: null,
    decisionId: null,
    creadoEn: CREADO_EN,
    resueltoEn: estado === 'resuelto' ? plazo : null,
  };
}

export const PERSONAS_SEMILLA: Persona[] = [
  { id: PERSONAS.marcela, nombre: 'Marcela Solís', rol: 'Gerente general', area: 'Gerencia', jefeId: null },
  { id: PERSONAS.andres, nombre: 'Andrés Vargas', rol: 'Jefe de operaciones', area: 'Gerencia', jefeId: PERSONAS.marcela },
  { id: PERSONAS.ricardo, nombre: 'Ricardo Brenes', rol: 'Contabilidad y facturación', area: 'Oficina', jefeId: PERSONAS.marcela },
  { id: PERSONAS.paola, nombre: 'Paola Herrera', rol: 'Ejecutiva de ventas', area: 'Oficina', jefeId: PERSONAS.andres },
  { id: PERSONAS.sofia, nombre: 'Sofía Navarro', rol: 'Servicio al cliente', area: 'Oficina', jefeId: PERSONAS.andres },
  { id: PERSONAS.karla, nombre: 'Karla Jiménez', rol: 'Encargada de compras', area: 'Oficina', jefeId: PERSONAS.andres },
  { id: PERSONAS.lucia, nombre: 'Lucía Mora', rol: 'Supervisora de bodega', area: 'Bodega', jefeId: PERSONAS.andres },
  { id: PERSONAS.diego, nombre: 'Diego Rojas', rol: 'Bodeguero y despacho', area: 'Bodega', jefeId: PERSONAS.lucia },
  { id: PERSONAS.esteban, nombre: 'Esteban Castro', rol: 'Supervisor de campo', area: 'Campo', jefeId: PERSONAS.andres },
  { id: PERSONAS.jose, nombre: 'José Alfaro', rol: 'Técnico', area: 'Campo', jefeId: PERSONAS.esteban },
  { id: PERSONAS.daniela, nombre: 'Daniela Quesada', rol: 'Técnica', area: 'Campo', jefeId: PERSONAS.esteban },
  { id: PERSONAS.mario, nombre: 'Mario Chaves', rol: 'Técnico', area: 'Campo', jefeId: PERSONAS.esteban },
];

export const PROYECTOS_SEMILLA: Proyecto[] = [
  {
    id: PROYECTOS.camaraFria,
    nombre: 'Cámara fría La Colina',
    resultado: 'Cámara fría instalada y entregada al Supermercado La Colina',
    responsableId: PERSONAS.esteban,
    fecha: enCR(VIE_27, '17:00'),
    cliente: 'Supermercado La Colina',
  },
  {
    id: PROYECTOS.trigal,
    nombre: 'Mantenimiento Trigal',
    resultado: 'Mantenimiento trimestral de los 6 locales de Panadería Trigal',
    responsableId: PERSONAS.daniela,
    fecha: enCR(LUN_30, '17:00'),
    cliente: 'Panadería Trigal',
  },
  {
    id: PROYECTOS.repuestos,
    nombre: 'Repuestos críticos',
    resultado: 'Inventario conciliado y reorden de repuestos críticos aprobado',
    responsableId: PERSONAS.lucia,
    fecha: enCR(LUN_30, '17:00'),
    cliente: null,
  },
  {
    id: PROYECTOS.pedidos,
    nombre: 'Pedidos de la semana',
    resultado: 'Los 7 pedidos de la semana entregados y facturados',
    responsableId: PERSONAS.andres,
    fecha: enCR(VIE_27, '17:00'),
    cliente: null,
  },
  {
    id: PROYECTOS.operacionDiaria,
    nombre: 'Operación diaria',
    resultado: 'Trabajos sueltos que no pertenecen a un proyecto',
    responsableId: PERSONAS.andres,
    fecha: null,
    cliente: null,
  },
];

export const REPUESTOS_SEMILLA: Repuesto[] = [
  {
    id: REPUESTOS.compresor,
    nombre: 'Compresor de 2 HP',
    unidad: 'unidad',
    existencia: 3, // según el sistema; en bodega hay 0 (T15)
    precioHabitual: 380_000,
    diasHabitual: 6,
    precioLocal: 460_000,
    faltanteReportadoEn: null,
    faltanteReportadoPor: null,
  },
  {
    id: REPUESTOS.termostato,
    nombre: 'Termostato digital',
    unidad: 'unidad',
    existencia: 12,
    precioHabitual: 18_000,
    diasHabitual: 3,
    precioLocal: 24_000,
    faltanteReportadoEn: null,
    faltanteReportadoPor: null,
  },
  {
    id: REPUESTOS.empaque,
    nombre: 'Empaque de puerta',
    unidad: 'metro',
    existencia: 40,
    precioHabitual: 3_500,
    diasHabitual: 3,
    precioLocal: 4_200,
    faltanteReportadoEn: null,
    faltanteReportadoPor: null,
  },
  {
    id: REPUESTOS.gas,
    nombre: 'Gas refrigerante',
    unidad: 'cilindro',
    existencia: 4,
    precioHabitual: 95_000,
    diasHabitual: 3,
    precioLocal: 110_000,
    faltanteReportadoEn: null,
    faltanteReportadoPor: null,
  },
  {
    id: REPUESTOS.motorVentilador,
    nombre: 'Motor de ventilador',
    unidad: 'unidad',
    existencia: 6,
    precioHabitual: 42_000,
    diasHabitual: 6,
    precioLocal: 55_000,
    faltanteReportadoEn: null,
    faltanteReportadoPor: null,
  },
];

const P1 = PROYECTOS.camaraFria;
const P2 = PROYECTOS.trigal;
const P3 = PROYECTOS.repuestos;
const P4 = PROYECTOS.pedidos;

export const TRABAJOS_SEMILLA: Trabajo[] = [
  // P1 · Cámara fría La Colina
  trabajo('T01', P1, 'Visita técnica y medidas', PERSONAS.jose, enCR(LUN_23, '17:00'), 'resuelto'),
  trabajo('T02', P1, 'Preparar paneles y materiales en bodega', PERSONAS.diego, enCR(MAR_24, '17:00'), 'resuelto'),
  trabajo('T03', P1, 'Montar paneles y puerta', PERSONAS.jose, enCR(MAR_24, '17:00'), 'resuelto'),
  trabajo('T04', P1, 'Instalar unidad condensadora y compresor', PERSONAS.jose, enCR(MIE_25, '17:00'), 'en_curso'),
  trabajo('T05', P1, 'Cableado y tablero de control', PERSONAS.mario, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T06', P1, 'Prueba de frío y entrega al cliente', PERSONAS.esteban, enCR(VIE_27, '17:00'), 'abierto'),
  trabajo('T07', P1, 'Facturar la instalación', PERSONAS.ricardo, enCR(VIE_27, '17:00'), 'abierto'),

  // P2 · Mantenimiento Trigal
  trabajo('T08', P2, 'Agendar visitas con los 6 locales', PERSONAS.sofia, enCR(LUN_23, '17:00'), 'resuelto'),
  trabajo('T09', P2, 'Mantenimiento en Heredia y Alajuela', PERSONAS.daniela, enCR(MAR_24, '17:00'), 'resuelto'),
  trabajo('T10', P2, 'Cambiar compresor en local Cartago', PERSONAS.daniela, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T11', P2, 'Cambiar compresor en local Curridabat', PERSONAS.mario, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T12', P2, 'Mantenimiento en Escazú y Tibás', PERSONAS.daniela, enCR(VIE_27, '17:00'), 'abierto'),
  trabajo('T13', P2, 'Informe de mantenimiento al cliente', PERSONAS.sofia, enCR(LUN_30, '17:00'), 'abierto'),

  // P3 · Repuestos críticos
  trabajo('T14', P3, 'Conteo físico de repuestos críticos', PERSONAS.diego, enCR(LUN_23, '17:00'), 'resuelto'),
  trabajo('T15', P3, 'Conciliar el conteo con el sistema', PERSONAS.lucia, enCR(MAR_24, '17:00'), 'abierto', 'conciliacion_inventario'),
  trabajo('T16', P3, 'Definir mínimos por repuesto', PERSONAS.lucia, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T17', P3, 'Cotizar el reorden con dos proveedores', PERSONAS.karla, enCR(VIE_27, '17:00'), 'abierto'),
  trabajo('T18', P3, 'Aprobar la compra de reorden', PERSONAS.marcela, enCR(LUN_30, '17:00'), 'abierto'),

  // P4 · Pedidos de la semana
  trabajo('T19', P4, 'Entregar pedido 1041 · vitrina · Soda El Roble', PERSONAS.diego, enCR(LUN_23, '17:00'), 'resuelto'),
  trabajo('T20', P4, 'Entregar pedido 1042 · repuestos · Hotel Mirador', PERSONAS.diego, enCR(MAR_24, '17:00'), 'resuelto'),
  trabajo('T21', P4, 'Entregar pedido 1043 · 2 congeladores · Minisúper Don Beto', PERSONAS.diego, enCR(MAR_24, '17:00'), 'abierto'),
  trabajo('T22', P4, 'Reprogramar la entrega 1043 con el cliente', PERSONAS.sofia, enCR(MIE_25, '10:00'), 'abierto'),
  trabajo('T23', P4, 'Entregar pedido 1044 · cámara modular · Carnicería San Rafael', PERSONAS.diego, enCR(MIE_25, '14:00'), 'en_curso'),
  trabajo('T24', P4, 'Entregar pedido 1045 · vitrina · Trigal Heredia', PERSONAS.diego, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T25', P4, 'Entregar pedido 1046 · termostatos y empaques · Restaurante Mar Azul', PERSONAS.diego, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T26', P4, 'Entregar pedido 1047 · 3 vitrinas · Supermercado La Colina', PERSONAS.diego, enCR(VIE_27, '17:00'), 'abierto'),
  trabajo('T27', P4, 'Confirmar el pago anticipado del pedido 1047', PERSONAS.ricardo, enCR(JUE_26, '17:00'), 'abierto'),
  trabajo('T28', P4, 'Enviar cotización de cámara fría a Hotel Mirador', PERSONAS.paola, enCR(MIE_25, '12:00'), 'abierto'),
  trabajo('T29', P4, 'Revisar la ruta de entregas del jueves', PERSONAS.andres, enCR(MIE_25, '16:00'), 'abierto'),
  trabajo('T30', P4, 'Facturar los pedidos entregados de la semana', PERSONAS.ricardo, enCR(VIE_27, '17:00'), 'abierto'),
];

/** `trabajoId` depende de `dependeDeId` (docs/04 §3, columna «Depende de»). */
export const DEPENDENCIAS_SEMILLA: Dependencia[] = [
  { trabajoId: 'T02', dependeDeId: 'T01' },
  { trabajoId: 'T03', dependeDeId: 'T02' },
  { trabajoId: 'T04', dependeDeId: 'T03' },
  { trabajoId: 'T05', dependeDeId: 'T04' },
  { trabajoId: 'T06', dependeDeId: 'T05' },
  { trabajoId: 'T07', dependeDeId: 'T06' },
  { trabajoId: 'T09', dependeDeId: 'T08' },
  { trabajoId: 'T10', dependeDeId: 'T08' },
  { trabajoId: 'T11', dependeDeId: 'T08' },
  { trabajoId: 'T12', dependeDeId: 'T08' },
  { trabajoId: 'T13', dependeDeId: 'T10' },
  { trabajoId: 'T13', dependeDeId: 'T11' },
  { trabajoId: 'T13', dependeDeId: 'T12' },
  { trabajoId: 'T15', dependeDeId: 'T14' },
  { trabajoId: 'T16', dependeDeId: 'T15' },
  { trabajoId: 'T17', dependeDeId: 'T16' },
  { trabajoId: 'T18', dependeDeId: 'T17' },
  { trabajoId: 'T21', dependeDeId: 'T22' },
  { trabajoId: 'T26', dependeDeId: 'T27' },
];

export const NECESIDADES_SEMILLA: NecesidadRepuesto[] = [
  { trabajoId: 'T04', repuestoId: REPUESTOS.compresor, cantidad: 1, fechaDisponible: null, atendida: false },
  { trabajoId: 'T10', repuestoId: REPUESTOS.compresor, cantidad: 1, fechaDisponible: null, atendida: false },
  { trabajoId: 'T11', repuestoId: REPUESTOS.compresor, cantidad: 1, fechaDisponible: null, atendida: false },
  { trabajoId: 'T25', repuestoId: REPUESTOS.termostato, cantidad: 4, fechaDisponible: null, atendida: false },
  { trabajoId: 'T25', repuestoId: REPUESTOS.empaque, cantidad: 10, fechaDisponible: null, atendida: false },
];

/** Historial inicial (§3.3): notas de la gerente en T19 y T20, la de Diego en T21 (04), y sus eventos nota_agregada. */
export const NOTAS_SEMILLA: (typeof notas.$inferInsert)[] = [
  { trabajoId: 'T19', autorId: PERSONAS.marcela, en: enCR(LUN_23, '10:00'), texto: 'Confirmé con Soda El Roble la hora de entrega' },
  { trabajoId: 'T20', autorId: PERSONAS.marcela, en: enCR(MAR_24, '10:00'), texto: 'Pedí priorizar al Hotel Mirador' },
  {
    trabajoId: 'T21',
    autorId: PERSONAS.diego,
    en: enCR(MAR_24, '15:30'),
    texto: 'El cliente estaba cerrado el martes; los congeladores volvieron a bodega',
  },
];

export const EVENTOS_SEMILLA: EventoNuevo[] = [
  {
    en: enCR(LUN_23, '10:00'),
    actorId: PERSONAS.marcela,
    tipo: 'nota_agregada',
    trabajoId: 'T19',
    decisionId: null,
    datos: {},
  },
  {
    en: enCR(MAR_24, '10:00'),
    actorId: PERSONAS.marcela,
    tipo: 'nota_agregada',
    trabajoId: 'T20',
    decisionId: null,
    datos: {},
  },
  {
    en: enCR(MAR_24, '15:30'),
    actorId: PERSONAS.diego,
    tipo: 'nota_agregada',
    trabajoId: 'T21',
    decisionId: null,
    datos: {},
  },
];
