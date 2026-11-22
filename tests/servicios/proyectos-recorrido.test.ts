// Recorrido de proyectos (secuencia y orden por proximidad) contra PGlite en memoria, mié 25 nov 7:05.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { persistirEfectos } from '@/db/instantanea';
import { TRABAJOS_SEMILLA } from '@/db/semilla/datos';
import { enCR } from '@/dominio/tiempo';
import { listarRecorridos, obtenerRecorrido } from '@/servicios/proyectos';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo();
});
afterEach(async () => {
  await demo.cerrar();
});

async function bloquearInstalacion(): Promise<void> {
  const base = TRABAJOS_SEMILLA.find((t) => t.id === 'T05');
  if (!base) throw new Error('falta T05');
  await persistirEfectos(demo.ctx.db, [
    {
      tipo: 'crear_trabajo',
      trabajo: { ...base, id: 'T31', numero: 8, titulo: 'Conseguir compresor de 2 HP', estado: 'abierto', plazo: enCR('2026-11-25', '15:00'), responsableId: 'lucia-mora' },
      necesidades: [],
      actorId: 'jose-alfaro',
    },
    {
      tipo: 'actualizar_trabajo',
      trabajoId: 'T04',
      cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta el compresor de 2 HP', fechaSolucion: enCR('2026-11-25', '15:00') },
      actorId: 'jose-alfaro',
    },
  ]);
}

describe('listarRecorridos', () => {
  it('ordena por proximidad: viernes antes que lunes, el vacío sin fecha al final; a igual fecha, el más frenado', async () => {
    const rs = await listarRecorridos(demo.ctx);
    expect(rs.map((r) => r.id)).toEqual(['P4', 'P1', 'P3', 'P2', 'OD']);
    expect(rs.find((r) => r.id === 'P1')?.proximidad.texto).toBe('vence en 2 días');
    expect(rs.find((r) => r.id === 'OD')?.proximidad.texto).toBe('sin fecha');
  });

  it('usa el reloj de la demo', async () => {
    const [r] = await listarRecorridos(demo.ctx);
    expect(r?.ahora).toEqual(enCR('2026-11-25', '07:05'));
  });

  it('con la instalación bloqueada, La Colina pasa delante de Pedidos', async () => {
    await bloquearInstalacion();
    const rs = await listarRecorridos(demo.ctx);
    expect(rs.slice(0, 2).map((r) => r.id)).toEqual(['P1', 'P4']);
  });
});

describe('obtenerRecorrido', () => {
  it('La Colina: etapa actual en la instalación, con quién la tiene', async () => {
    const r = await obtenerRecorrido(demo.ctx, 'P1');
    expect(r?.modo).toBe('etapas');
    expect(r?.etapaActual).toBe(3);
    expect(r?.ahoraEn.map((x) => [x.trabajo.referencia, x.trabajo.responsable.nombre])).toEqual([['COLINA-4', 'José Alfaro']]);
    expect(r?.etapas[4]?.pasos[0]?.antes).toEqual([
      { id: 'T04', titulo: 'Instalar unidad condensadora y compresor', referencia: 'COLINA-4', resuelto: false },
    ]);
    expect(r?.etapas.map((e) => e.etiqueta)[0]).toBe('Etapa 1');
  });

  it('bloqueo: el paso que frena va justo antes, con su motivo, y aparece primero en los frenos', async () => {
    await bloquearInstalacion();
    const r = await obtenerRecorrido(demo.ctx, 'P1');
    expect(r?.etapas[2]?.pasos.map((x) => x.trabajo.referencia)).toEqual(['COLINA-3', 'COLINA-8']);
    expect(r?.frenos[0]?.trabajo.referencia).toBe('COLINA-4');
    expect(r?.frenos[0]?.motivoBloqueo).toBe('Falta el compresor de 2 HP');
    expect(r?.ahoraEn.map((x) => x.trabajo.referencia)).toEqual(['COLINA-8']);
  });

  it('Pedidos se agrupa por día con etiquetas legibles', async () => {
    const r = await obtenerRecorrido(demo.ctx, 'P4');
    expect(r?.modo).toBe('dias');
    expect(r?.etapas.map((e) => e.etiqueta)).toEqual([
      'lun 23 nov',
      'Ayer, mar 24 nov',
      'Hoy, mié 25 nov',
      'Mañana, jue 26 nov',
      'vie 27 nov',
    ]);
  });

  it('Operación diaria está vacío; un proyecto inexistente es null', async () => {
    expect(await obtenerRecorrido(demo.ctx, 'OD')).toMatchObject({ etapas: [], etapaActual: null, terminado: false, total: 0 });
    expect(await obtenerRecorrido(demo.ctx, 'P9')).toBeNull();
  });
});
