// Consultas de proyectos y trabajos contra PGlite en memoria (estado inicial: mié 25 nov, 7:00). Tarea 1.6.
// Las marcas son de la tarea 2.4: aquí se comprueba que las consultas las toman de calcularMarcas (simulado)
// y que, sin marcas para un trabajo, devuelven «sin marcas». El resto de aserciones no dependen del motor.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistirEfectos } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import type { Marcas, Trabajo } from '@/dominio/tipos';
import { calcularMarcas } from '@/motor/marcas';
import { listarTrabajos, obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { listarProyectos, obtenerProyecto } from '@/servicios/proyectos';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

vi.mock('@/motor/marcas', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/marcas')>();
  return { ...real, calcularMarcas: vi.fn(real.calcularMarcas) };
});

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '07:00' });
});
afterEach(async () => {
  await demo.cerrar();
  vi.mocked(calcularMarcas).mockClear();
});

const SIN_MARCAS: Marcas = { atrasado: false, enRiesgo: false, causas: [] };

function marcasSimuladas(): Map<string, Marcas> {
  return new Map<string, Marcas>([
    ['T15', { atrasado: true, enRiesgo: false, causas: [{ tipo: 'atrasado', trabajoId: 'T15' }] }],
    ['T21', { atrasado: true, enRiesgo: false, causas: [{ tipo: 'atrasado', trabajoId: 'T21' }] }],
    ['T16', { atrasado: false, enRiesgo: true, causas: [{ tipo: 'cadena', trabajoId: 'T15' }] }],
    ['T17', { atrasado: false, enRiesgo: true, causas: [{ tipo: 'cadena', trabajoId: 'T16' }] }],
    ['T18', { atrasado: false, enRiesgo: true, causas: [{ tipo: 'cadena', trabajoId: 'T17' }] }],
  ]);
}

function trabajoNuevo(id: string, extra: Partial<Trabajo> = {}): Trabajo {
  return {
    id,
    proyectoId: 'P1',
    numero: 8,
    titulo: 'Conseguir un compresor de 2 HP',
    responsableId: 'lucia-mora',
    solicitadoPorId: 'jose-alfaro',
    plazo: enCR('2026-11-25', '12:00'),
    estado: 'abierto',
    urgente: true,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: 'compresor-2hp',
    cantidadRepuesto: 1,
    etiqueta: null,
    relacionados: [],
    origen: 'captura',
    capturaId: null,
    decisionId: null,
    creadoEn: enCR('2026-11-25', '07:00'),
    resueltoEn: null,
    confirmacion: 'confirmado',
    duenoPropuestaId: null,
    confirmadoPorId: null,
    entrega: null,
    ...extra,
  };
}

/** C01 a mano: T31 urgente de Lucía; T04 pasa a bloqueado por T31; seguimiento nivel 0 de T31. */
async function aplicarBloqueo(): Promise<void> {
  const ahora = enCR('2026-11-25', '07:00');
  await persistirEfectos(demo.ctx.db, [
    { tipo: 'crear_trabajo', trabajo: trabajoNuevo('T31'), necesidades: [], actorId: 'jose-alfaro' },
    {
      tipo: 'actualizar_trabajo',
      trabajoId: 'T04',
      cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta el compresor', fechaSolucion: enCR('2026-11-25', '15:00') },
      actorId: 'jose-alfaro',
    },
    {
      tipo: 'crear_seguimiento',
      seguimiento: { id: 'S1', trabajoId: 'T31', plazoReferencia: ahora, nivel: 0, destinatarioId: 'lucia-mora', urgente: true, proximoEn: enCR('2026-11-25', '07:30'), estado: 'pendiente', iniciadoEn: ahora, escaladosA: [], tipo: 'estado' },
    },
  ]);
}

