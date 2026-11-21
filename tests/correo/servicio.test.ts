// Servicio del correo con base PGlite: guarda correcciones, valida permisos y se reinicia con la demo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErrorDominio } from '@/dominio/tipos';
import { obtenerModeloCorreo, registrarCorreccion, vistaPersonaCorreo } from '@/servicios/correo';
import { reiniciarDemo } from '@/servicios/demo';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '07:00' });
});
afterEach(async () => {
  await demo.cerrar();
});

async function idDe(codigo: string): Promise<string> {
  const m = await obtenerModeloCorreo(demo.ctx);
  return m.compromisos.find((c) => c.codigo === codigo)!.id;
}

describe('servicio de correo', () => {
  it('las vistas por persona separan lo que le piden de lo que espera', async () => {
    const m = await obtenerModeloCorreo(demo.ctx);
    const carla = vistaPersonaCorreo(m, 'carla-fernandez');
    expect(carla.tePiden.map((c) => c.codigo)).toEqual(['C1', 'C2']);
    expect(carla.esperas.map((c) => c.codigo)).toEqual(['C7']);
    const luis = vistaPersonaCorreo(m, 'luis-mendez');
    expect(luis.resueltos.map((c) => c.codigo)).toEqual(['C3']);
  });

  it('guarda una corrección con la hora del reloj y la aplica', async () => {
    await registrarCorreccion(demo.ctx, { compromisoId: await idDe('C1'), personaId: 'carla-fernandez', tipo: 'corregir', cambios: { estado: 'en_curso' } });
    const m = await obtenerModeloCorreo(demo.ctx);
    const c1 = m.compromisos.find((c) => c.codigo === 'C1')!;
    expect(c1.estado).toBe('en_curso');
    expect(c1.revision).toMatchObject({ tipo: 'corregido', porId: 'carla-fernandez', en: m.ahora });
  });

  it('solo quien pidió o quien responde puede revisar', async () => {
    await expect(registrarCorreccion(demo.ctx, { compromisoId: await idDe('C1'), personaId: 'valeria-castro', tipo: 'confirmar' })).rejects.toThrow(ErrorDominio);
  });

  it('rechaza una corrección sin cambios y un responsable de fuera', async () => {
    const c1 = await idDe('C1');
    await expect(registrarCorreccion(demo.ctx, { compromisoId: c1, personaId: 'sergio-vargas', tipo: 'corregir', cambios: {} })).rejects.toThrow('No cambiaste nada');
    await expect(
      registrarCorreccion(demo.ctx, { compromisoId: c1, personaId: 'sergio-vargas', tipo: 'corregir', cambios: { responsableId: 'marcela-solis' } }),
    ).rejects.toThrow('Grupo Altavista');
  });

  it('reiniciar la demo borra las correcciones', async () => {
    await registrarCorreccion(demo.ctx, { compromisoId: await idDe('C3'), personaId: 'luis-mendez', tipo: 'descartar' });
    expect((await obtenerModeloCorreo(demo.ctx)).compromisos).toHaveLength(6);
    await reiniciarDemo(demo.ctx);
    expect((await obtenerModeloCorreo(demo.ctx)).compromisos).toHaveLength(7);
  });
});
