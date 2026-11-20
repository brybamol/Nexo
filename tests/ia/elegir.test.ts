// Pruebas de 2.2: selección Claude/Local e intérprete Claude con cliente falso (sin red, sin clave real).
import { describe, expect, it, vi } from 'vitest';
import { InterpreteClaude, MODELO_CAPTURA, MODELO_PREGUNTAS, type ClienteMensajes } from '@/ia/claude/interprete-claude';
import { herramientaInterpretacion } from '@/ia/claude/prompts';
import { crearInterprete } from '@/ia/elegir';
import type { ContextoCaptura, HechosPregunta, InterpreteIA, Interpretacion } from '@/ia/interprete';
import { InterpreteLocal } from '@/ia/local/interprete-local';

const ctx: ContextoCaptura = {
  ahora: '2026-11-25T07:05:00-06:00',
  autor: { id: 'jose-alfaro', nombre: 'José Alfaro', rol: 'Técnico', area: 'Campo' },
  personas: [],
  proyectos: [{ id: 'P1', nombre: 'Cámara fría La Colina', responsableId: 'andres-vargas' }],
  trabajosAbiertos: [],
  repuestos: [{ id: 'compresor-2hp', nombre: 'Compresor 2 HP', existencia: 1 }],
  seguimientosPendientesDelAutor: [],
};

const propuesta: Interpretacion = {
  tipo: 'trabajo_nuevo',
  titulo: 'Conseguir compresor de 2 HP',
  proyectoId: 'P1',
  responsableId: 'lucia-mora',
  responsableSeguro: true,
  plazo: { dia: 'hoy' },
  urgente: true,
  conCostoProbable: false,
  relacionados: [],
  bloquea: ['T04'],
  repuestoFaltante: { repuestoId: 'compresor-2hp' },
};

const deLocal: Interpretacion = { tipo: 'no_es_trabajo', motivo: 'respaldo' };

function respaldoFalso(): InterpreteIA {
  return {
    nombre: 'local',
    interpretar: vi.fn(async () => ({ valor: deLocal, implementacion: 'local' as const, modelo: null, respaldo: false })),
    clasificarPregunta: vi.fn(async () => ({ valor: 'atrasados' as const, implementacion: 'local' as const, modelo: null, respaldo: false })),
    redactarRespuesta: vi.fn(async () => ({ valor: 'texto local', implementacion: 'local' as const, modelo: null, respaldo: false })),
  };
}

function clienteQue(create: ClienteMensajes['messages']['create']): ClienteMensajes {
  return { messages: { create: vi.fn(create) } };
}

describe('crearInterprete (selección)', () => {
  it('sin clave devuelve el intérprete Local', () => {
    expect(crearInterprete(undefined)).toBeInstanceOf(InterpreteLocal);
    expect(crearInterprete(undefined).nombre).toBe('local');
  });

  it('con clave vacía o en blanco devuelve Local', () => {
    expect(crearInterprete('').nombre).toBe('local');
    expect(crearInterprete('   ').nombre).toBe('local');
  });

  it('con clave devuelve Claude (el cliente no hace red al construirse)', () => {
    const ia = crearInterprete('clave-de-prueba');
    expect(ia).toBeInstanceOf(InterpreteClaude);
    expect(ia.nombre).toBe('claude');
  });
});