describe('obtenerTrabajo', () => {
  it('devuelve la vista completa de un trabajo de la semilla', async () => {
    const t = await obtenerTrabajo(demo.ctx, 'T04');
    expect(t).toEqual({
      id: 'T04',
      titulo: 'Instalar unidad condensadora y compresor',
      referencia: 'COLINA-4',
      proyecto: { id: 'P1', nombre: 'Cámara fría La Colina' },
      responsable: { id: 'jose-alfaro', nombre: 'José Alfaro', rol: 'Técnico', area: 'Campo' },
      solicitadoPor: null,
      estado: 'en_curso',
      plazo: enCR('2026-11-25', '17:00'),
      urgente: false,
      conCostoProbable: false,
      marcas: SIN_MARCAS,
      bloqueadoPor: null,
      fechaSolucion: null,
      bloquea: [],
      dependeDe: ['T03'],
      bloqueaTrabajos: [],
      dependeDeTrabajos: [{ id: 'T03', titulo: 'Montar paneles y puerta', referencia: 'COLINA-3' }],
      causasTrabajos: {},
      causasRepuestos: {},
      necesita: [{ repuesto: 'Compresor de 2 HP', cantidad: 1 }],
      seguimiento: null,
      notas: [],
      origen: 'semilla',
      confirmacion: 'confirmado',
      confianza: 'persona',
      dueno: null,
      confirmadoPor: null,
      entrega: null,
      evidencias: [],
    });
  });

  it('devuelve null si el trabajo no existe', async () => {
    expect(await obtenerTrabajo(demo.ctx, 'T99')).toBeNull();
  });

  it('incluye las notas con el nombre del autor (Nexo si no hay autor), en orden cronológico', async () => {
    const t19 = await obtenerTrabajo(demo.ctx, 'T19');
    expect(t19?.notas).toEqual([{ en: enCR('2026-11-23', '10:00'), autor: 'Marcela Solís', texto: 'Confirmé con Soda El Roble la hora de entrega' }]);

    await persistirEfectos(demo.ctx.db, [
      { tipo: 'agregar_nota', trabajoId: 'T19', autorId: null, texto: 'Nota de Nexo' },
      { tipo: 'agregar_nota', trabajoId: 'T19', autorId: 'diego-rojas', texto: 'Entregado' },
    ]);
    const despues = await obtenerTrabajo(demo.ctx, 'T19');
    expect(despues?.notas.map((n) => n.autor)).toEqual(['Marcela Solís', 'Nexo', 'Diego Rojas']);
  });

  it('lista todas las dependencias directas', async () => {
    const t13 = await obtenerTrabajo(demo.ctx, 'T13');
    expect([...(t13?.dependeDe ?? [])].sort()).toEqual(['T10', 'T11', 'T12']);
    expect((await obtenerTrabajo(demo.ctx, 'T21'))?.dependeDe).toEqual(['T22']);
  });

  it('toma las marcas de calcularMarcas, con la instantánea completa', async () => {
    vi.mocked(calcularMarcas).mockReturnValueOnce(marcasSimuladas());
    const t15 = await obtenerTrabajo(demo.ctx, 'T15');
    expect(t15?.marcas).toEqual(marcasSimuladas().get('T15'));
    expect(vi.mocked(calcularMarcas).mock.calls[0]?.[0].trabajos).toHaveLength(30);
  });

  it('un trabajo sin entrada de marcas se devuelve sin marcas', async () => {
    vi.mocked(calcularMarcas).mockReturnValueOnce(new Map());
    expect((await obtenerTrabajo(demo.ctx, 'T12'))?.marcas).toEqual(SIN_MARCAS);
  });

  describe('tras un bloqueo (C01)', () => {
    beforeEach(aplicarBloqueo);

    it('el bloqueante expone qué bloquea (trabajo bloqueado y su cadena), quién lo pidió y su seguimiento', async () => {
      const t31 = await obtenerTrabajo(demo.ctx, 'T31');
      expect(t31?.solicitadoPor).toMatchObject({ id: 'jose-alfaro', nombre: 'José Alfaro' });
      expect(t31?.responsable.id).toBe('lucia-mora');
      expect(t31?.urgente).toBe(true);
      expect(t31?.bloquea).toEqual(['T04', 'T05', 'T06', 'T07']);
      expect(t31?.seguimiento).toEqual({ nivel: 0, desde: enCR('2026-11-25', '07:00') });
    });

    it('el trabajo bloqueado muestra su bloqueante, la fecha de solución y su propia cadena', async () => {
      const t04 = await obtenerTrabajo(demo.ctx, 'T04');
      expect(t04).toMatchObject({
        estado: 'bloqueado',
        bloqueadoPor: { id: 'T31', titulo: 'Conseguir un compresor de 2 HP' },
        fechaSolucion: enCR('2026-11-25', '15:00'),
        bloquea: ['T05', 'T06', 'T07'],
      });
      expect((await obtenerTrabajo(demo.ctx, 'T05'))?.bloquea).toEqual([]);
    });

    it('los dependientes ya resueltos no cuentan en bloquea', async () => {
      await persistirEfectos(demo.ctx.db, [{ tipo: 'actualizar_trabajo', trabajoId: 'T05', cambios: { estado: 'resuelto' }, actorId: null }]);
      expect((await obtenerTrabajo(demo.ctx, 'T31'))?.bloquea).toEqual(['T04', 'T06', 'T07']);
    });

    it('un seguimiento respondido deja de mostrarse', async () => {
      await persistirEfectos(demo.ctx.db, [{ tipo: 'actualizar_seguimiento', seguimientoId: 'S1', cambios: { estado: 'respondido' } }]);
      expect((await obtenerTrabajo(demo.ctx, 'T31'))?.seguimiento).toBeNull();
    });

    it('una necesidad atendida deja de aparecer en «necesita»', async () => {
      await persistirEfectos(demo.ctx.db, [
        { tipo: 'actualizar_necesidad', trabajoId: 'T04', repuestoId: 'compresor-2hp', cambios: { atendida: true } },
      ]);
      expect((await obtenerTrabajo(demo.ctx, 'T04'))?.necesita).toEqual([]);
    });
  });
});

