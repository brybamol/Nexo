// Pruebas de 2.1: intérprete Local (respuestas guardadas + heurísticas). Sin red, sin base de datos.
import { describe, expect, it } from 'vitest';
import { esquemaInterpretacion } from '@/ia/esquema-interpretacion';
import type { ContextoCaptura, Interpretacion } from '@/ia/interprete';
import { interpretarPorHeuristicas } from '@/ia/local/heuristicas';
import { InterpreteLocal } from '@/ia/local/interprete-local';
import { RESPUESTAS_GUARDADAS } from '@/ia/local/respuestas-guardadas';

type Persona = ContextoCaptura['personas'][number];
const p = (id: string, nombre: string, rol: string, area: Persona['area'], jefeId: string | null): Persona => ({
  id,
  nombre,
  rol,
  area,
  jefeId,
});

const PERSONAS: Persona[] = [
  p('marcela-solis', 'Marcela Solís', 'Gerente general', 'Gerencia', null),
  p('andres-vargas', 'Andrés Vargas', 'Jefe de operaciones', 'Gerencia', 'marcela-solis'),
  p('ricardo-brenes', 'Ricardo Brenes', 'Contabilidad y facturación', 'Oficina', 'marcela-solis'),
  p('paola-herrera', 'Paola Herrera', 'Ejecutiva de ventas', 'Oficina', 'andres-vargas'),
  p('sofia-navarro', 'Sofía Navarro', 'Servicio al cliente', 'Oficina', 'andres-vargas'),
  p('karla-jimenez', 'Karla Jiménez', 'Encargada de compras', 'Oficina', 'andres-vargas'),
  p('lucia-mora', 'Lucía Mora', 'Supervisora de bodega', 'Bodega', 'andres-vargas'),
  p('diego-rojas', 'Diego Rojas', 'Bodeguero y despacho', 'Bodega', 'lucia-mora'),
  p('esteban-castro', 'Esteban Castro', 'Supervisor de campo', 'Campo', 'andres-vargas'),
  p('jose-alfaro', 'José Alfaro', 'Técnico', 'Campo', 'esteban-castro'),
  p('daniela-quesada', 'Daniela Quesada', 'Técnica', 'Campo', 'esteban-castro'),
  p('mario-chaves', 'Mario Chaves', 'Técnico', 'Campo', 'esteban-castro'),
];

type TrabajoCtx = ContextoCaptura['trabajosAbiertos'][number];
const t = (id: string, titulo: string, proyectoId: string, responsableId: string, extra: Partial<TrabajoCtx> = {}): TrabajoCtx => ({
  id,
  titulo,
  proyectoId,
  responsableId,
  estado: 'abierto',
  plazo: '2026-11-25T17:00:00-06:00',
  bloqueadoPorId: null,
  repuestoId: null,
  ...extra,
});

const TRABAJOS: TrabajoCtx[] = [
  t('T04', 'Instalar unidad condensadora y compresor', 'P1', 'jose-alfaro', { estado: 'en_curso', repuestoId: 'compresor-2hp' }),
  t('T12', 'Mantenimiento en Escazú y Tibás', 'P2', 'daniela-quesada'),
  t('T21', 'Entregar pedido 1043 · 2 congeladores · Minisúper Don Beto', 'P4', 'diego-rojas'),
  t('T22', 'Reprogramar la entrega 1043 con el cliente', 'P4', 'sofia-navarro'),
  t('T26', 'Entregar pedido 1047 · 3 vitrinas · Supermercado La Colina', 'P4', 'diego-rojas'),
  t('T27', 'Confirmar el pago anticipado del pedido 1047', 'P4', 'ricardo-brenes'),
  t('T28', 'Enviar cotización de cámara fría a Hotel Mirador', 'P4', 'paola-herrera', { plazo: '2026-11-25T12:00:00-06:00' }),
  t('T29', 'Revisar la ruta de entregas del jueves', 'P4', 'andres-vargas'),
];

