// Servicio del correo con base PGlite: guarda correcciones, valida permisos y se reinicia con la demo.
// Datos de Frío del Valle (docs/08 §5). El reloj de la demo arranca a las 7:00 del mié 25.
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
    expect(m.compromisos.map((c) => c.codigo)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);
    const ricardo = vistaPersonaCorreo(m, 'ricardo-brenes');
    expect(ricardo.tePiden.map((c) => c.codigo)).toEqual(['C1']);
    expect(ricardo.esperas).toEqual([]);
    expect(ricardo.resueltos.map((c) => c.codigo)).toEqual(['C2']);
    const andres = vistaPersonaCorreo(m, 'andres-vargas');
    expect(andres.tePiden).toEqual([]);
    expect(andres.esperas.map((c) => c.codigo)).toEqual(['C4', 'C1']);
  });

  it('guarda una corrección con la hora del reloj y la aplica', async () => {
    await registrarCorreccion(demo.ctx, { compromisoId: await idDe('C1'), personaId: 'ricardo-brenes', tipo: 'corregir', cambios: { estado: 'en_curso' } });
    const m = await obtenerModeloCorreo(demo.ctx);
    const c1 = m.compromisos.find((c) => c.codigo === 'C1')!;
    expect(c1.estado).toBe('en_curso');
    expect(c1.revision).toMatchObject({ tipo: 'corregido', porId: 'ricardo-brenes', en: m.ahora });
  });

  it('solo quien pidió o quien responde puede revisar', async () => {
    await expect(registrarCorreccion(demo.ctx, { compromisoId: await idDe('C1'), personaId: 'jose-alfaro', tipo: 'confirmar' })).rejects.toThrow(ErrorDominio);
  });

  it('rechaza una corrección sin cambios y un responsable de fuera', async () => {
    const c1 = await idDe('C1');
    await expect(registrarCorreccion(demo.ctx, { compromisoId: c1, personaId: 'andres-vargas', tipo: 'corregir', cambios: {} })).rejects.toThrow('No cambiaste nada');
    await expect(
      registrarCorreccion(demo.ctx, { compromisoId: c1, personaId: 'andres-vargas', tipo: 'corregir', cambios: { responsableId: 'persona-externa' } }),
    ).rejects.toThrow('Frío del Valle');
  });

  it('reiniciar la demo borra las correcciones', async () => {
    await registrarCorreccion(demo.ctx, { compromisoId: await idDe('C2'), personaId: 'ricardo-brenes', tipo: 'descartar' });
    expect((await obtenerModeloCorreo(demo.ctx)).compromisos).toHaveLength(5);
    await reiniciarDemo(demo.ctx);
    expect((await obtenerModeloCorreo(demo.ctx)).compromisos).toHaveLength(6);
  });
});
