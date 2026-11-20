// Reloj de la demo y personas contra PGlite en memoria. Tarea 1.5.
// Las reglas de tick son de la tarea 3.1: aquí se comprueba el CABLEADO (hora, transacción, persistencia, resultado)
// con aserciones que valen tanto con el esqueleto actual (tick = []) como con el motor completo; el motor se
// controla con un envoltorio de vi.fn que por defecto llama a la implementación real.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acciones, avisos } from '@/db/esquema';
import { enCR, sumarMinutos } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';
import { siguienteEvento, tick } from '@/motor/seguimiento';
import { avanzarReloj, fijarReloj, irAlSiguienteEvento, obtenerAhora } from '@/servicios/reloj';
import { listarPersonas } from '@/servicios/personas';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

vi.mock('@/motor/seguimiento', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/seguimiento')>();
  return { ...real, tick: vi.fn(real.tick), siguienteEvento: vi.fn(real.siguienteEvento) };
});

let demo: Demo;
const T0705 = enCR('2026-11-25', '07:05');

beforeEach(async () => {
  demo = await prepararDemo();
});
afterEach(async () => {
  await demo.cerrar();
  vi.mocked(tick).mockClear();
  vi.mocked(siguienteEvento).mockClear();
});

describe('prepararDemo', () => {
  it('por defecto fija el reloj en mié 25, 07:05 sin hacer tick', async () => {
    expect(await obtenerAhora(demo.ctx)).toEqual(T0705);
    expect(vi.mocked(tick)).not.toHaveBeenCalled();
    expect(await demo.ctx.db.select().from(acciones)).toHaveLength(0);
  });

  it('acepta otra hora y rechaza formatos no válidos', async () => {
    const otra = await prepararDemo({ hora: '11:59' });
    try {
      expect(await obtenerAhora(otra.ctx)).toEqual(enCR('2026-11-25', '11:59'));
    } finally {
      await otra.cerrar();
    }
    await expect(prepararDemo({ hora: '7:5' })).rejects.toThrow('HH:mm');
  });

  it('usa el intérprete Local', () => {
    expect(demo.ctx.ia.nombre).toBe('local');
  });
});

describe('avanzarReloj', () => {
  it('suma los minutos, persiste la hora y devuelve ahora en ISO', async () => {
    const r = await avanzarReloj(demo.ctx, 5);
    expect(r.ahora).toBe(sumarMinutos(T0705, 5).toISOString());
    expect(await obtenerAhora(demo.ctx)).toEqual(sumarMinutos(T0705, 5));
    await avanzarReloj(demo.ctx, 30);
    expect(await obtenerAhora(demo.ctx)).toEqual(sumarMinutos(T0705, 35));
  });

  it('ejecuta tick con la instantánea ya en la hora nueva', async () => {
    await avanzarReloj(demo.ctx, 10);
    expect(vi.mocked(tick)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(tick).mock.calls[0]?.[0].ahora).toEqual(sumarMinutos(T0705, 10));
  });

  it('las acciones devueltas son exactamente las que quedaron guardadas', async () => {
    const r = await avanzarReloj(demo.ctx, 5);
    const guardadas = await demo.ctx.db.select().from(acciones);
    expect(r.acciones.map((a) => a.id).sort()).toEqual(guardadas.map((a) => a.id).sort());
  });

  it('persiste los efectos de tick y los devuelve como AccionVista con su destinatario', async () => {
    const en = sumarMinutos(T0705, 5);
    vi.mocked(tick).mockReturnValueOnce([
      {
        tipo: 'accion',
        accion: { en, tipo: 'pedir_estado', motivo: 'T15 venció', hechoOrigen: 'plazo vencido', trabajoIds: ['T15'], decisionId: null, destinatarioId: 'lucia-mora', capturaId: null },
        aviso: { personaId: 'lucia-mora', en, titulo: '¿Cómo va T15?', cuerpo: 'Venció ayer', trabajoIds: ['T15'] },
      },
    ]);
    const r = await avanzarReloj(demo.ctx, 5);
    expect(r.acciones).toHaveLength(1);
    expect(r.acciones[0]).toMatchObject({
      tipo: 'pedir_estado',
      motivo: 'T15 venció',
      hechoOrigen: 'plazo vencido',
      trabajoIds: ['T15'],
      decisionId: null,
      en,
      destinatario: { id: 'lucia-mora', nombre: 'Lucía Mora', rol: 'Supervisora de bodega', area: 'Bodega' },
    });
    expect(await demo.ctx.db.select().from(avisos)).toHaveLength(1);
  });

  it('una acción sin destinatario se devuelve con destinatario null', async () => {
    vi.mocked(tick).mockReturnValueOnce([
      { tipo: 'accion', accion: { en: T0705, tipo: 'aviso', motivo: 'm', hechoOrigen: 'h', trabajoIds: [], decisionId: null, destinatarioId: null, capturaId: null }, aviso: null },
    ]);
    const r = await avanzarReloj(demo.ctx, 1);
    expect(r.acciones[0]?.destinatario).toBeNull();
  });

  it('es atómico: si tick falla, el reloj no se mueve', async () => {
    vi.mocked(tick).mockImplementationOnce(() => {
      throw new Error('fallo del motor');
    });
    await expect(avanzarReloj(demo.ctx, 5)).rejects.toThrow('fallo del motor');
    expect(await obtenerAhora(demo.ctx)).toEqual(T0705);
  });

  it('es atómico: si persistir falla a mitad, ni la hora ni los efectos anteriores quedan', async () => {
    vi.mocked(tick).mockReturnValueOnce([
      { tipo: 'accion', accion: { en: T0705, tipo: 'aviso', motivo: 'm', hechoOrigen: 'h', trabajoIds: [], decisionId: null, destinatarioId: null, capturaId: null }, aviso: null },
      { tipo: 'actualizar_trabajo', trabajoId: 'T99', cambios: { estado: 'resuelto' }, actorId: null },
    ]);
    await expect(avanzarReloj(demo.ctx, 5)).rejects.toThrow('T99');
    expect(await obtenerAhora(demo.ctx)).toEqual(T0705);
    expect(await demo.ctx.db.select().from(acciones)).toHaveLength(0);
  });

  it('rechaza minutos negativos o no numéricos', async () => {
    await expect(avanzarReloj(demo.ctx, -1)).rejects.toBeInstanceOf(ErrorDominio);
    await expect(avanzarReloj(demo.ctx, Number.NaN)).rejects.toBeInstanceOf(ErrorDominio);
    expect(await obtenerAhora(demo.ctx)).toEqual(T0705);
  });
});

