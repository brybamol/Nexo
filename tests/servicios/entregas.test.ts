// Entrega y recepción por servicio, desde el botón y desde la captura (docs/08 reglas 19–21; casos V11–V13). Tarea R6b.
// Correo apagado: estos casos no leen buzones.
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { acciones, avisos, eventos, reloj, seguimientos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';
import type { Interpretacion, InterpreteIA } from '@/ia/interprete';
import { calcularMarcas } from '@/motor/marcas';
import { capturar } from '@/servicios/captura';
import { aprobarDecision } from '@/servicios/decisiones';
import { cambiarEstado, confirmarRecepcion, declararEntrega, rechazarEntrega, responderSeguimiento } from '@/servicios/estado-trabajos';
import { fijarReloj } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const JUE = '2026-11-26';
const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';

let demo: Demo;
afterEach(async () => {
  await demo.cerrar();
});

const fijarSinTick = (hora: string) => demo.ctx.db.update(reloj).set({ ahora: enCR(MIE, hora) }).where(eq(reloj.id, 1));
const trabajo = async (id: string) => (await cargarInstantanea(demo.ctx.db)).trabajos.find((t) => t.id === id);
const avisosSobre = async (personaId: string, trabajoId: string) =>
  (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === personaId && a.trabajoIds.includes(trabajoId));
const accionesSobre = async (trabajoId: string) => (await demo.ctx.db.select().from(acciones)).filter((a) => a.trabajoIds.includes(trabajoId));

function iaFija(valor: Interpretacion): InterpreteIA {
  const r = <T>(v: T) => Promise.resolve({ valor: v, implementacion: 'local' as const, modelo: null, respaldo: false });
  return {
    nombre: 'local',
    interpretar: () => r(valor),
    clasificarPregunta: () => Promise.reject(new Error('no se usa')),
    redactarRespuesta: () => Promise.reject(new Error('no se usa')),
  };
}
const resolverT31: Interpretacion = {
  tipo: 'actualizacion',
  trabajoId: 'T31',
  nuevoEstado: 'resuelto',
  nota: null,
  hayProblema: false,
  reprogramar: [],
  notasRelacionadas: [],
};

describe('V11 · Karla declara entregado T32 (tras E4-A) y Marcela confirma que lo recibió', () => {
  it('aviso y seguimiento de recepción; recordatorio a las 12:20 y nada más; no atrasado a las 15:00; recibido → resuelto', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    await fijarSinTick('08:10');
    expect(await capturar(demo.ctx, 'lucia-mora', C11)).toMatchObject({ estado: 'aplicada', decisionId: 'D01' });
    await fijarSinTick('08:12');
    expect((await aprobarDecision(demo.ctx, 'D01', 'A', 'marcela-solis')).trabajosCreados).toEqual(['T32']);
    await fijarSinTick('08:20');

    await expect(declararEntrega(demo.ctx, 'T32', 'karla-jimenez', {})).rejects.toThrow('Escribe qué entregaste o pega el enlace.');
    await expect(declararEntrega(demo.ctx, 'T32', 'marcela-solis', { nota: 'x' })).rejects.toThrow(ErrorDominio);
    await declararEntrega(demo.ctx, 'T32', 'karla-jimenez', { nota: 'Llegaron a bodega, factura 4471' });

    const t32 = await trabajo('T32');
    // docs/08 V11 dice «en_curso»; T32 nace abierto (E4-A) y la entrega no cambia el estado (regla 20, motor de R4):
    // lo que importa es que NO está resuelto y tiene su entrega. Anotado como discrepancia del contrato.
    expect(t32?.estado).toBe('abierto');
    expect(t32?.entrega).toEqual({ en: enCR(MIE, '08:20'), porId: 'karla-jimenez', nota: 'Llegaron a bodega, factura 4471', enlace: null, fuente: 'interfaz' });
    const aviso = await avisosSobre('marcela-solis', 'T32');
    expect(aviso.filter((a) => a.titulo.includes('¿Lo recibiste?'))).toHaveLength(1);
    expect(idsInternosEn(aviso.map((a) => `${a.titulo} ${a.cuerpo}`).join(' '))).toEqual([]);
    const rec = (await demo.ctx.db.select().from(seguimientos)).filter((s) => s.trabajoId === 'T32' && s.tipo === 'recepcion');
    expect(rec.map((s) => [s.destinatarioId, s.nivel, s.estado])).toEqual([['marcela-solis', 0, 'pendiente']]);
    expect((await accionesSobre('T32')).some((a) => a.tipo === 'registrar_entrega')).toBe(true);
    // Una segunda entrega no se puede: ya está entregado.
    await expect(declararEntrega(demo.ctx, 'T32', 'karla-jimenez', { nota: 'otra vez' })).rejects.toThrow('ya está entregado');

    const r1220 = await fijarReloj(demo.ctx, enCR(MIE, '12:20'));
    const sobreT32 = r1220.acciones.filter((a) => a.trabajos.some((t) => t.id === 'T32'));
    expect(sobreT32.map((a) => [a.tipo, a.destinatario?.id])).toEqual([['recordatorio', 'marcela-solis']]);

    const r1500 = await fijarReloj(demo.ctx, enCR(MIE, '15:00'));
    expect(r1500.acciones.filter((a) => a.trabajos.some((t) => t.id === 'T32'))).toEqual([]);
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(calcularMarcas(inst).get('T32')?.atrasado).toBe(false);
    const rJue = await fijarReloj(demo.ctx, enCR(JUE, '16:00'));
    expect(rJue.acciones.filter((a) => a.trabajos.some((t) => t.id === 'T32'))).toEqual([]); // sin escalamiento

    await confirmarRecepcion(demo.ctx, 'T32', 'marcela-solis');
    expect(await trabajo('T32')).toMatchObject({ estado: 'resuelto', resueltoEn: enCR(JUE, '16:00') });
    const aKarla = (await avisosSobre('karla-jimenez', 'T32')).filter((a) => a.titulo.includes('confirmó que recibió'));
    expect(aKarla).toHaveLength(1);
    const ev = (await demo.ctx.db.select().from(eventos)).filter((e) => e.trabajoId === 'T32').map((e) => e.tipo);
    expect(ev).toEqual(expect.arrayContaining(['entrega_registrada', 'recepcion_confirmada']));
  });
});