function ctxDe(autorId: string, extra: Partial<ContextoCaptura> = {}): ContextoCaptura {
  const a = PERSONAS.find((x) => x.id === autorId)!;
  return {
    ahora: '2026-11-25T07:05:00-06:00',
    autor: { id: a.id, nombre: a.nombre, rol: a.rol, area: a.area },
    personas: PERSONAS,
    proyectos: [
      { id: 'P1', nombre: 'Cámara fría La Colina', responsableId: 'esteban-castro' },
      { id: 'P2', nombre: 'Mantenimiento Trigal', responsableId: 'daniela-quesada' },
      { id: 'P3', nombre: 'Repuestos críticos', responsableId: 'lucia-mora' },
      { id: 'P4', nombre: 'Pedidos de la semana', responsableId: 'andres-vargas' },
      { id: 'OD', nombre: 'Operación diaria', responsableId: 'andres-vargas' },
    ],
    trabajosAbiertos: TRABAJOS,
    repuestos: [
      { id: 'compresor-2hp', nombre: 'Compresor de 2 HP', existencia: 3 },
      { id: 'empaque-puerta', nombre: 'Empaque de puerta (metro)', existencia: 40 },
    ],
    seguimientosPendientesDelAutor: [],
    ...extra,
  };
}

const local = new InterpreteLocal();

async function interpretar(texto: string, ctx: ContextoCaptura): Promise<Interpretacion> {
  const r = await local.interpretar(texto, ctx);
  expect(r.implementacion).toBe('local');
  expect(r.modelo).toBeNull();
  expect(r.respaldo).toBe(false);
  expect(esquemaInterpretacion.safeParse(r.valor).success).toBe(true);
  return r.valor;
}

function de<T extends Interpretacion['tipo']>(i: Interpretacion, tipo: T): Extract<Interpretacion, { tipo: T }> {
  expect(i.tipo).toBe(tipo);
  return i as Extract<Interpretacion, { tipo: T }>;
}

// Contexto de C14: T01 ya se hizo (C01) y T31 bloquea a T04.
const ctxC14 = ctxDe('jose-alfaro', {
  trabajosAbiertos: [
    ...TRABAJOS.filter((x) => x.id !== 'T04'),
    t('T04', 'Instalar unidad condensadora y compresor', 'P1', 'jose-alfaro', {
      estado: 'bloqueado',
      bloqueadoPorId: 'T31',
      repuestoId: 'compresor-2hp',
    }),
    t('T31', 'Conseguir compresor de 2 HP', 'P1', 'lucia-mora', { repuestoId: 'compresor-2hp' }),
  ],
});

const ctxC11 = ctxDe('lucia-mora', {
  trabajosAbiertos: [...TRABAJOS, t('T31', 'Conseguir compresor de 2 HP', 'P1', 'lucia-mora', { repuestoId: 'compresor-2hp' })],
});

