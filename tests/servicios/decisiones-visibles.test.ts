// Quién ve una decisión (docs/08 §10.7), sobre la decisión real de la demo: la compra de 3 compresores de 2 HP.
// La propone Lucía, la decide Marcela, es del proyecto La Colina (responde Esteban) y mueve trabajos de José, Mario,
// Esteban, Ricardo, Daniela y Sofía. Al aprobarse, la compra le toca a Karla.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PERSONAS } from '@/dominio/constantes';
import { capturar } from '@/servicios/captura';
import { aprobarDecision, listarDecisiones } from '@/servicios/decisiones';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';
const TODAS = Object.values(PERSONAS);

describe('quién ve una decisión', () => {
  let demo: Demo;
  const laVen = async () => {
    const ven: string[] = [];
    for (const p of TODAS) if ((await listarDecisiones(demo.ctx, { visiblePara: p })).length > 0) ven.push(p);
    return ven.sort();
  };

  beforeEach(async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, PERSONAS.jose, C01);
    const r = await capturar(demo.ctx, PERSONAS.lucia, C11);
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01' });
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  it('pendiente: quien decide, quien propuso, el responsable del proyecto, los afectados y gerencia', async () => {
    expect(await laVen()).toEqual(
      [
        PERSONAS.marcela, // decide y es la gerente general
        PERSONAS.lucia, // la propuso
        PERSONAS.esteban, // responde por La Colina
        PERSONAS.andres, // responsable de la operación
        PERSONAS.jose,
        PERSONAS.mario,
        PERSONAS.ricardo,
        PERSONAS.daniela,
        PERSONAS.sofia, // con trabajos afectados
      ].sort(),
    );
  });

  it('no la ven quienes no tienen nada que ver: Paola, Karla y Diego', async () => {
    for (const p of [PERSONAS.paola, PERSONAS.karla, PERSONAS.diego]) {
      expect(await listarDecisiones(demo.ctx, { visiblePara: p })).toEqual([]);
    }
  });

  it('al aprobarse, la ve también Karla, a quien le toca la compra', async () => {
    await aprobarDecision(demo.ctx, 'D01', 'A', PERSONAS.marcela);
    const ven = await laVen();
    expect(ven).toContain(PERSONAS.karla);
    expect(ven).not.toContain(PERSONAS.paola);
    expect(ven).not.toContain(PERSONAS.diego);
  });

  it('ver no es decidir: un afectado la ve, pero no puede aprobarla', async () => {
    expect(await listarDecisiones(demo.ctx, { visiblePara: PERSONAS.jose })).toHaveLength(1);
    await expect(aprobarDecision(demo.ctx, 'D01', 'A', PERSONAS.jose)).rejects.toThrow(/Solo Marcela Solís puede decidir/);
  });

  it('sin `visiblePara` el servicio devuelve todas (lo usan las pruebas y el motor, no las pantallas)', async () => {
    expect(await listarDecisiones(demo.ctx)).toHaveLength(1);
    expect(await listarDecisiones(demo.ctx, { decisorId: PERSONAS.marcela, estado: 'pendiente' })).toHaveLength(1);
  });
});
