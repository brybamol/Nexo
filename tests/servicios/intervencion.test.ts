// Reforma de escalamiento, regla 2, en el servidor: reasignar, mover el plazo y declarar bloqueo con la base real.
// La autorización se valida en el servicio (no solo en la interfaz); cada acción queda registrada y avisa.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos, eventos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';
import { calcularMarcas } from '@/motor/marcas';
import { capturar } from '@/servicios/captura';
import { declararBloqueoTrabajo, moverPlazoTrabajo, obtenerPermisosActuar, reasignarTrabajo } from '@/servicios/estado-trabajos';
import { obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import { fijarReloj, irAlSiguienteEvento } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';

let demo: Demo;
beforeEach(async () => {
  // Guion hasta las 8:05: C01 a las 7:05, recordatorio a Lucía a las 7:35 y escalamiento a Esteban a las 8:05.
  demo = await prepararDemo();
  await fijarReloj(demo.ctx, enCR(MIE, '07:05'));
  await capturar(demo.ctx, 'jose-alfaro', C01);
  await irAlSiguienteEvento(demo.ctx);
  await irAlSiguienteEvento(demo.ctx);
});
afterEach(async () => {
  await demo.cerrar();
});

const t31 = async () => (await cargarInstantanea(demo.ctx.db)).trabajos.find((t) => t.id === 'T31');
const seguimientoT31 = async () => (await cargarInstantanea(demo.ctx.db)).seguimientos.find((s) => s.trabajoId === 'T31');

describe('autorización en el servidor', () => {
  it('solo el responsable del proyecto, a quien se escaló y el responsable de la operación; nada cambia si se rechaza', async () => {
    const antes = (await demo.ctx.db.select().from(acciones)).length;
    for (const p of ['lucia-mora', 'jose-alfaro', 'marcela-solis', 'karla-jimenez']) {
      await expect(reasignarTrabajo(demo.ctx, 'T31', p, 'diego-rojas', '')).rejects.toBeInstanceOf(ErrorDominio);
      await expect(moverPlazoTrabajo(demo.ctx, 'T31', p, enCR('2026-11-26', '12:00'), 'Motivo')).rejects.toBeInstanceOf(ErrorDominio);
      await expect(declararBloqueoTrabajo(demo.ctx, 'T31', p, 'Motivo')).rejects.toBeInstanceOf(ErrorDominio);
    }
    await expect(reasignarTrabajo(demo.ctx, 'T31', 'nadie', 'diego-rojas', '')).rejects.toBeInstanceOf(ErrorDominio);
    expect((await demo.ctx.db.select().from(acciones)).length).toBe(antes);
    expect((await t31())?.responsableId).toBe('lucia-mora');
  });

  it('obtenerPermisosActuar dice a quién mostrarle las acciones, con la razón y las personas para reasignar', async () => {
    const esteban = await obtenerPermisosActuar(demo.ctx, 'esteban-castro', ['T31', 'T15']);
    expect(Object.keys(esteban.trabajos)).toEqual(['T31']);
    expect(esteban.trabajos.T31).toMatchObject({ razon: 'responsable del proyecto', responsableId: 'lucia-mora', plazo: enCR(MIE, '12:00') });
    expect(esteban.personas.map((p) => p.id)).toContain('diego-rojas');
    expect((await obtenerPermisosActuar(demo.ctx, 'andres-vargas', ['T31'])).trabajos.T31?.razon).toBe('responsable de la operación');
    expect((await obtenerPermisosActuar(demo.ctx, 'lucia-mora', ['T31'])).trabajos).toEqual({});
    expect((await obtenerPermisosActuar(demo.ctx, 'lucia-mora', ['T15'])).trabajos.T15?.razon).toBe('responsable del proyecto');
  });
});

describe('las tres acciones con la base real', () => {
  it('Esteban reasigna a Diego: responsable nuevo, evento con actor, registro, avisos y fuera de «Nexo te pide»', async () => {
    expect((await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro')).map((t) => t.id)).toEqual(['T31']);
    const r = await reasignarTrabajo(demo.ctx, 'T31', 'esteban-castro', 'diego-rojas', 'Diego está en bodega');
    expect([...r.avisosA].sort()).toEqual(['diego-rojas', 'lucia-mora']);
    expect((await t31())?.responsableId).toBe('diego-rojas');
    expect(await seguimientoT31()).toMatchObject({ estado: 'respondido', escaladosA: ['esteban-castro'] });
    const evs = (await demo.ctx.db.select().from(eventos)).filter((e) => e.trabajoId === 'T31');
    expect(evs).toContainEqual(expect.objectContaining({ tipo: 'responsable_cambiado', actorId: 'esteban-castro', datos: { de: 'lucia-mora', a: 'diego-rojas' } }));
    expect(evs).toContainEqual(expect.objectContaining({ tipo: 'respuesta_seguimiento', actorId: 'esteban-castro' }));
    const registro = (await demo.ctx.db.select().from(acciones)).filter((a) => a.tipo === 'actualizar_trabajo' && a.trabajoIds.includes('T31')).at(-1);
    expect(registro?.motivo).toContain('Diego está en bodega');
    expect(registro?.hechoOrigen).toContain('Esteban Castro reasignó');
    const avisosDiego = (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === 'diego-rojas' && a.trabajoIds.includes('T31'));
    expect(avisosDiego).toHaveLength(1);
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro')).toEqual([]);
    expect((await obtenerMiDia(demo.ctx, 'diego-rojas')).debo.map((t) => t.id)).toContain('T31');
    expect((await obtenerMiDia(demo.ctx, 'lucia-mora')).debo.map((t) => t.id)).not.toContain('T31');
  });

  it('Esteban mueve el plazo con motivo: evento plazo_cambiado, seguimiento cerrado y sin escalamiento a las 8:35', async () => {
    await moverPlazoTrabajo(demo.ctx, 'T31', 'esteban-castro', enCR('2026-11-26', '12:00'), 'El proveedor lo trae mañana');
    expect((await t31())?.plazo).toEqual(enCR('2026-11-26', '12:00'));
    expect(await seguimientoT31()).toMatchObject({ estado: 'respondido' });
    const evs = (await demo.ctx.db.select().from(eventos)).filter((e) => e.trabajoId === 'T31');
    expect(evs).toContainEqual(expect.objectContaining({ tipo: 'plazo_cambiado', actorId: 'esteban-castro' }));
    await fijarReloj(demo.ctx, enCR(MIE, '08:35'));
    const escs = (await demo.ctx.db.select().from(acciones)).filter((a) => a.tipo === 'escalamiento' && a.trabajoIds.includes('T31'));
    expect(escs.map((a) => a.destinatarioId)).toEqual(['esteban-castro']);
    await expect(moverPlazoTrabajo(demo.ctx, 'T31', 'esteban-castro', enCR(MIE, '08:00'), 'Motivo')).rejects.toThrow('posterior');
    await expect(moverPlazoTrabajo(demo.ctx, 'T31', 'esteban-castro', enCR('2026-11-27', '12:00'), ' ')).rejects.toThrow('motivo');
  });

  it('Esteban declara bloqueado el trabajo: estado Bloqueado con su motivo y el riesgo se recalcula (no se guarda)', async () => {
    await declararBloqueoTrabajo(demo.ctx, 'T31', 'esteban-castro', 'El proveedor local no tiene compresores');
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T31')).toMatchObject({ estado: 'bloqueado', motivoBloqueo: 'El proveedor local no tiene compresores', bloqueadoPorId: null });
    expect(calcularMarcas(inst).get('T31')?.enRiesgo).toBe(false); // bloqueado: no es «en riesgo», es fuente
    expect(await seguimientoT31()).toMatchObject({ estado: 'respondido' });
    const avisoLucia = (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === 'lucia-mora').at(-1);
    expect(avisoLucia?.cuerpo).toContain('El proveedor local no tiene compresores');
    await expect(declararBloqueoTrabajo(demo.ctx, 'T31', 'esteban-castro', 'Otra vez')).rejects.toThrow('ya está bloqueado');
  });
});