describe('respuestas guardadas: frases de control', () => {
  it('cubre C01–C15, E1 y E5', () => {
    expect(RESPUESTAS_GUARDADAS.map((r) => r.id)).toEqual([
      ...Array.from({ length: 15 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
      'E1',
      'E5',
    ]);
  });

  it('C01 trabajo nuevo urgente en P1 para Lucía; bloquea T04 y reporta el compresor', async () => {
    const f = RESPUESTAS_GUARDADAS[0]!.frase;
    const r = de(await interpretar(f, ctxDe('jose-alfaro')), 'trabajo_nuevo');
    expect(r).toMatchObject({
      proyectoId: 'P1',
      responsableId: 'lucia-mora',
      responsableSeguro: true,
      plazo: { dia: 'hoy' },
      urgente: true,
      conCostoProbable: false,
      bloquea: ['T04'],
      repuestoFaltante: { repuestoId: 'compresor-2hp' },
    });
  });

  it('C02 actualiza T12 a en_curso con nota', async () => {
    const r = de(await interpretar('Listo el mantenimiento de Escazú, Tibás queda para mañana', ctxDe('daniela-quesada')), 'actualizacion');
    expect(r).toMatchObject({ trabajoId: 'T12', nuevoEstado: 'en_curso', hayProblema: false });
    expect(r.nota).toBeTruthy();
  });

  it('C03 nota en T21 con problema (avisa a Sofía vía T22); no crea trabajo', async () => {
    const r = de(await interpretar('Mae, el cliente de Don Beto no estaba, me devolví con los congeladores', ctxDe('diego-rojas')), 'actualizacion');
    expect(r).toMatchObject({ trabajoId: 'T21', nuevoEstado: null, hayProblema: true });
    expect(r.nota).toBeTruthy();
  });

  it('C04 duplicado de T28', async () => {
    const r = await interpretar('Hay que mandarle la cotización de la cámara fría al Hotel Mirador hoy', ctxDe('paola-herrera'));
    expect(r).toEqual({ tipo: 'duplicado', trabajoId: 'T28' });
  });

  it('C05 trabajo nuevo en P4 para Andrés, hoy, relacionado con T26 y T27', async () => {
    const r = de(await interpretar('La Colina pregunta si se puede adelantar la entrega de las vitrinas al jueves', ctxDe('sofia-navarro')), 'trabajo_nuevo');
    expect(r).toMatchObject({
      proyectoId: 'P4',
      responsableId: 'andres-vargas',
      responsableSeguro: true,
      plazo: { dia: 'hoy' },
      urgente: false,
      relacionados: ['T26', 'T27'],
    });
  });

  it('C06 decisión de empaques con ajuste 12 % y cantidad sin dato', async () => {
    const r = de(await interpretar('El proveedor subió el precio de los empaques un 12 %, ¿compramos igual?', ctxDe('karla-jimenez')), 'decision');
    expect(r).toMatchObject({
      proyectoId: 'P3',
      compra: { repuestoId: 'empaque-puerta', cantidad: null, proveedor: null, ajustePrecioPct: 12 },
      existenciaReal: null,
    });
  });

  it('C07 no es trabajo', async () => {
    const r = await interpretar('Gracias a todos, buen trabajo ayer', ctxDe('esteban-castro'));
    expect(r.tipo).toBe('no_es_trabajo');
  });

  it('C08 trabajo nuevo en P2 para Lucía, jueves 26 a las 7:00, relacionado con T11', async () => {
    const r = de(await interpretar('Ocupo una escalera de 6 metros para el jueves en Curridabat', ctxDe('mario-chaves')), 'trabajo_nuevo');
    expect(r).toMatchObject({
      proyectoId: 'P2',
      responsableId: 'lucia-mora',
      responsableSeguro: true,
      plazo: { dia: '2026-11-26', hora: '07:00' },
      relacionados: ['T11'],
    });
  });

  it('C09 nota con problema en T27', async () => {
    const r = de(await interpretar('Todavía no entra el pago de La Colina por las vitrinas', ctxDe('ricardo-brenes')), 'actualizacion');
    expect(r).toMatchObject({ trabajoId: 'T27', nuevoEstado: null, hayProblema: true });
  });

  it('C10 trabajo nuevo en OD, Lucía propuesta pero sin seguridad', async () => {
    const r = de(await interpretar('Alguien tiene que revisar el camión, hace un ruido raro', ctxDe('andres-vargas')), 'trabajo_nuevo');
    expect(r).toMatchObject({ proyectoId: 'OD', responsableId: 'lucia-mora', responsableSeguro: false, plazo: { dia: 'hoy' } });
  });

  it('C11 decisión por 3 compresores locales, existencia real 0, trabajo del autor resuelto del contexto', async () => {
    const r = de(await interpretar('No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local', ctxC11), 'decision');
    expect(r).toMatchObject({
      proyectoId: 'P1',
      compra: { repuestoId: 'compresor-2hp', cantidad: 3, proveedor: 'local', ajustePrecioPct: null },
      existenciaReal: 0,
      trabajoRelacionadoId: 'T31',
    });
  });

  it('C12 trabajo nuevo en P2 para Paola, viernes 27', async () => {
    const r = de(await interpretar('En Cartago el cliente quiere que también le revisemos el aire acondicionado', ctxDe('daniela-quesada')), 'trabajo_nuevo');
    expect(r).toMatchObject({ proyectoId: 'P2', responsableId: 'paola-herrera', responsableSeguro: true, plazo: { dia: '2026-11-27' } });
  });

  it('C13 es una pregunta, no un trabajo', async () => {
    const r = de(await interpretar('¿Cómo vamos con los pedidos de la semana?', ctxDe('marcela-solis')), 'pregunta');
    expect(r.pregunta).toContain('pedidos de la semana');
  });

  it('C14 resuelve el trabajo que bloquea a T04 (dinámico)', async () => {
    const r = de(await interpretar('Ya llegó el compresor, sigo con la instalación', ctxC14), 'actualizacion');
    expect(r).toMatchObject({ trabajoId: 'T31', nuevoEstado: 'resuelto' });
  });

  it('C14 sin trabajo bloqueante en el contexto no inventa uno', async () => {
    const r = await interpretar('Ya llegó el compresor, sigo con la instalación', ctxDe('jose-alfaro'));
    expect(r.tipo).not.toBe('trabajo_nuevo');
  });

  it('C15 trabajo nuevo urgente con costo probable, bloquea T24', async () => {
    const r = de(await interpretar('Se cayó una vitrina del pedido 1045 en bodega, quedó con el vidrio quebrado', ctxDe('diego-rojas')), 'trabajo_nuevo');
    expect(r).toMatchObject({
      proyectoId: 'P4',
      responsableId: 'lucia-mora',
      responsableSeguro: true,
      plazo: { dia: 'hoy' },
      urgente: true,
      conCostoProbable: true,
      bloquea: ['T24'],
    });
  });

  it('E1 «Ya la envié» resuelve el único trabajo con seguimiento pendiente', async () => {
    const r = de(
      await interpretar('Ya la envié', ctxDe('paola-herrera', { ahora: '2026-11-25T12:10:00-06:00', seguimientosPendientesDelAutor: ['T28'] })),
      'actualizacion',
    );
    expect(r).toMatchObject({ trabajoId: 'T28', nuevoEstado: 'resuelto', hayProblema: false });
  });

  it('E5 «Don Beto recibe mañana jueves en la mañana» cierra T22, mueve T21 al jueves y anota T29', async () => {
    const r = de(
      await interpretar('Don Beto recibe mañana jueves en la mañana', ctxDe('sofia-navarro', { ahora: '2026-11-25T09:30:00-06:00' })),
      'actualizacion',
    );
    expect(r).toMatchObject({ trabajoId: 'T22', nuevoEstado: 'resuelto' });
    expect(r.reprogramar).toEqual([{ trabajoId: 'T21', plazo: { dia: '2026-11-26', hora: '12:00' } }]);
    expect(r.notasRelacionadas.map((n) => n.trabajoId)).toEqual(['T29']);
  });
});

describe('respuestas guardadas: coincidencia aproximada', () => {
  it('sin tildes, en mayúsculas y sin puntuación sigue siendo C01', async () => {
    const r = await interpretar('NO PUEDO TERMINAR LA INSTALACION EN LA COLINA FALTA EL COMPRESOR DE 2 HP!!!', ctxDe('jose-alfaro'));
    expect(r).toMatchObject({ tipo: 'trabajo_nuevo', proyectoId: 'P1', responsableId: 'lucia-mora', responsableSeguro: true });
  });

  it('«2HP» pegado y otra puntuación sigue siendo C11', async () => {
    const r = await interpretar('No hay compresores de 2HP; propongo comprar 3 de urgencia al proveedor local.', ctxC11);
    expect(r).toMatchObject({ tipo: 'decision', compra: { repuestoId: 'compresor-2hp', cantidad: 3 } });
  });

  it('una palabra distinta en C09 sigue siendo C09', async () => {
    const r = await interpretar('Todavía no entra el pago de La Colina por las vitrinas nuevas', ctxDe('ricardo-brenes'));
    expect(r).toMatchObject({ tipo: 'actualizacion', trabajoId: 'T27' });
  });

  it('C13 con otra redacción de mayúsculas sigue siendo pregunta y conserva el texto del usuario', async () => {
    const r = de(await interpretar('¿COMO VAMOS con los pedidos de la semana?', ctxDe('marcela-solis')), 'pregunta');
    expect(r.pregunta).toBe('¿COMO VAMOS con los pedidos de la semana?');
  });
});

describe('frases desconocidas: no se inventa un trabajo', () => {
  it('una frase clara no guardada NO coincide con una guardada (no es C01 aunque mencione el compresor)', async () => {
    const r = await interpretar('Mañana llega el contador a revisar los libros de la bodega', ctxDe('jose-alfaro'));
    // Cae en heurísticas: trabajo sin responsable seguro (Nexo pedirá confirmación).
    expect(r).toMatchObject({ tipo: 'trabajo_nuevo', proyectoId: 'OD', responsableSeguro: false });
    expect(r).not.toMatchObject({ proyectoId: 'P1' });
  });

  it('frase desconocida: trabajo en OD con el jefe del autor propuesto y confirmación pendiente', async () => {
    const r = de(await interpretar('Hay que pintar la bodega de repuestos', ctxDe('diego-rojas')), 'trabajo_nuevo');
    expect(r).toMatchObject({
      proyectoId: 'OD',
      responsableId: 'lucia-mora',
      responsableSeguro: false,
      plazo: { dia: 'hoy' },
      urgente: false,
      conCostoProbable: false,
      bloquea: [],
      relacionados: [],
      repuestoFaltante: null,
    });
  });

  it('el autor sin jefe (gerente) se propone a sí mismo, sin seguridad', async () => {
    const r = de(await interpretar('Revisar el contrato del seguro de la flotilla', ctxDe('marcela-solis')), 'trabajo_nuevo');
    expect(r).toMatchObject({ responsableId: 'marcela-solis', responsableSeguro: false });
  });

  it('texto sin contenido interpretable no es trabajo', async () => {
    for (const vacio of ['', '   ', '...', '???']) {
      const r = await interpretar(vacio, ctxDe('diego-rojas'));
      expect(r.tipo).toBe('no_es_trabajo');
    }
  });

  it('«listo» sin seguimiento pendiente no crea nada y lo dice', async () => {
    const r = de(await interpretar('Listo, ya quedó', ctxDe('diego-rojas')), 'no_es_trabajo');
    expect(r.motivo.length).toBeGreaterThan(10);
  });

  it('«listo» con un seguimiento pendiente resuelve ese trabajo', async () => {
    const r = await interpretar('Listo, ya quedó', ctxDe('diego-rojas', { seguimientosPendientesDelAutor: ['T21'] }));
    expect(r).toMatchObject({ tipo: 'actualizacion', trabajoId: 'T21', nuevoEstado: 'resuelto' });
  });

  it('con varios seguimientos pendientes usa las palabras de la frase; si no distingue, no adivina', async () => {
    const ctx = ctxDe('diego-rojas', { seguimientosPendientesDelAutor: ['T21', 'T26'] });
    const claro = await interpretar('Ya entregué las vitrinas de La Colina', ctx);
    expect(claro).toMatchObject({ tipo: 'actualizacion', trabajoId: 'T26' });
    const dudoso = await interpretar('Listo', ctx);
    expect(dudoso.tipo).toBe('no_es_trabajo');
  });

  it('un agradecimiento solo no es trabajo; con contenido de trabajo sí lo es', () => {
    const ctx = ctxDe('diego-rojas');
    expect(interpretarPorHeuristicas('Muchas gracias por la ayuda', ctx).tipo).toBe('no_es_trabajo');
    expect(interpretarPorHeuristicas('Gracias, pero falta pintar la bodega', ctx).tipo).toBe('trabajo_nuevo');
  });

  it('una pregunta con signo y palabra interrogativa es pregunta; sin palabra interrogativa no', () => {
    const ctx = ctxDe('marcela-solis');
    expect(interpretarPorHeuristicas('¿Qué está atrasado hoy?', ctx)).toEqual({ tipo: 'pregunta', pregunta: '¿Qué está atrasado hoy?' });
    expect(interpretarPorHeuristicas('Cuántos pedidos faltan por entregar', ctx).tipo).toBe('trabajo_nuevo');
  });

  it('el título conserva el texto del usuario y la propuesta cumple el esquema', () => {
    const r = interpretarPorHeuristicas('hay que cambiar la llanta del camión.', ctxDe('esteban-castro'));
    expect(esquemaInterpretacion.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({ tipo: 'trabajo_nuevo', titulo: 'Hay que cambiar la llanta del camión' });
  });
});
