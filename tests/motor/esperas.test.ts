// Quién espera a quién (docs/08 regla 23, V17). Puras, sobre la instantánea de la semilla en memoria.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import { calcularEsperas } from '@/motor/esperas';
import { instantaneaVisible, type Instantanea } from '@/motor/instantanea';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const VIE = enCR('2026-11-27', '17:00');

function con(inst: Instantanea, base: string, extra: Partial<Trabajo>): Trabajo {
  return { ...(inst.trabajos.find((t) => t.id === base) as Trabajo), estado: 'abierto', resueltoEn: null, ...extra } as Trabajo;
}

/**
 * Como en el paso 13 del guion: T31 (COLINA-8, Lucía, pedido por José) bloquea T04; T32 (Karla) sin dependencias;
 * M03 (Ricardo, pedido por Andrés) depende de T28; M01 resuelto y M02 confirmado.
 */
function paso13(): Instantanea {
  const s = instantaneaDesdeSemilla();
  const t31 = con(s, 'T04', { id: 'T31', numero: 8, titulo: 'Conseguir el compresor de 2 HP', responsableId: 'lucia-mora', solicitadoPorId: 'jose-alfaro', estado: 'en_curso', origen: 'captura' });
  const t32 = con(s, 'T04', { id: 'T32', numero: 9, titulo: 'Comprar 3 compresores de 2 HP al proveedor local', responsableId: 'karla-jimenez', solicitadoPorId: 'marcela-solis', origen: 'decision' });
  const m01 = con(s, 'T28', { id: 'M01', numero: 13, titulo: 'Enviar las guías…', responsableId: 'diego-rojas', solicitadoPorId: 'ricardo-brenes', estado: 'resuelto', origen: 'correo' });
  const m02 = con(s, 'T12', { id: 'M02', numero: 7, titulo: 'Enviar las fotos…', responsableId: 'daniela-quesada', solicitadoPorId: 'esteban-castro', plazo: VIE, origen: 'correo' });
  const m03 = con(s, 'T28', { id: 'M03', numero: 14, titulo: 'Emitir la factura proforma…', responsableId: 'ricardo-brenes', solicitadoPorId: 'andres-vargas', plazo: VIE, origen: 'correo' });
  const trabajos = s.trabajos.map((t) => (t.id === 'T04' ? { ...t, estado: 'bloqueado' as const, bloqueadoPorId: 'T31', motivoBloqueo: 'Falta el compresor' } : t));
  return {
    ...s,
    ahora: enCR('2026-11-25', '08:23'),
    trabajos: [m01, m02, m03, ...trabajos, t31, t32],
    dependencias: [...s.dependencias, { trabajoId: 'M03', dependeDeId: 'T28' }],
  };
}

describe('regla 23 · cadenas', () => {
  it('semilla: una cadena por camino máximo, del que nadie espera al que no espera a nadie, sin resueltos', () => {
    const { cadenas } = calcularEsperas(instantaneaDesdeSemilla());
    expect(cadenas.map((c) => c.trabajoIds)).toEqual([
      ['T07', 'T06', 'T05', 'T04'],
      ['T13', 'T10'],
      ['T13', 'T11'],
      ['T13', 'T12'],
      ['T18', 'T17', 'T16', 'T15'],
      ['T21', 'T22'],
      ['T26', 'T27'],
    ]);
  });

  it('personas: el solicitante del primero (o su responsable) y el responsable de cada eslabón, sin repetir seguidas', () => {
    const { cadenas } = calcularEsperas(paso13());
    const de = (primero: string) => cadenas.find((c) => c.trabajoIds[0] === primero)!;
    expect(de('T07')).toEqual({
      trabajoIds: ['T07', 'T06', 'T05', 'T04', 'T31'],
      personaIds: ['ricardo-brenes', 'esteban-castro', 'mario-chaves', 'jose-alfaro', 'lucia-mora'],
      proyectoIds: ['P1'],
    });
    expect(de('T18').personaIds).toEqual(['marcela-solis', 'karla-jimenez', 'lucia-mora']);
    expect(de('M03')).toEqual({ trabajoIds: ['M03', 'T28'], personaIds: ['andres-vargas', 'ricardo-brenes', 'paola-herrera'], proyectoIds: ['P4'] });
  });

  it('un bloqueo es una arista; resolver el bloqueante la quita', () => {
    const inst = paso13();
    expect(calcularEsperas(inst).cadenas.some((c) => c.trabajoIds.includes('T31'))).toBe(true);
    const resuelto = { ...inst, trabajos: inst.trabajos.map((t) => (t.id === 'T31' ? { ...t, estado: 'resuelto' as const } : t)) };
    expect(calcularEsperas(resuelto).cadenas.find((c) => c.trabajoIds[0] === 'T07')?.trabajoIds).toEqual(['T07', 'T06', 'T05', 'T04']);
  });

  it('una cadena que cruza proyectos lleva todos sus proyectos, en orden', () => {
    const inst = paso13();
    const cruzada = { ...inst, dependencias: [...inst.dependencias, { trabajoId: 'T13', dependeDeId: 'T31' }] };
    expect(calcularEsperas(cruzada).cadenas.find((c) => c.trabajoIds.join() === 'T13,T31')?.proyectoIds).toEqual(['P2', 'P1']);
  });

  it('un ciclo no se recorre dos veces', () => {
    const inst = paso13();
    const ciclo = { ...inst, dependencias: [...inst.dependencias, { trabajoId: 'T15', dependeDeId: 'T18' }] };
    expect(() => calcularEsperas(ciclo)).not.toThrow();
  });
});

describe('V17 · cuello de botella', () => {
  it('paso 13 del guion: un solo cuello, Lucía, al final de cadenas de La Colina y Repuestos críticos, con 6 personas detrás', () => {
    const { cuellos } = calcularEsperas(paso13());
    expect(cuellos).toEqual([
      {
        personaId: 'lucia-mora',
        proyectoIds: ['P1', 'P3'],
        esperando: ['ricardo-brenes', 'esteban-castro', 'mario-chaves', 'jose-alfaro', 'marcela-solis', 'karla-jimenez'],
      },
    ]);
  });

  it('con la semilla no hay cuello: nadie es el final de cadenas de dos proyectos', () => {
    expect(calcularEsperas(instantaneaDesdeSemilla()).cuellos).toEqual([]);
  });

  it('se calcula sobre la instantánea visible: un propuesto que solo ve su dueño no entra en la vista general', () => {
    const inst = paso13();
    const propuesto = { ...inst, trabajos: inst.trabajos.map((t) => (t.id === 'M03' ? { ...t, confirmacion: 'propuesto' as const, duenoPropuestaId: 'andres-vargas' } : t)) };
    expect(calcularEsperas(instantaneaVisible(propuesto, null)).cadenas.some((c) => c.trabajoIds.includes('M03'))).toBe(false);
    expect(calcularEsperas(instantaneaVisible(propuesto, 'andres-vargas')).cadenas.some((c) => c.trabajoIds.includes('M03'))).toBe(true);
  });
});
