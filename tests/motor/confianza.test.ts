// Confianza y buzones del pedido (docs/08 reglas 14b y 18; tarea R3). Puras.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { EvidenciaTrabajo, Trabajo } from '@/dominio/tipos';
import { buzonesDelPedido, confianzaDe, cubreDosPartes } from '@/motor/confianza';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

function trabajo(extra: Partial<Trabajo>): Trabajo {
  const base = instantaneaDesdeSemilla().trabajos.find((t) => t.id === 'T27') as Trabajo;
  return { ...base, ...extra };
}

let siguiente = 1;
function evidencia(trabajoId: string, tipo: EvidenciaTrabajo['tipo'], buzones: string[]): EvidenciaTrabajo {
  return {
    id: siguiente++,
    trabajoId,
    tipo,
    fuente: 'correo',
    compromisoClave: 'c-h1-m1',
    mensajeId: `<m${siguiente}@friodelvalle.cr>`,
    buzones,
    enlaces: {},
    autorId: 'andres-vargas',
    en: enCR('2026-11-23', '09:00'),
    cita: 'Ricardo, ¿puedes confirmar el pago anticipado del pedido 1047 de La Colina?',
  };
}

describe('confianzaDe (regla 18)', () => {
  it('propuesto → una_fuente; correo confirmado sin persona → dos_fuentes; lo demás → persona', () => {
    const propuesto = trabajo({ id: 'M01', origen: 'correo', confirmacion: 'propuesto', duenoPropuestaId: 'ricardo-brenes' });
    const dosFuentes = trabajo({ id: 'M03', origen: 'correo', confirmacion: 'confirmado' });
    const porPersona = trabajo({ id: 'M02', origen: 'correo', confirmacion: 'confirmado', confirmadoPorId: 'esteban-castro' });
    expect(confianzaDe(propuesto, [])).toBe('una_fuente');
    expect(confianzaDe(dosFuentes, [])).toBe('dos_fuentes');
    expect(confianzaDe(porPersona, [])).toBe('persona');
    expect(confianzaDe(trabajo({}), [])).toBe('persona'); // semilla
    expect(confianzaDe(trabajo({ origen: 'captura' }), [])).toBe('persona');
    expect(confianzaDe(trabajo({ origen: 'decision' }), [])).toBe('persona');
  });
});

describe('buzonesDelPedido (regla 14b)', () => {
  it('une los buzones de las evidencias «pedido» del trabajo y deja solo las partes (solicitante primero)', () => {
    const t = trabajo({ id: 'M03', responsableId: 'ricardo-brenes', solicitadoPorId: 'andres-vargas' });
    const evs = [
      evidencia('M03', 'pedido', ['ricardo-brenes', 'paola-herrera']), // Paola en copia: nunca cuenta
      evidencia('M03', 'entrega', ['marcela-solis']), // otra clase de evidencia: no cuenta
      evidencia('T27', 'pedido', ['marcela-solis']), // otro trabajo
      evidencia('M03', 'pedido', ['andres-vargas', 'ricardo-brenes']),
    ];
    expect(buzonesDelPedido(t, evs)).toEqual(['andres-vargas', 'ricardo-brenes']);
    expect(cubreDosPartes(t, evs)).toBe(true);
  });

  it('una sola parte no cubre; sin solicitante nunca hay dos partes', () => {
    const t = trabajo({ id: 'M01', responsableId: 'diego-rojas', solicitadoPorId: 'ricardo-brenes' });
    const evs = [evidencia('M01', 'pedido', ['ricardo-brenes', 'andres-vargas'])];
    expect(buzonesDelPedido(t, evs)).toEqual(['ricardo-brenes']);
    expect(cubreDosPartes(t, evs)).toBe(false);

    const externo = trabajo({ id: 'M04', responsableId: 'paola-herrera', solicitadoPorId: null });
    const evExt = [evidencia('M04', 'pedido', ['paola-herrera'])];
    expect(buzonesDelPedido(externo, evExt)).toEqual(['paola-herrera']);
    expect(cubreDosPartes(externo, evExt)).toBe(false);
    expect(buzonesDelPedido(externo, [])).toEqual([]);
  });

  it('quien se lo pide a sí mismo es una sola parte: no basta para dos fuentes', () => {
    const t = trabajo({ id: 'M05', responsableId: 'andres-vargas', solicitadoPorId: 'andres-vargas' });
    const evs = [evidencia('M05', 'pedido', ['andres-vargas'])];
    expect(buzonesDelPedido(t, evs)).toEqual(['andres-vargas']);
    expect(cubreDosPartes(t, evs)).toBe(false);
  });
});
