import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { correosEntrantes, capturas, trabajos } from '@/db/esquema';
import { procesarCorreoEntrante, leerMapaRemitentes } from '@/servicios/correo-entrante';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MESSAGE_ID = 'postmark-message-001';
const CORREO = {
  MessageID: MESSAGE_ID,
  From: 'Jose Alfaro <jose@empresa.test>',
  FromFull: { Email: 'jose@empresa.test', Name: 'Jose Alfaro' },
  Subject: 'Problema con instalación',
  TextBody: 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP',
  HtmlBody: '<p>contenido alternativo</p>',
  Date: 'Wed, 25 Nov 2026 07:05:00 -0600',
};
const MAPA = { 'jose@empresa.test': 'jose-alfaro' };
let demo: Demo;

beforeEach(async () => {
  demo = await prepararDemo();
});
afterEach(async () => {
  await demo.cerrar();
});

describe('procesarCorreoEntrante', () => {
  it('identifica al remitente y reutiliza el servicio de captura de Nexo', async () => {
    const resultado = await procesarCorreoEntrante(demo.ctx, CORREO, MAPA);

    expect(resultado.estado).toBe('procesado');
    if (resultado.estado !== 'procesado') return;
    expect(resultado.resultado.estado).toBe('aplicada');
    expect(resultado.resultado.capturaId).toBe(resultado.capturaId);

    const [captura] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, resultado.capturaId));
    expect(captura).toMatchObject({
      autorId: 'jose-alfaro',
      texto: CORREO.TextBody,
      estado: 'aplicada',
    });
    const [trabajo] = await demo.ctx.db.select().from(trabajos).where(eq(trabajos.id, 'T31'));
    expect(trabajo).toMatchObject({ solicitadoPorId: 'jose-alfaro', origen: 'captura' });

    const [registro] = await demo.ctx.db.select().from(correosEntrantes).where(eq(correosEntrantes.messageId, MESSAGE_ID));
    expect(registro).toMatchObject({ estado: 'procesado', capturaId: resultado.capturaId, remitente: 'jose@empresa.test' });
  });

  it('no procesa dos veces el mismo MessageID', async () => {
    const primera = await procesarCorreoEntrante(demo.ctx, CORREO, MAPA);
    const segunda = await procesarCorreoEntrante(demo.ctx, CORREO, MAPA);

    expect(primera.estado).toBe('procesado');
    expect(segunda).toEqual({ estado: 'duplicado', messageId: MESSAGE_ID });
    expect(await demo.ctx.db.select().from(capturas)).toHaveLength(1);
    expect(await demo.ctx.db.select().from(trabajos)).toHaveLength(31);
  });

  it('no crea solicitudes para remitentes que no están asociados a una persona', async () => {
    const resultado = await procesarCorreoEntrante(demo.ctx, CORREO, {});

    expect(resultado).toEqual({ estado: 'remitente_no_registrado', messageId: MESSAGE_ID });
    expect(await demo.ctx.db.select().from(capturas)).toHaveLength(0);
    const [registro] = await demo.ctx.db.select().from(correosEntrantes).where(eq(correosEntrantes.messageId, MESSAGE_ID));
    expect(registro?.estado).toBe('rechazado');
  });

  it('lee y normaliza el mapa JSON de remitentes', () => {
    expect(leerMapaRemitentes('{"JOSE@EMPRESA.TEST":"jose-alfaro"}')).toEqual(MAPA);
    expect(leerMapaRemitentes(undefined)).toEqual({});
  });
});
