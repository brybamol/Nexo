// «Mi día» a nivel de servicio (4.1): lo que debo, lo que espero de otros, avisos y seguimientos pendientes.
import { afterEach, describe, expect, it } from 'vitest';
import { capturar } from '@/servicios/captura';
import { marcarAvisosLeidos, obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import { avanzarReloj } from '@/servicios/reloj';
import { cambiarEstado, responderSeguimiento } from '@/servicios/estado-trabajos';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
let demo: Demo;
afterEach(async () => {
  await demo.cerrar();
});

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('obtenerMiDia', () => {
  it('estado inicial, Lucía Mora: debe T15 (atrasado) y T16; sin avisos', async () => {
    demo = await prepararDemo();
    const d = await obtenerMiDia(demo.ctx, 'lucia-mora');
    expect(d.persona.id).toBe('lucia-mora');
    expect(ids(d.debo)).toContain('T15');
    expect(ids(d.debo)).toContain('T16');
    expect(d.debo.every((t) => t.responsable.id === 'lucia-mora' && t.estado !== 'resuelto')).toBe(true);
    expect(d.debo.find((t) => t.id === 'T15')?.marcas.atrasado).toBe(true);
    expect(ids(d.debo)[0]).toBe('T15'); // atrasado antes que el resto
    expect(d.avisos).toEqual([]);
  });

  it('tras C01, Lucía tiene T31 arriba (urgente), quién lo pidió, qué bloquea y su aviso de asignación', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const d = await obtenerMiDia(demo.ctx, 'lucia-mora');
    const t31 = d.debo[0];
    expect(t31?.id).toBe('T31');
    expect(t31?.urgente).toBe(true);
    expect(t31?.solicitadoPor?.id).toBe('jose-alfaro');
    expect(t31?.bloquea).toContain('T04');
    expect(ids(d.debo)).toContain('T15');
    const aviso = d.avisos.find((a) => a.trabajoIds.includes('T31'));
    expect(aviso).toBeDefined();
    expect(aviso?.leido).toBe(false);
    expect(aviso?.titulo.length).toBeGreaterThan(0);
    // Del más reciente al más antiguo.
    const tiempos = d.avisos.map((a) => a.en.getTime());
    expect(tiempos).toEqual([...tiempos].sort((a, b) => b - a));
  });

  it('una persona sin nada pendiente recibe secciones vacías, sin errores', async () => {
    demo = await prepararDemo();
    // Marcela Solís resuelve lo suyo y queda sin trabajos pendientes.
    for (const t of (await obtenerMiDia(demo.ctx, 'marcela-solis')).debo) {
      await cambiarEstado(demo.ctx, t.id, 'marcela-solis', 'resuelto');
    }
    const d = await obtenerMiDia(demo.ctx, 'marcela-solis');
    expect(d.debo).toEqual([]);
    expect(d.esperoDeOtros).toEqual([]);
    expect(d.avisos).toEqual([]);
    expect(d.decisionesPendientes).toEqual([]);
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'marcela-solis')).toEqual([]);
  });

  it('«lo que espero de otros»: José ve T31 tras C01 (lo solicitó y bloquea su T04), sin repetir y sin lo suyo', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const d = await obtenerMiDia(demo.ctx, 'jose-alfaro');
    expect(ids(d.esperoDeOtros)).toContain('T31');
    expect(new Set(ids(d.esperoDeOtros)).size).toBe(d.esperoDeOtros.length);
    expect(d.esperoDeOtros.every((t) => t.responsable.id !== 'jose-alfaro' && t.estado !== 'resuelto')).toBe(true);
    expect(ids(d.debo)).toContain('T04');
    expect(ids(d.debo)).not.toContain('T31');
  });

  it('una persona desconocida da error de dominio', async () => {
    demo = await prepararDemo();
    await expect(obtenerMiDia(demo.ctx, 'nadie')).rejects.toThrow(/No existe la persona/);
  });

  it('los avisos de propagación agrupados por riesgo (E3) aparecen citando trabajos de varios proyectos', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const d = await obtenerMiDia(demo.ctx, 'mario-chaves');
    // Mario recibe UN aviso con T05 (La Colina, P1) y T11 (Trigal, P2), que cita la causa: el conteo T15.
    expect(d.avisos).toHaveLength(1);
    expect(d.avisos[0]).toMatchObject({ tipoAccion: 'aviso', trabajoIds: ['T05', 'T11'], leido: false });
    expect(d.avisos[0]?.cuerpo).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
    const proyectos = new Set(d.debo.filter((t) => d.avisos[0]!.trabajoIds.includes(t.id)).map((t) => t.proyecto.id));
    expect(proyectos).toEqual(new Set(['P1', 'P2']));
    expect(d.debo.filter((t) => t.id === 'T05' || t.id === 'T11').every((t) => t.marcas.enRiesgo)).toBe(true);
    // Lucía no recibe aviso de propagación: el autor es José y ella es la responsable del bloqueante (aviso de asignación).
    const lucia = await obtenerMiDia(demo.ctx, 'lucia-mora');
    expect(lucia.avisos.map((a) => a.trabajoIds)).toEqual([['T31']]);
  });
});

describe('seguimientos pendientes', () => {
  it('cuando Nexo pide el estado de T15 aparece en la sección y desaparece al responder', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora')).toEqual([]);
    await avanzarReloj(demo.ctx, 5);
    const antes = await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora');
    expect(ids(antes)).toEqual(['T15']);
    expect(antes[0]?.seguimiento).not.toBeNull();
    // Quien no es responsable ni jefe escalado no lo ve.
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'jose-alfaro')).toEqual([]);

    await responderSeguimiento(demo.ctx, 'T15', 'lucia-mora', { estado: 'en_curso', nota: 'Ya salió el pedido' });
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora')).toEqual([]);
  });

  it('T31 pendiente: Lucía lo ve; Esteban (responsable de La Colina) solo cuando ya se le escaló; Andrés (jefe de Lucía) nunca', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora'))).toContain('T31');
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro'))).not.toContain('T31');
    await avanzarReloj(demo.ctx, 60); // 8:05: escalamiento a Esteban
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro'))).toContain('T31');
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'andres-vargas'))).not.toContain('T31');
  });
});

describe('marcarAvisosLeidos', () => {
  it('marca los avisos de la persona sin tocar los de otras', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    expect((await obtenerMiDia(demo.ctx, 'lucia-mora')).avisos.some((a) => !a.leido)).toBe(true);
    await marcarAvisosLeidos(demo.ctx, 'lucia-mora');
    expect((await obtenerMiDia(demo.ctx, 'lucia-mora')).avisos.every((a) => a.leido)).toBe(true);
  });
});
