// Formato único de nombres y referencias (dominio/nombres.ts): lo que ven las personas en lugar de T04, D01 o C1.
import { describe, expect, it } from 'vitest';
import {
  cantidadDeRepuesto,
  citaConReferencia,
  claveDesdeNombre,
  crearNombrador,
  enumerar,
  idsInternosEn,
  nombreConReferencia,
  referenciaDecision,
  referenciasEnTexto,
  referenciaTrabajo,
  tituloDecision,
} from '@/dominio/nombres';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

describe('referencias', () => {
  it('trabajo: clave del proyecto y número; decisión: con «D»', () => {
    expect(referenciaTrabajo('COLINA', 4)).toBe('COLINA-4');
    expect(referenciaDecision('COLINA', 1)).toBe('COLINA-D1');
  });

  it('sin clave o sin número válido no hay referencia (nunca se inventa una)', () => {
    expect(referenciaTrabajo('', 4)).toBe('');
    expect(referenciaTrabajo('COLINA', undefined)).toBe('');
    expect(referenciaTrabajo('COLINA', 0)).toBe('');
    expect(referenciaDecision(null, 1)).toBe('');
  });

  it('nombre para etiquetas y cita para frases; sin referencia, solo el título', () => {
    expect(nombreConReferencia('Cableado y tablero de control', 'COLINA-5')).toBe('Cableado y tablero de control (COLINA-5)');
    expect(citaConReferencia('Cableado y tablero de control', 'COLINA-5')).toBe('«Cableado y tablero de control» (COLINA-5)');
    expect(nombreConReferencia('Revisar el contrato', '')).toBe('Revisar el contrato');
    expect(citaConReferencia('Revisar el contrato', '')).toBe('«Revisar el contrato»');
  });

  it('enumerar', () => {
    expect(enumerar([])).toBe('');
    expect(enumerar(['a'])).toBe('a');
    expect(enumerar(['a', 'b'])).toBe('a y b');
    expect(enumerar(['a', 'b', 'c'])).toBe('a, b y c');
  });

  it('clave desde un nombre propio', () => {
    expect(claveDesdeNombre('TransLog')).toBe('TRANSLOG');
    expect(claveDesdeNombre('Navidad')).toBe('NAVIDAD');
    expect(claveDesdeNombre('Cámara')).toBe('CAMARA');
  });
});

describe('decisiones y repuestos', () => {
  const compresor = { nombre: 'Compresor de 2 HP', unidad: 'unidad' };
  it('título legible de una compra', () => {
    expect(tituloDecision(compresor, 3)).toBe('Compra de 3 compresores de 2 HP');
    expect(tituloDecision({ nombre: 'Empaque de puerta', unidad: 'metro' }, 20)).toBe('Compra de 20 metros de empaque de puerta');
    expect(tituloDecision(undefined, 3)).toBe('Compra de repuestos');
  });
  it('cantidad de repuesto en singular y plural', () => {
    expect(cantidadDeRepuesto(compresor, 1)).toBe('1 compresor de 2 HP');
    expect(cantidadDeRepuesto({ nombre: 'Termostato digital', unidad: 'unidad' }, 4)).toBe('4 termostatos digitales');
  });
});

describe('leer lo que escribe una persona', () => {
  it('encuentra referencias en cualquier mayúscula y no confunde las de decisión ni otros guiones', () => {
    expect(referenciasEnTexto('sigo con colina-4')).toEqual(['COLINA-4']);
    expect(referenciasEnTexto('COLINA-4 y TRIGAL-4, otra vez COLINA-4')).toEqual(['COLINA-4', 'TRIGAL-4']);
    expect(referenciasEnTexto('la decisión COLINA-D1')).toEqual([]);
    expect(referenciasEnTexto('el pedido 1043 de 2 HP')).toEqual([]);
  });

  it('detecta ids internos sueltos, no los de una referencia', () => {
    expect(idsInternosEn('T04 y T31 quedan')).toEqual(['T04', 'T31']);
    expect(idsInternosEn('la decisión D01')).toEqual(['D01']);
    expect(idsInternosEn('espera a C2')).toEqual(['C2']);
    expect(idsInternosEn('«Compra de 3 compresores de 2 HP» (COLINA-D1) y COLINA-4')).toEqual([]);
    expect(idsInternosEn('pedido 1043, 2 HP, 10:00')).toEqual([]);
  });
});

describe('crearNombrador sobre la semilla', () => {
  const inst = instantaneaDesdeSemilla();
  const n = crearNombrador(inst);

  it('nombra por título y referencia del proyecto', () => {
    expect(n.referencia('T04')).toBe('COLINA-4');
    expect(n.nombre('T05')).toBe('Cableado y tablero de control (COLINA-5)');
    expect(n.cita('T11')).toBe('«Cambiar compresor en local Curridabat» (TRIGAL-4)');
    expect(n.citas(['T05', 'T11'])).toBe('«Cableado y tablero de control» (COLINA-5) y «Cambiar compresor en local Curridabat» (TRIGAL-4)');
    expect(n.ref('T15')).toEqual({ id: 'T15', titulo: 'Conciliar el conteo con el sistema', referencia: 'REPUESTOS-2' });
  });

  it('un id desconocido no se imprime: queda «un trabajo»', () => {
    expect(n.cita('T99')).toBe('«un trabajo»');
    expect(n.referencia('T99')).toBe('');
  });

  it('resuelve la referencia escrita (y el id interno) al id interno', () => {
    expect(n.resolver('COLINA-4')).toBe('T04');
    expect(n.resolver(' colina-4 ')).toBe('T04');
    expect(n.resolver('PEDIDOS-12')).toBe('T30');
    expect(n.resolver('T04')).toBe('T04');
    expect(n.resolver('COLINA-99')).toBeNull();
    expect(n.resolver('otra cosa')).toBeNull();
  });

  it('decisiones: título y referencia con la clave de su proyecto', () => {
    const conDecision = crearNombrador({
      ...inst,
      decisiones: [{ id: 'D01', proyectoId: 'P1', numero: 1, repuestoId: 'compresor-2hp', cantidad: 3 }],
    });
    expect(conDecision.referenciaDecision('D01')).toBe('COLINA-D1');
    expect(conDecision.tituloDecision('D01')).toBe('Compra de 3 compresores de 2 HP');
    expect(conDecision.citaDecision('D01')).toBe('«Compra de 3 compresores de 2 HP» (COLINA-D1)');
  });
});