describe('irAlSiguienteEvento', () => {
  it('va al instante que dice siguienteEvento y hace tick allí', async () => {
    const destino = enCR('2026-11-25', '07:35');
    vi.mocked(siguienteEvento).mockReturnValueOnce(destino);
    const r = await irAlSiguienteEvento(demo.ctx);
    expect(r.ahora).toBe(destino.toISOString());
    expect(await obtenerAhora(demo.ctx)).toEqual(destino);
    expect(vi.mocked(tick).mock.calls[0]?.[0].ahora).toEqual(destino);
  });

  it('si no hay evento, avanza 30 minutos', async () => {
    vi.mocked(siguienteEvento).mockReturnValueOnce(null);
    await irAlSiguienteEvento(demo.ctx);
    expect(await obtenerAhora(demo.ctx)).toEqual(sumarMinutos(T0705, 30));
  });

  it('con el motor real avanza siempre hacia delante (evento o +30 min)', async () => {
    const r = await irAlSiguienteEvento(demo.ctx);
    expect(new Date(r.ahora).getTime()).toBeGreaterThan(T0705.getTime());
  });

  it('ignora un «siguiente evento» que no esté en el futuro', async () => {
    vi.mocked(siguienteEvento).mockReturnValueOnce(enCR('2026-11-25', '07:00'));
    await irAlSiguienteEvento(demo.ctx);
    expect(await obtenerAhora(demo.ctx)).toEqual(sumarMinutos(T0705, 30));
  });
});

describe('fijarReloj', () => {
  it('fija una hora futura y hace tick', async () => {
    const destino = enCR('2026-11-25', '11:59');
    const r = await fijarReloj(demo.ctx, destino);
    expect(r.ahora).toBe(destino.toISOString());
    expect(await obtenerAhora(demo.ctx)).toEqual(destino);
    expect(vi.mocked(tick).mock.calls[0]?.[0].ahora).toEqual(destino);
  });

  it('admite la hora actual y rechaza retroceder sin mover nada', async () => {
    await fijarReloj(demo.ctx, T0705);
    await expect(fijarReloj(demo.ctx, enCR('2026-11-25', '07:04'))).rejects.toBeInstanceOf(ErrorDominio);
    expect(await obtenerAhora(demo.ctx)).toEqual(T0705);
  });

  it('rechaza una fecha inválida', async () => {
    await expect(fijarReloj(demo.ctx, new Date('no es fecha'))).rejects.toBeInstanceOf(ErrorDominio);
  });
});

describe('listarPersonas', () => {
  it('devuelve las 12 personas como PersonaBreve, la gerente primero', async () => {
    const ps = await listarPersonas(demo.ctx);
    expect(ps).toHaveLength(12);
    expect(ps[0]).toEqual({ id: 'marcela-solis', nombre: 'Marcela Solís', rol: 'Gerente general', area: 'Gerencia' });
    expect(Object.keys(ps[0] ?? {}).sort()).toEqual(['area', 'id', 'nombre', 'rol']);
    expect(ps.find((p) => p.id === 'jose-alfaro')).toMatchObject({ nombre: 'José Alfaro', area: 'Campo' });
  });
});