describe('V12 · Lucía «resuelve» T31, pedido por José: queda entregado, no resuelto', () => {
  it('sin evidencia → ErrorDominio; con evidencia → entrega, T04 sigue bloqueado, aviso a José', async () => {
    demo = await prepararDemo();
    expect((await capturar(demo.ctx, 'jose-alfaro', C01)).estado).toBe('aplicada');
    await expect(cambiarEstado(demo.ctx, 'T31', 'lucia-mora', 'resuelto')).rejects.toThrow('Escribe qué entregaste o pega el enlace.');
    expect((await trabajo('T31'))?.entrega).toBeNull();

    await cambiarEstado(demo.ctx, 'T31', 'lucia-mora', 'resuelto', 'Lo traje del proveedor local');
    const t31 = await trabajo('T31');
    expect(t31?.estado).not.toBe('resuelto');
    expect(t31?.entrega).toMatchObject({ porId: 'lucia-mora', nota: 'Lo traje del proveedor local', fuente: 'interfaz' });
    expect((await trabajo('T04'))?.estado).toBe('bloqueado');
    expect((await avisosSobre('jose-alfaro', 'T31')).filter((a) => a.titulo.includes('¿Lo recibiste?'))).toHaveLength(1);
  });

  it('José rechaza la entrega (motivo obligatorio): entrega borrada, aviso a Lucía, evento entrega_rechazada', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    await cambiarEstado(demo.ctx, 'T31', 'lucia-mora', 'resuelto', 'Lo traje del proveedor local');
    await expect(rechazarEntrega(demo.ctx, 'T31', 'jose-alfaro', '  ')).rejects.toThrow(ErrorDominio);
    await expect(rechazarEntrega(demo.ctx, 'T31', 'lucia-mora', 'No')).rejects.toThrow(ErrorDominio);
    await rechazarEntrega(demo.ctx, 'T31', 'jose-alfaro', 'Es de 1 HP, no de 2 HP');
    expect((await trabajo('T31'))?.entrega).toBeNull();
    expect((await avisosSobre('lucia-mora', 'T31')).some((a) => a.cuerpo.includes('Es de 1 HP, no de 2 HP'))).toBe(true);
    expect((await demo.ctx.db.select().from(eventos)).some((e) => e.tipo === 'entrega_rechazada' && e.trabajoId === 'T31')).toBe(true);
    // Sin entrega, ya no hay nada que confirmar ni rechazar… pero quien lo pidió sí puede darlo por resuelto (regla 19).
    await expect(rechazarEntrega(demo.ctx, 'T31', 'jose-alfaro', 'otra')).rejects.toThrow(ErrorDominio);
    await confirmarRecepcion(demo.ctx, 'T31', 'jose-alfaro', 'Ya llegó el compresor');
    expect((await trabajo('T31'))?.estado).toBe('resuelto');
    expect((await trabajo('T04'))?.estado).toBe('en_curso');
  });
});

