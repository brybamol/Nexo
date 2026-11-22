// La tarjeta de decisión lee textos que arma el motor (`contexto` y `consecuencia`). Esta prueba ata esa lectura a la
// decisión real de la demo: si el motor cambia la forma de sus textos, aquí se nota antes que en la pantalla.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { afectadosPorProyecto, efectosPorProyecto, partirContexto } from '@/componentes/decisiones/presentacion';
import { capturar } from '@/servicios/captura';
import { listarDecisiones } from '@/servicios/decisiones';
import type { DecisionVista } from '@/servicios/vistas';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';

describe('presentación de la decisión de la demo', () => {
  let demo: Demo;
  let d: DecisionVista;

  beforeEach(async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    await capturar(demo.ctx, 'lucia-mora', C11);
    [d] = (await listarDecisiones(demo.ctx)) as [DecisionVista];
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  it('parte el contexto en frases con su etiqueta', () => {
    const hechos = partirContexto(d.contexto);
    expect(hechos.map((h) => h.etiqueta)).toEqual([null, 'Existencia corregida', 'Esperan el repuesto', 'Causa']);
    // No se pierde ni se inventa texto: unidas, las frases son el contexto del motor.
    expect(hechos.map((h) => (h.etiqueta ? `${h.etiqueta}: ${h.texto}` : h.texto)).join(' ')).toBe(d.contexto);
  });

  it('resume el efecto de cada opción por proyecto', () => {
    const efectos = efectosPorProyecto(d.opciones);
    expect(efectos).not.toBeNull();
    expect(efectos!.proyectos).toEqual(['Cámara fría La Colina', 'Mantenimiento Trigal']);
    expect(efectos!.porOpcion.A).toEqual({
      'Cámara fría La Colina': { tipo: 'a_tiempo' },
      'Mantenimiento Trigal': { tipo: 'a_tiempo' },
    });
    expect(efectos!.porOpcion.B).toEqual({
      'Cámara fría La Colina': { tipo: 'atrasa', hasta: 'jue 3 dic' },
      'Mantenimiento Trigal': { tipo: 'atrasa', hasta: 'jue 3 dic' },
    });
    expect(efectos!.porOpcion.C).toEqual({
      'Cámara fría La Colina': { tipo: 'a_tiempo' },
      'Mantenimiento Trigal': { tipo: 'atrasa', hasta: 'jue 3 dic' },
    });
  });

  it('agrupa los trabajos afectados por proyecto, con su nombre', () => {
    const grupos = afectadosPorProyecto(d);
    expect(grupos.map((g) => [g.nombre, g.trabajos.length])).toEqual([
      ['Cámara fría La Colina', 4],
      ['Mantenimiento Trigal', 3],
    ]);
  });

  it('si la consecuencia no tiene la forma esperada, no resume: la tarjeta muestra el texto completo', () => {
    const rara = d.opciones.map((o) => ({ ...o, consecuencia: 'Repone el inventario: ningún trabajo espera este repuesto.' }));
    expect(efectosPorProyecto(rara)).toBeNull();
  });
});
