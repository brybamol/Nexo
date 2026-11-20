// Cifras de la demo (05 §5). Pruebas puras de calcularCifras. Tarea 4.4.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Accion, Evento, Trabajo } from '@/dominio/tipos';
import { calcularCifras } from '@/motor/cifras';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const GERENTE = 'marcela-solis';
const AHORA = enCR('2026-11-25', '07:05');

function semilla(): Trabajo[] {
  return instantaneaDesdeSemilla().trabajos;
}

function eventoGerente(trabajoId: string, id = 1): Evento {
  return { id, en: AHORA, actorId: GERENTE, tipo: 'nota_agregada', trabajoId, decisionId: null, datos: {} };
}

/** Los dos eventos reales de la gerente en la semilla: T19 y T20. */
const EVENTOS_SEMILLA: Evento[] = [eventoGerente('T19', 1), eventoGerente('T20', 2)];

function accion(id: number, tipo: Accion['tipo']): Accion {
  return {
    id,
    en: AHORA,
    tipo,
    motivo: 'prueba',
    hechoOrigen: 'prueba',
    trabajoIds: [],
    decisionId: null,
    destinatarioId: null,
    capturaId: null,
  };
}

function acciones(tipo: Accion['tipo'], n: number, desde = 1): Accion[] {
  return Array.from({ length: n }, (_, i) => accion(desde + i, tipo));
}

describe('calcularCifras', () => {
  it('estado inicial de la semilla: 6 de 8 resueltos sin la gerente (75 %), 0 seguimientos, 0 minutos', () => {
    const c = calcularCifras({ trabajos: semilla(), eventos: EVENTOS_SEMILLA, acciones: [], preguntasRespondidas: 0, gerenteId: GERENTE });
    expect(c).toEqual({
      resueltosSinGerente: 6,
      resueltosTotal: 8,
      porcentaje: 75,
      seguimientos: 0,
      preguntasRespondidas: 0,
      minutosAhorrados: 0,
      horasAhorradas: 0,
    });
  });

  it('19 seguimientos y 1 pregunta dan 205 min y 3,4 h', () => {
    const acc = [
      ...acciones('pedir_estado', 5, 1),
      ...acciones('recordatorio', 6, 10),
      ...acciones('escalamiento', 4, 20),
      ...acciones('aviso', 4, 30),
      // Las que no cuentan como seguimiento no suman.
      ...acciones('crear_trabajo', 3, 40),
      ...acciones('responder_pregunta', 2, 50),
    ];
    const c = calcularCifras({ trabajos: semilla(), eventos: EVENTOS_SEMILLA, acciones: acc, preguntasRespondidas: 1, gerenteId: GERENTE });
    expect(c.seguimientos).toBe(19);
    expect(c.preguntasRespondidas).toBe(1);
    expect(c.minutosAhorrados).toBe(205);
    expect(c.horasAhorradas).toBe(3.4);
  });

  it('sin trabajos resueltos el porcentaje es 0 y no divide por cero', () => {
    const abiertos = semilla().map((t) => ({ ...t, estado: 'abierto' as const }));
    const c = calcularCifras({ trabajos: abiertos, eventos: EVENTOS_SEMILLA, acciones: [], preguntasRespondidas: 0, gerenteId: GERENTE });
    expect(c.resueltosTotal).toBe(0);
    expect(c.resueltosSinGerente).toBe(0);
    expect(c.porcentaje).toBe(0);
    expect(Number.isNaN(c.porcentaje)).toBe(false);
  });

  it('un evento de la gerente sobre un trabajo NO resuelto no cambia la cifra 1', () => {
    const trabajos = semilla();
    const noResuelto = trabajos.find((t) => t.estado !== 'resuelto');
    expect(noResuelto).toBeDefined();
    const base = calcularCifras({ trabajos, eventos: EVENTOS_SEMILLA, acciones: [], preguntasRespondidas: 0, gerenteId: GERENTE });
    const conEvento = calcularCifras({
      trabajos,
      eventos: [...EVENTOS_SEMILLA, eventoGerente(noResuelto!.id, 99)],
      acciones: [],
      preguntasRespondidas: 0,
      gerenteId: GERENTE,
    });
    expect(conEvento.resueltosSinGerente).toBe(base.resueltosSinGerente);
    expect(conEvento.porcentaje).toBe(base.porcentaje);
  });

  it('un evento de la gerente sobre un trabajo resuelto sí cuenta como intervención', () => {
    const c = calcularCifras({
      trabajos: semilla(),
      eventos: [...EVENTOS_SEMILLA, eventoGerente('T01', 99)],
      acciones: [],
      preguntasRespondidas: 0,
      gerenteId: GERENTE,
    });
    expect(c.resueltosSinGerente).toBe(5);
    expect(c.porcentaje).toBe(63);
  });

  it('eventos de otras personas no cuentan como intervención de la gerente', () => {
    const otro: Evento = { ...eventoGerente('T01', 99), actorId: 'andres-vargas' };
    const c = calcularCifras({ trabajos: semilla(), eventos: [...EVENTOS_SEMILLA, otro], acciones: [], preguntasRespondidas: 0, gerenteId: GERENTE });
    expect(c.resueltosSinGerente).toBe(6);
  });
});