describe('V13 · T28 (sin solicitante) a las 12:10', () => {
  it('sin evidencia → «Escribe qué entregaste…»; Andrés no puede; con evidencia Paola lo resuelve', async () => {
    demo = await prepararDemo({ hora: '12:10' });
    await expect(cambiarEstado(demo.ctx, 'T28', 'paola-herrera', 'resuelto')).rejects.toThrow('Escribe qué entregaste o pega el enlace.');
    await expect(cambiarEstado(demo.ctx, 'T28', 'andres-vargas', 'resuelto', 'x')).rejects.toThrow(ErrorDominio);
    await expect(cambiarEstado(demo.ctx, 'T28', 'andres-vargas', 'resuelto', 'x')).rejects.toThrow('puede darlo por resuelto');
    await expect(declararEntrega(demo.ctx, 'T28', 'paola-herrera', { nota: 'Enviada' })).rejects.toThrow(ErrorDominio);
    expect((await trabajo('T28'))?.estado).toBe('abierto');

    await cambiarEstado(demo.ctx, 'T28', 'paola-herrera', 'resuelto', 'Enviada al Hotel Mirador');
    expect(await trabajo('T28')).toMatchObject({ estado: 'resuelto', entrega: null });
    const ev = (await cargarInstantanea(demo.ctx.db)).evidencias.filter((e) => e.trabajoId === 'T28');
    expect(ev.map((e) => [e.tipo, e.fuente, e.cita, e.autorId])).toEqual([['entrega', 'interfaz', 'Enviada al Hotel Mirador', 'paola-herrera']]);
  });

  it('responderSeguimiento a resuelto también pide evidencia (la nota)', async () => {
    demo = await prepararDemo({ hora: '12:09' });
    await fijarReloj(demo.ctx, enCR(MIE, '12:10')); // Paola recibe la solicitud de estado de T28
    await expect(responderSeguimiento(demo.ctx, 'T28', 'paola-herrera', { estado: 'resuelto' })).rejects.toThrow(
      'Escribe qué entregaste o pega el enlace.',
    );
    await responderSeguimiento(demo.ctx, 'T28', 'paola-herrera', { estado: 'resuelto', nota: 'Ya la envié.' });
    expect((await trabajo('T28'))?.estado).toBe('resuelto');
  });
});

describe('Captura y regla 19: el texto de la captura es la evidencia', () => {
  it('Lucía (responsable) escribe que T31 está listo: queda entregado con su texto; aviso a José; el resumen lo dice', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const r = await capturar({ ...demo.ctx, ia: iaFija(resolverT31) }, 'lucia-mora', 'Ya traje el compresor del proveedor local');
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.resumen).toContain('quedó entregado: falta que José Alfaro confirme que lo recibió');
    expect(idsInternosEn(r.resumen)).toEqual([]);
    expect(r.avisosA).toContain('jose-alfaro');
    const t31 = await trabajo('T31');
    expect(t31?.estado).not.toBe('resuelto');
    expect(t31?.entrega).toMatchObject({ porId: 'lucia-mora', nota: 'Ya traje el compresor del proveedor local', fuente: 'captura' });
    const tipos = (await accionesSobre('T31')).filter((a) => a.capturaId === r.capturaId).map((a) => a.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['registrar_entrega', 'actualizar_trabajo']));
  });

  it('Mario (no es parte) escribe que T31 está resuelto: sin error, sin cambio de estado, el resumen y el motivo lo explican', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const r = await capturar({ ...demo.ctx, ia: iaFija(resolverT31) }, 'mario-chaves', 'El compresor ya está');
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.resumen).toContain('no cambió de estado: solo José Alfaro, que lo pidió, puede darlo por resuelto');
    const t31 = await trabajo('T31');
    expect(t31?.estado).toBe('abierto');
    expect(t31?.entrega).toBeNull();
    const act = (await accionesSobre('T31')).find((a) => a.tipo === 'actualizar_trabajo' && a.capturaId === r.capturaId);
    expect(act?.motivo).toContain('no cambió de estado: solo José Alfaro');
  });

  it('José (quien lo pidió) escribe que llegó: resuelto directamente, con evidencia «recepcion»; T04 se libera', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const r = await capturar({ ...demo.ctx, ia: iaFija(resolverT31) }, 'jose-alfaro', 'Ya llegó el compresor');
    expect(r.estado).toBe('aplicada');
    expect((await trabajo('T31'))?.estado).toBe('resuelto');
    expect((await trabajo('T04'))?.estado).toBe('en_curso');
    const ev = (await cargarInstantanea(demo.ctx.db)).evidencias.filter((e) => e.trabajoId === 'T31');
    expect(ev.map((e) => [e.tipo, e.fuente, e.cita])).toEqual([['recepcion', 'captura', 'Ya llegó el compresor']]);
  });
});
