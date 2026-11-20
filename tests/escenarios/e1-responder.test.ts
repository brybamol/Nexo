// E1 por la interfaz: responder a un seguimiento sin pasar por la captura (servicios/estado-trabajos.ts). Tarea 3.4.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, eventos, notas } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { ErrorDominio } from '@/dominio/tipos';
import { cambiarEstado, responderSeguimiento } from '@/servicios/estado-trabajos';
import { avanzarReloj } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '11:59' });
  await avanzarReloj(demo.ctx, 11); // 12:10: T28 vencido y Paola ya tiene su solicitud
});
afterEach(async () => {
  await demo.cerrar();
});

const seguimientoT28 = async () => (await cargarInstantanea(demo.ctx.db)).seguimientos.filter((s) => s.trabajoId === 'T28');
const accionesT28 = async () => (await demo.ctx.db.select().from(acciones)).filter((a) => a.trabajoIds.includes('T28'));

describe('responderSeguimiento / cambiarEstado', () => {
  it('Paola responde cambiando el estado a resuelto: cierra el seguimiento, registra la acción y el evento, sin jefes', async () => {
    expect(await seguimientoT28()).toEqual([expect.objectContaining({ estado: 'pendiente' })]);
    await responderSeguimiento(demo.ctx, 'T28', 'paola-herrera', { estado: 'resuelto', nota: 'Ya la envié.' });

    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T28')?.estado).toBe('resuelto');
    expect((await seguimientoT28()).map((s) => s.estado)).toEqual(['respondido']);
    expect((await accionesT28()).map((a) => a.tipo)).toEqual(['pedir_estado', 'actualizar_trabajo']);
    expect((await demo.ctx.db.select().from(notas)).filter((n) => n.trabajoId === 'T28')).toHaveLength(1);
    const evs = await demo.ctx.db.select().from(eventos);
    expect(evs.some((e) => e.tipo === 'respuesta_seguimiento' && e.actorId === 'paola-herrera' && e.trabajoId === 'T28')).toBe(true);
    expect(evs.some((e) => e.tipo === 'estado_cambiado' && e.trabajoId === 'T28')).toBe(true);
  });

  it('responder sin cambiar nada cierra el seguimiento y deja la acción; el estado del trabajo no cambia', async () => {
    await responderSeguimiento(demo.ctx, 'T28', 'paola-herrera', {});
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T28')?.estado).toBe('abierto');
    expect((await seguimientoT28()).map((s) => s.estado)).toEqual(['respondido']);
    expect((await accionesT28()).map((a) => a.tipo)).toEqual(['pedir_estado', 'actualizar_trabajo']);
  });

  it('rechaza a quien no puede responder (no es de la cadena) o si no hay seguimiento pendiente', async () => {
    await expect(responderSeguimiento(demo.ctx, 'T28', 'andres-vargas', {})).rejects.toThrow(ErrorDominio);
    await expect(responderSeguimiento(demo.ctx, 'T01', 'paola-herrera', {})).rejects.toThrow(ErrorDominio);
    await expect(responderSeguimiento(demo.ctx, 'T99', 'paola-herrera', {})).rejects.toThrow('T99');
    await expect(responderSeguimiento(demo.ctx, 'T28', 'paola-herrera', { estado: 'otro' as never })).rejects.toThrow(ErrorDominio);
    expect((await seguimientoT28()).map((s) => s.estado)).toEqual(['pendiente']);
  });

  it('cambiarEstado a resuelto cierra el seguimiento; sin cambio real no hace nada', async () => {
    const antes = (await accionesT28()).length;
    await cambiarEstado(demo.ctx, 'T28', 'paola-herrera', 'abierto');
    expect((await accionesT28()).length).toBe(antes);

    await cambiarEstado(demo.ctx, 'T28', 'paola-herrera', 'en_curso');
    expect((await seguimientoT28()).map((s) => s.estado)).toEqual(['respondido']); // el responsable respondió
    await cambiarEstado(demo.ctx, 'T28', 'paola-herrera', 'resuelto');
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T28')).toMatchObject({ estado: 'resuelto' });
    expect(inst.trabajos.find((t) => t.id === 'T28')?.resueltoEn).not.toBeNull();
  });
});