describe('listarTrabajos', () => {
  it('sin filtro devuelve los 30 trabajos por plazo ascendente (empate por id)', async () => {
    const ts = await listarTrabajos(demo.ctx);
    expect(ts).toHaveLength(30);
    expect(ts[0]?.id).toBe('T01');
    const orden = ts.map((t) => [t.plazo.getTime(), t.id] as const);
    expect(orden).toEqual([...orden].sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)));
  });

  it('filtra por proyecto', async () => {
    const ts = await listarTrabajos(demo.ctx, { proyectoId: 'P1' });
    expect(ts.map((t) => t.id)).toEqual(['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07']);
  });

  it('filtra por responsable y combina filtros', async () => {
    const diego = await listarTrabajos(demo.ctx, { responsableId: 'diego-rojas' });
    expect(diego.map((t) => t.id).sort()).toEqual(['T02', 'T14', 'T19', 'T20', 'T21', 'T23', 'T24', 'T25', 'T26']);
    const ambos = await listarTrabajos(demo.ctx, { proyectoId: 'P4', responsableId: 'diego-rojas' });
    expect(ambos.map((t) => t.id).sort()).toEqual(['T19', 'T20', 'T21', 'T23', 'T24', 'T25', 'T26']);
  });

  it('un filtro sin coincidencias devuelve lista vacía', async () => {
    expect(await listarTrabajos(demo.ctx, { proyectoId: 'P9' })).toEqual([]);
  });

  it('cada vista lleva las marcas de calcularMarcas', async () => {
    vi.mocked(calcularMarcas).mockReturnValueOnce(marcasSimuladas());
    const ts = await listarTrabajos(demo.ctx, { proyectoId: 'P3' });
    expect(Object.fromEntries(ts.map((t) => [t.id, [t.marcas.atrasado, t.marcas.enRiesgo]]))).toEqual({
      T14: [false, false],
      T15: [true, false],
      T16: [false, true],
      T17: [false, true],
      T18: [false, true],
    });
  });
});

describe('listarProyectos', () => {
  it('devuelve los 5 proyectos en orden de semilla con su responsable y fecha', async () => {
    const ps = await listarProyectos(demo.ctx);
    expect(ps.map((p) => p.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'OD']);
    expect(ps[0]).toMatchObject({
      nombre: 'Cámara fría La Colina',
      responsable: { id: 'esteban-castro', nombre: 'Esteban Castro' },
      fecha: enCR('2026-11-27', '17:00'),
    });
    expect(ps[4]).toMatchObject({ nombre: 'Operación diaria', fecha: null });
  });

  it('cuenta los trabajos por estado (estado inicial: 8 resueltos, 2 en curso, 20 abiertos)', async () => {
    const ps = await listarProyectos(demo.ctx);
    const por = Object.fromEntries(ps.map((p) => [p.id, [p.total, p.abiertos, p.enCurso, p.bloqueados, p.resueltos]]));
    expect(por).toEqual({
      P1: [7, 3, 1, 0, 3],
      P2: [6, 4, 0, 0, 2],
      P3: [5, 4, 0, 0, 1],
      P4: [12, 9, 1, 0, 2],
      OD: [0, 0, 0, 0, 0],
    });
  });

  it('cuenta atrasados y en riesgo a partir de las marcas calculadas', async () => {
    vi.mocked(calcularMarcas).mockReturnValueOnce(marcasSimuladas());
    const ps = await listarProyectos(demo.ctx);
    const por = Object.fromEntries(ps.map((p) => [p.id, [p.atrasados, p.enRiesgo]]));
    expect(por).toEqual({ P1: [0, 0], P2: [0, 0], P3: [1, 3], P4: [1, 0], OD: [0, 0] });
  });

  it('refleja los bloqueos de la base', async () => {
    await aplicarBloqueo();
    const p1 = (await listarProyectos(demo.ctx)).find((p) => p.id === 'P1');
    expect(p1).toMatchObject({ total: 8, abiertos: 4, enCurso: 0, bloqueados: 1, resueltos: 3 });
  });
});

describe('obtenerProyecto', () => {
  it('devuelve el resumen y sus trabajos por plazo', async () => {
    const p = await obtenerProyecto(demo.ctx, 'P3');
    expect(p).toMatchObject({ id: 'P3', nombre: 'Repuestos críticos', total: 5, resueltos: 1, abiertos: 4 });
    expect(p?.responsable.id).toBe('lucia-mora');
    expect(p?.trabajos.map((t) => t.id)).toEqual(['T14', 'T15', 'T16', 'T17', 'T18']);
    expect(p?.trabajos.find((t) => t.id === 'T15')?.dependeDe).toEqual(['T14']);
  });

  it('el resumen coincide con el de listarProyectos', async () => {
    const lista = await listarProyectos(demo.ctx);
    for (const r of lista) {
      const { trabajos, ...resumen } = (await obtenerProyecto(demo.ctx, r.id)) ?? { trabajos: [] };
      expect(resumen).toEqual(r);
      expect(trabajos).toHaveLength(r.total);
    }
  });

  it('devuelve null si no existe y un proyecto vacío si no tiene trabajos', async () => {
    expect(await obtenerProyecto(demo.ctx, 'P9')).toBeNull();
    expect(await obtenerProyecto(demo.ctx, 'OD')).toMatchObject({ total: 0, trabajos: [] });
  });
});
