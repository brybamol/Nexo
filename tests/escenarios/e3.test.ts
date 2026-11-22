// E3 · Propagación entre proyectos (R4 y R5): C01 a las 7:05 con el servicio real de captura. Tarea 3.2.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { calcularMarcas } from '@/motor/marcas';
import { capturar } from '@/servicios/captura';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';

describe('E3 · propagación entre proyectos', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  /** Avisos de propagación = avisos de esta captura que no son la asignación de T31 a Lucía. */
  const avisosPropagacion = async () => {
    const filasAcciones = await demo.ctx.db.select().from(acciones);
    const filasAvisos = await demo.ctx.db.select().from(avisos);
    return filasAvisos
      .filter((a) => !a.trabajoIds.includes('T31'))
      .map((a) => ({ ...a, accion: filasAcciones.find((x) => x.id === a.accionId) }));
  };

  it('T04 bloqueado; en riesgo T05, T06, T07, T10, T11, T13 (más T16–T18 que ya lo estaban)', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(r.estado).toBe('aplicada');
    const inst = await cargarInstantanea(demo.ctx.db);
    const t04 = inst.trabajos.find((t) => t.id === 'T04');
    expect(t04).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31', fechaSolucion: null });
    expect(inst.repuestos.find((x) => x.id === 'compresor-2hp')?.faltanteReportadoPor).toBe('jose-alfaro');
    const marcas = calcularMarcas(inst);
    const enRiesgo = [...marcas].filter(([, m]) => m.enRiesgo).map(([id]) => id).sort();
    expect(enRiesgo).toEqual(['T05', 'T06', 'T07', 'T10', 'T11', 'T13', 'T16', 'T17', 'T18']);
  });

  it('cinco avisos de propagación, uno por persona; Mario recibe uno con T05 y T11; todos citan T15', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    const props = await avisosPropagacion();
    const porPersona = Object.fromEntries(props.map((a) => [a.personaId, a.trabajoIds]));
    expect(props).toHaveLength(5);
    expect(porPersona).toEqual({
      'mario-chaves': ['T05', 'T11'],
      'esteban-castro': ['T06'],
      'ricardo-brenes': ['T07'],
      'daniela-quesada': ['T10'],
      'sofia-navarro': ['T13'],
    });
    for (const a of props) {
      expect(a.cuerpo).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
      expect(a.accion).toMatchObject({ tipo: 'aviso', destinatarioId: a.personaId, capturaId: r.capturaId });
      expect(a.accion?.hechoOrigen).toBe(`José Alfaro escribió: «${C01}»`);
    }
    const mario = props.find((a) => a.personaId === 'mario-chaves');
    // Dos proyectos: la referencia lleva la clave de cada uno (COLINA = Cámara fría La Colina, TRIGAL = Mantenimiento Trigal).
    expect(mario?.cuerpo).toContain('«Cableado y tablero de control» (COLINA-5)'); // T05
    expect(mario?.cuerpo).toContain('«Cambiar compresor en local Curridabat» (TRIGAL-4)'); // T11
    // El nombre del repuesto tal como está en los datos («2 HP», no «2 hp»).
    for (const a of props) expect(a.cuerpo).not.toContain('2 hp');
    expect(mario?.cuerpo).toContain('falta compresor de 2 HP');
    const t10 = props.find((a) => a.personaId === 'daniela-quesada');
    expect(t10?.cuerpo).toContain('necesita compresor de 2 HP');
    // Al autor (José) no se le avisa; Lucía solo recibe su aviso de asignación.
    expect(props.some((a) => a.personaId === 'jose-alfaro' || a.personaId === 'lucia-mora')).toBe(false);
    if (r.estado === 'aplicada') {
      expect(new Set(r.avisosA)).toEqual(
        new Set(['lucia-mora', 'mario-chaves', 'esteban-castro', 'ricardo-brenes', 'daniela-quesada', 'sofia-navarro']),
      );
    }
  });

  it('C15 bloquea T24, que no tiene dependientes: ningún aviso de propagación', async () => {
    await capturar(demo.ctx, 'diego-rojas', 'Se cayó una vitrina del pedido 1045 en bodega, quedó con el vidrio quebrado');
    expect(await avisosPropagacion()).toHaveLength(0);
  });
});
