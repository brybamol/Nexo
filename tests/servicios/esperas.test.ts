// Cuellos de botella para Proyectos (docs/08 regla 23): obtenerCuellos = calcularEsperas sobre lo que ve quien mira.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cargarInstantanea } from '@/db/instantanea';
import { calcularEsperas } from '@/motor/esperas';
import { instantaneaVisible } from '@/motor/instantanea';
import { obtenerVistaCorreo } from '@/servicios/correo';
import { obtenerCuellos } from '@/servicios/esperas';
import { avanzarReloj } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '07:00', correo: true });
});
afterEach(async () => {
  await demo.cerrar();
});

describe('obtenerCuellos', () => {
  it('coincide con calcularEsperas sobre lo visible, con nombres, para cada persona', async () => {
    await avanzarReloj(demo.ctx, 5);
    const completa = await cargarInstantanea(demo.ctx.db);
    for (const p of completa.personas) {
      const esperado = calcularEsperas(instantaneaVisible(completa, p.id)).cuellos;
      const cuellos = await obtenerCuellos(demo.ctx, p.id);
      expect(cuellos.map((c) => [c.persona.id, c.proyectos.map((x) => x.id), c.esperando.map((x) => x.id)])).toEqual(
        esperado.map((c) => [c.personaId, c.proyectoIds, c.esperando]),
      );
      expect(cuellos.every((c) => c.persona.nombre !== '' && c.proyectos.every((x) => x.nombre !== ''))).toBe(true);
      // Misma respuesta que la vista de correo, que ya no los pinta pero los sigue entregando.
      expect(cuellos).toEqual((await obtenerVistaCorreo(demo.ctx, p.id)).esperas.cuellos);
    }
  });

  it('sin cuellos devuelve una lista vacía (el aviso no se muestra)', async () => {
    expect(await obtenerCuellos(demo.ctx, 'marcela-solis')).toEqual([]);
  });
});