describe('InterpreteClaude con cliente falso', () => {
  it('respuesta válida: devuelve la interpretación de Claude con el modelo de captura', async () => {
    const cliente = clienteQue(async () => ({
      content: [{ type: 'tool_use', id: 'tu_1', name: 'registrar_interpretacion', input: { interpretacion: propuesta } }],
    }));
    const respaldo = respaldoFalso();
    const r = await new InterpreteClaude('k', respaldo, cliente).interpretar('falta el compresor', ctx);

    expect(r).toEqual({ valor: propuesta, implementacion: 'claude', modelo: MODELO_CAPTURA, respaldo: false });
    expect(respaldo.interpretar).not.toHaveBeenCalled();
    const [params, opciones] = vi.mocked(cliente.messages.create).mock.calls[0]!;
    expect(params.model).toBe('claude-haiku-5-5');
    expect((params.tools as { name: string }[])[0]!.name).toBe(herramientaInterpretacion().name);
    expect(opciones?.timeout).toBe(15_000);
  });

  it('respuesta que no cumple el esquema: respaldo Local con respaldo=true', async () => {
    const cliente = clienteQue(async () => ({
      content: [{ type: 'tool_use', id: 'tu_1', name: 'registrar_interpretacion', input: { interpretacion: { tipo: 'inventado' } } }],
    }));
    const respaldo = respaldoFalso();
    const r = await new InterpreteClaude('k', respaldo, cliente).interpretar('x', ctx);

    expect(r.implementacion).toBe('local');
    expect(r.respaldo).toBe(true);
    expect(r.valor).toEqual(deLocal);
    expect(respaldo.interpretar).toHaveBeenCalledOnce();
  });

  it('respuesta sin llamada a la herramienta: respaldo Local', async () => {
    const cliente = clienteQue(async () => ({ content: [{ type: 'text', text: 'hola' }] }));
    const r = await new InterpreteClaude('k', respaldoFalso(), cliente).interpretar('x', ctx);
    expect(r.respaldo).toBe(true);
    expect(r.implementacion).toBe('local');
  });

  it('error de red: respaldo Local en las tres operaciones', async () => {
    const cliente = clienteQue(async () => {
      throw new Error('ECONNRESET');
    });
    const ia = new InterpreteClaude('k', respaldoFalso(), cliente);
    const hechos: HechosPregunta = { tema: 'atrasados', datos: {}, fuentes: [] };

    expect(await ia.interpretar('x', ctx)).toMatchObject({ implementacion: 'local', respaldo: true });
    expect(await ia.clasificarPregunta('¿qué hay atrasado?', ctx)).toMatchObject({ valor: 'atrasados', implementacion: 'local', respaldo: true });
    expect(await ia.redactarRespuesta('¿qué hay atrasado?', hechos)).toMatchObject({ valor: 'texto local', implementacion: 'local', respaldo: true });
  });

  it('clasificarPregunta válida usa el modelo de preguntas; tema inválido cae al respaldo', async () => {
    const buena = clienteQue(async () => ({
      content: [{ type: 'tool_use', id: 't', name: 'clasificar_pregunta', input: { tema: 'pedidos_semana' } }],
    }));
    const r = await new InterpreteClaude('k', respaldoFalso(), buena).clasificarPregunta('¿pedidos?', ctx);
    expect(r).toEqual({ valor: 'pedidos_semana', implementacion: 'claude', modelo: MODELO_PREGUNTAS, respaldo: false });
    expect(vi.mocked(buena.messages.create).mock.calls[0]![0].model).toBe('claude-opus-5-5');

    const mala = clienteQue(async () => ({
      content: [{ type: 'tool_use', id: 't', name: 'clasificar_pregunta', input: { tema: 'otro' } }],
    }));
    const r2 = await new InterpreteClaude('k', respaldoFalso(), mala).clasificarPregunta('¿pedidos?', ctx);
    expect(r2.respaldo).toBe(true);
  });

  it('redactarRespuesta devuelve el texto de Claude; una respuesta vacía cae al respaldo', async () => {
    const hechos: HechosPregunta = { tema: 'pedidos_semana', datos: { entregados: 2 }, fuentes: [{ trabajoId: 'T19', etiqueta: '1041' }] };
    const buena = clienteQue(async () => ({ content: [{ type: 'text', text: 'Van 2 entregados (T19).' }] }));
    expect(await new InterpreteClaude('k', respaldoFalso(), buena).redactarRespuesta('¿cómo vamos?', hechos)).toEqual({
      valor: 'Van 2 entregados (T19).',
      implementacion: 'claude',
      modelo: MODELO_PREGUNTAS,
      respaldo: false,
    });

    const vacia = clienteQue(async () => ({ content: [{ type: 'text', text: '  ' }] }));
    expect((await new InterpreteClaude('k', respaldoFalso(), vacia).redactarRespuesta('¿cómo vamos?', hechos)).respaldo).toBe(true);
  });
});
