// Sugerencias de un clic del panel de Nexo (src/componentes/agente/sugerencias.ts): se envían sin que la persona
// las revise, así que solo pueden ser preguntas. Esta prueba fija que el intérprete Local las entiende como tales:
// cada una, pasada por capturar, devuelve una respuesta con su tema y no cambia nada en la base.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, decisiones, eventos, trabajos } from '@/db/esquema';
import { TEXTO_NO_LO_SE } from '@/ia/local/preguntas-local';
import { capturar } from '@/servicios/captura';
import { SUGERENCIAS_PREGUNTA } from '@/componentes/agente/sugerencias';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

describe('sugerencias de un clic del panel de Nexo', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
  });
  const contar = async () => ({
    trabajos: (await demo.ctx.db.select().from(trabajos)).length,
    decisiones: (await demo.ctx.db.select().from(decisiones)).length,
    acciones: (await demo.ctx.db.select().from(acciones)).length,
    eventos: (await demo.ctx.db.select().from(eventos)).length,
  });

  it('son cuatro preguntas distintas', () => {
    expect(SUGERENCIAS_PREGUNTA).toHaveLength(4);
    expect(new Set(SUGERENCIAS_PREGUNTA.map((s) => s.tema)).size).toBe(4);
    for (const s of SUGERENCIAS_PREGUNTA) expect(s.texto).toMatch(/^¿.+\?$/);
  });

  for (const s of SUGERENCIAS_PREGUNTA) {
    it(`«${s.texto}» se responde (${s.tema}) y no crea ni cambia nada`, async () => {
      const antes = await contar();
      const r = await capturar(demo.ctx, 'paola-herrera', s.texto);
      expect(r.estado).toBe('respuesta');
      if (r.estado !== 'respuesta') return;
      expect(r.respuesta.tema).toBe(s.tema);
      expect(r.respuesta.texto).not.toBe(TEXTO_NO_LO_SE);
      expect(await contar()).toEqual(antes);
    });
  }
});
