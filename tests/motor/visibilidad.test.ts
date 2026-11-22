// Visibilidad e ids de la instantánea (docs/08 reglas 12d, 16 y 18; tarea R2). Puras.
import { describe, expect, it } from 'vitest';
import type { Trabajo } from '@/dominio/tipos';
import { instantaneaVisible as desdeConfianza, visiblePara as visibleDesdeConfianza } from '@/motor/confianza';
import { instantaneaVisible, siguienteIdTrabajo, siguienteIdTrabajoCorreo, siguienteNumeroTrabajo, visiblePara } from '@/motor/instantanea';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

function propuesto(id: string, dueno: string, extra: Partial<Trabajo> = {}): Trabajo {
  const base = instantaneaDesdeSemilla().trabajos.find((t) => t.id === 'T28') as Trabajo;
  return { ...base, id, numero: 13, origen: 'correo', confirmacion: 'propuesto', duenoPropuestaId: dueno, ...extra };
}

describe('visiblePara', () => {
  it('confirmado → todos; propuesto → solo su dueño; descartado → nadie; null es la vista general', () => {
    const c = { confirmacion: 'confirmado' as const, duenoPropuestaId: null };
    const p = { confirmacion: 'propuesto' as const, duenoPropuestaId: 'ricardo-brenes' };
    const d = { confirmacion: 'descartado' as const, duenoPropuestaId: 'ricardo-brenes' };
    expect([visiblePara(c, null), visiblePara(c, 'diego-rojas')]).toEqual([true, true]);
    expect([visiblePara(p, null), visiblePara(p, 'diego-rojas'), visiblePara(p, 'ricardo-brenes')]).toEqual([false, false, true]);
    expect([visiblePara(d, null), visiblePara(d, 'ricardo-brenes')]).toEqual([false, false]);
  });

  it('motor/confianza.ts reexporta las mismas funciones', () => {
    expect(visibleDesdeConfianza).toBe(visiblePara);
    expect(desdeConfianza).toBe(instantaneaVisible);
  });
});

describe('instantaneaVisible', () => {
  it('quita el propuesto y lo que cuelga de él; no toca la original', () => {
    const inst = instantaneaDesdeSemilla();
    inst.trabajos.push(propuesto('M01', 'ricardo-brenes'));
    inst.dependencias.push({ trabajoId: 'M01', dependeDeId: 'T28' }, { trabajoId: 'T29', dependeDeId: 'M01' });
    inst.evidencias.push({
      id: 1, trabajoId: 'M01', tipo: 'pedido', fuente: 'correo', compromisoClave: 'c', mensajeId: 'm', buzones: [], enlaces: {}, autorId: null, en: inst.ahora, cita: 'x',
    });
    inst.descartados.push({ id: 'M02', proyectoId: 'P2', numero: 7 });
    inst.evidencias.push({ ...inst.evidencias[0]!, id: 2, trabajoId: 'M02' });

    const general = instantaneaVisible(inst, null);
    expect(general.trabajos).toHaveLength(30);
    expect(general.dependencias).toHaveLength(19);
    expect(general.evidencias).toEqual([]); // ni la del propuesto ni la del descartado
    expect(general.descartados).toEqual(inst.descartados);
    expect(inst.trabajos).toHaveLength(31);

    const dueno = instantaneaVisible(inst, 'ricardo-brenes');
    expect(dueno.trabajos).toHaveLength(31);
    expect(dueno.dependencias).toHaveLength(21);
    expect(dueno.evidencias.map((e) => e.id)).toEqual([1]);
  });
});

describe('ids y números', () => {
  it('los trabajos del correo tienen su propio prefijo y no consumen T31; los descartados ocupan id y número', () => {
    const inst = instantaneaDesdeSemilla();
    expect(siguienteIdTrabajoCorreo(inst)).toBe('M01');
    inst.trabajos.push(propuesto('M01', 'ricardo-brenes'));
    expect(siguienteIdTrabajoCorreo(inst)).toBe('M02');
    expect(siguienteIdTrabajo(inst)).toBe('T31');
    expect(siguienteNumeroTrabajo(inst, 'P4')).toBe(14);
    inst.descartados.push({ id: 'M02', proyectoId: 'P4', numero: 14 });
    expect(siguienteIdTrabajoCorreo(inst)).toBe('M03');
    expect(siguienteNumeroTrabajo(inst, 'P4')).toBe(15);
  });
});
