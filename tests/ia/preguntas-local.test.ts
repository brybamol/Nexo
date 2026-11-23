import { describe, expect, it } from 'vitest';
import type { ContextoCaptura, HechosPregunta } from '@/ia/interprete';
import { clasificarPregunta, proyectoMencionado, redactarRespuesta } from '@/ia/local/preguntas-local';

const ctx = {
  proyectos: [
    { id: 'P1', nombre: 'Cámara fría La Colina', responsableId: 'esteban-castro' },
    { id: 'P3', nombre: 'Repuestos críticos', responsableId: 'lucia-mora' },
  ],
} as unknown as ContextoCaptura;

describe('consultas locales por correo', () => {
  it('clasifica una consulta cordial sobre atrasos sin signos de interrogación', () => {
    const texto = 'Buenas tardes. Me gustaría saber cuántos trabajos atrasados tenemos en el proyecto Repuestos críticos. Muchas gracias.';
    expect(clasificarPregunta(texto, ctx)).toBe('atrasados');
    expect(proyectoMencionado(texto, ctx.proyectos)).toBe('P3');
  });

  it('identifica el proyecto en la respuesta de atrasos', () => {
    const hechos: HechosPregunta = {
      tema: 'atrasados',
      fuentes: [],
      datos: {
        proyecto: 'Repuestos críticos',
        atrasados: [{ trabajoId: 'T15', titulo: 'Conciliar el conteo', responsable: 'Lucía Mora', estado: 'abierto', plazo: 'mar 24 nov, 17:00', detalle: 'plazo vencido' }],
        bloqueados: [],
        enRiesgo: [],
      },
    };
    expect(redactarRespuesta('¿Cuántos trabajos atrasados hay en Repuestos críticos?', hechos))
      .toContain('Proyecto: Repuestos críticos');
  });
});
