// «Mi día» a nivel de servicio (4.1): lo que debo, lo que espero de otros, avisos y seguimientos pendientes.
import { afterEach, describe, expect, it } from 'vitest';
import { persistirEfectos } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import { capturar } from '@/servicios/captura';
import { listarTrabajos, obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { preguntar } from '@/servicios/preguntar';
import { listarProyectos } from '@/servicios/proyectos';
import { marcarAvisosLeidos, obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import { avanzarReloj } from '@/servicios/reloj';
import { cambiarEstado, responderSeguimiento } from '@/servicios/estado-trabajos';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
let demo: Demo;
afterEach(async () => {
  await demo.cerrar();
});

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('obtenerMiDia', () => {
  it('estado inicial, Lucía Mora: debe T15 (atrasado) y T16; sin avisos', async () => {
    demo = await prepararDemo();
    const d = await obtenerMiDia(demo.ctx, 'lucia-mora');
    expect(d.persona.id).toBe('lucia-mora');
    expect(ids(d.debo)).toContain('T15');
    expect(ids(d.debo)).toContain('T16');
    expect(d.debo.every((t) => t.responsable.id === 'lucia-mora' && t.estado !== 'resuelto')).toBe(true);
    expect(d.debo.find((t) => t.id === 'T15')?.marcas.atrasado).toBe(true);
    expect(ids(d.debo)[0]).toBe('T15'); // atrasado antes que el resto
    expect(d.avisos).toEqual([]);
  });

  it('tras C01, Lucía tiene T31 arriba (urgente), quién lo pidió, qué bloquea y su aviso de asignación', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const d = await obtenerMiDia(demo.ctx, 'lucia-mora');
    const t31 = d.debo[0];
    expect(t31?.id).toBe('T31');
    expect(t31?.urgente).toBe(true);
    expect(t31?.solicitadoPor?.id).toBe('jose-alfaro');
    expect(t31?.bloquea).toContain('T04');
    expect(ids(d.debo)).toContain('T15');
    const aviso = d.avisos.find((a) => a.trabajoIds.includes('T31'));
    expect(aviso).toBeDefined();
    expect(aviso?.leido).toBe(false);
    expect(aviso?.titulo.length).toBeGreaterThan(0);
    // Del más reciente al más antiguo.
    const tiempos = d.avisos.map((a) => a.en.getTime());
    expect(tiempos).toEqual([...tiempos].sort((a, b) => b - a));
  });

  it('una persona sin nada pendiente recibe secciones vacías, sin errores', async () => {
    demo = await prepararDemo();
    // Marcela Solís resuelve lo suyo y queda sin trabajos pendientes.
    for (const t of (await obtenerMiDia(demo.ctx, 'marcela-solis')).debo) {
      await cambiarEstado(demo.ctx, t.id, 'marcela-solis', 'resuelto', 'Listo, revisado.'); // regla 19 de docs/08: con evidencia
    }
    const d = await obtenerMiDia(demo.ctx, 'marcela-solis');
    expect(d.debo).toEqual([]);
    expect(d.esperoDeOtros).toEqual([]);
    expect(d.avisos).toEqual([]);
    expect(d.decisionesPendientes).toEqual([]);
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'marcela-solis')).toEqual([]);
  });

  it('«lo que espero de otros»: José ve T31 tras C01 (lo solicitó y bloquea su T04), sin repetir y sin lo suyo', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const d = await obtenerMiDia(demo.ctx, 'jose-alfaro');
    expect(ids(d.esperoDeOtros)).toContain('T31');
    expect(new Set(ids(d.esperoDeOtros)).size).toBe(d.esperoDeOtros.length);
    expect(d.esperoDeOtros.every((t) => t.responsable.id !== 'jose-alfaro' && t.estado !== 'resuelto')).toBe(true);
    expect(ids(d.debo)).toContain('T04');
    expect(ids(d.debo)).not.toContain('T31');
  });

  it('una persona desconocida da error de dominio', async () => {
    demo = await prepararDemo();
    await expect(obtenerMiDia(demo.ctx, 'nadie')).rejects.toThrow(/No existe la persona/);
  });

  it('los avisos de propagación agrupados por riesgo (E3) aparecen citando trabajos de varios proyectos', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const d = await obtenerMiDia(demo.ctx, 'mario-chaves');
    // Mario recibe UN aviso con T05 (La Colina, P1) y T11 (Trigal, P2), que cita la causa: el conteo T15.
    expect(d.avisos).toHaveLength(1);
    expect(d.avisos[0]).toMatchObject({ tipoAccion: 'aviso', trabajoIds: ['T05', 'T11'], leido: false });
    expect(d.avisos[0]?.cuerpo).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
    const proyectos = new Set(d.debo.filter((t) => d.avisos[0]!.trabajoIds.includes(t.id)).map((t) => t.proyecto.id));
    expect(proyectos).toEqual(new Set(['P1', 'P2']));
    expect(d.debo.filter((t) => t.id === 'T05' || t.id === 'T11').every((t) => t.marcas.enRiesgo)).toBe(true);
    // Lucía no recibe aviso de propagación: el autor es José y ella es la responsable del bloqueante (aviso de asignación).
    const lucia = await obtenerMiDia(demo.ctx, 'lucia-mora');
    expect(lucia.avisos.map((a) => a.trabajoIds)).toEqual([['T31']]);
  });
});

describe('seguimientos pendientes', () => {
  it('cuando Nexo pide el estado de T15 aparece en la sección y desaparece al responder', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora')).toEqual([]);
    await avanzarReloj(demo.ctx, 5);
    const antes = await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora');
    expect(ids(antes)).toEqual(['T15']);
    expect(antes[0]?.seguimiento).not.toBeNull();
    // Quien no es responsable ni jefe escalado no lo ve.
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'jose-alfaro')).toEqual([]);

    await responderSeguimiento(demo.ctx, 'T15', 'lucia-mora', { estado: 'en_curso', nota: 'Ya salió el pedido' });
    expect(await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora')).toEqual([]);
  });

  it('T31 pendiente: Lucía lo ve; Esteban (responsable de La Colina) solo cuando ya se le escaló; Andrés (jefe de Lucía) nunca', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'lucia-mora'))).toContain('T31');
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro'))).not.toContain('T31');
    await avanzarReloj(demo.ctx, 60); // 8:05: escalamiento a Esteban
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'esteban-castro'))).toContain('T31');
    expect(ids(await obtenerSeguimientosPendientes(demo.ctx, 'andres-vargas'))).not.toContain('T31');
  });
});

describe('marcarAvisosLeidos', () => {
  it('marca los avisos de la persona sin tocar los de otras', async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    expect((await obtenerMiDia(demo.ctx, 'lucia-mora')).avisos.some((a) => !a.leido)).toBe(true);
    await marcarAvisosLeidos(demo.ctx, 'lucia-mora');
    expect((await obtenerMiDia(demo.ctx, 'lucia-mora')).avisos.every((a) => a.leido)).toBe(true);
  });
});

// ─── Reformas v2 · R6c: propuestas y entregas por confirmar en «Mi día» ───────────────────────────────────────────────

const RICARDO = 'ricardo-brenes';
const DIEGO = 'diego-rojas';

function trabajoCorreo(id: string, numero: number, extra: Partial<Trabajo> = {}): Trabajo {
  return {
    id,
    proyectoId: 'P4',
    numero,
    titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
    responsableId: DIEGO,
    solicitadoPorId: RICARDO,
    plazo: enCR('2026-11-27', '17:00'),
    estado: 'abierto',
    urgente: false,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: null,
    cantidadRepuesto: null,
    etiqueta: null,
    relacionados: [],
    origen: 'correo',
    capturaId: null,
    decisionId: null,
    creadoEn: enCR('2026-11-25', '07:00'),
    resueltoEn: null,
    confirmacion: 'propuesto',
    duenoPropuestaId: RICARDO,
    confirmadoPorId: null,
    entrega: null,
    ...extra,
  };
}

/** M01 como tras la lectura de las 7:05: propuesto de una fuente (dueño Ricardo), con el pedido y la entrega de Diego. */
async function sembrarM01(): Promise<void> {
  const entrega = { en: enCR('2026-11-24', '16:30'), porId: DIEGO, nota: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.', enlace: null, fuente: 'correo' as const };
  await persistirEfectos(demo.ctx.db, [
    { tipo: 'crear_trabajo', trabajo: trabajoCorreo('M01', 13, { entrega }), necesidades: [], actorId: null },
    {
      tipo: 'agregar_evidencia',
      evidencia: {
        trabajoId: 'M01', tipo: 'entrega', fuente: 'correo', compromisoClave: 'c-h3-m1', mensajeId: '<h3-m2@friodelvalle.cr>',
        buzones: [RICARDO], enlaces: { [RICARDO]: 'https://mail.google.com/mail/u/0/#all/h3m2' }, autorId: DIEGO,
        en: enCR('2026-11-24', '16:30'), cita: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.',
      },
    },
    {
      tipo: 'agregar_evidencia',
      evidencia: {
        trabajoId: 'M01', tipo: 'pedido', fuente: 'correo', compromisoClave: 'c-h3-m1', mensajeId: '<h3-m1@friodelvalle.cr>',
        buzones: [RICARDO], enlaces: { [RICARDO]: 'https://mail.google.com/mail/u/0/#all/h3m1' }, autorId: RICARDO,
        en: enCR('2026-11-23', '15:00'), cita: 'Diego, ¿puedes enviarme las guías de entrega firmadas?',
      },
    },
  ]);
}

describe('Mi día · propuestas de Nexo (R6c)', () => {
  it('Ricardo (dueño) ve M01 en propuestas, con una fuente, evidencia por fecha y su enlace; no en debo ni espero ni por confirmar', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await sembrarM01();
    const d = await obtenerMiDia(demo.ctx, RICARDO);
    expect(ids(d.propuestas)).toEqual(['M01']);
    const m = d.propuestas[0]!;
    expect(m.confianza).toBe('una_fuente');
    expect(m.confirmacion).toBe('propuesto');
    expect(m.dueno?.id).toBe(RICARDO);
    expect(m.referencia).toBe('PEDIDOS-13');
    expect(m.entrega?.por.id).toBe(DIEGO);
    expect(m.evidencias.map((e) => e.tipo)).toEqual(['pedido', 'entrega']); // por fecha
    expect(m.evidencias[0]).toMatchObject({ cita: expect.stringContaining('guías'), enlace: 'https://mail.google.com/mail/u/0/#all/h3m1' });
    expect(m.evidencias[0]?.autor?.id).toBe(RICARDO);
    expect(ids(d.debo)).not.toContain('M01');
    expect(ids(d.esperoDeOtros)).not.toContain('M01');
    expect(d.porConfirmarRecibido).toEqual([]);
  });

  it('nadie más ve la propuesta: ni Diego (responsable) ni Marcela; y obtenerTrabajo la oculta', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await sembrarM01();
    for (const p of [DIEGO, 'marcela-solis', 'esteban-castro']) {
      const d = await obtenerMiDia(demo.ctx, p);
      expect(d.propuestas).toEqual([]);
      expect(ids(d.debo)).not.toContain('M01');
      expect(ids(d.esperoDeOtros)).not.toContain('M01');
      expect(d.porConfirmarRecibido).toEqual([]);
    }
    expect(await obtenerTrabajo(demo.ctx, 'M01', DIEGO)).toBeNull();
    expect(await obtenerTrabajo(demo.ctx, 'M01')).toBeNull();
    expect((await obtenerTrabajo(demo.ctx, 'M01', RICARDO))?.id).toBe('M01');
  });

  it('el enlace de una evidencia solo se muestra a quien tiene ese mensaje en su buzón', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await sembrarM01();
    await persistirEfectos(demo.ctx.db, [
      { tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { confirmacion: 'confirmado', confirmadoPorId: RICARDO }, actorId: RICARDO },
    ]);
    const paraDiego = await obtenerTrabajo(demo.ctx, 'M01', DIEGO);
    expect(paraDiego?.evidencias.map((e) => e.enlace)).toEqual([null, null]);
    const paraRicardo = await obtenerTrabajo(demo.ctx, 'M01', RICARDO);
    expect(paraRicardo?.evidencias.every((e) => e.enlace !== null)).toBe(true);
    expect(paraRicardo?.confianza).toBe('persona');
  });

  it('una propuesta del dueño no aparece en las vistas generales: listados, proyectos y Preguntar (C13) no cambian', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    const antesTrabajos = (await listarTrabajos(demo.ctx)).length;
    const antesProyectos = await listarProyectos(demo.ctx);
    const antesC13 = await preguntar(demo.ctx, 'marcela-solis', '¿Cómo vamos con los pedidos de la semana?');
    await sembrarM01();
    expect(await listarTrabajos(demo.ctx)).toHaveLength(antesTrabajos);
    expect((await listarTrabajos(demo.ctx, { verComo: DIEGO })).map((t) => t.id)).not.toContain('M01');
    expect((await listarTrabajos(demo.ctx, { verComo: RICARDO })).map((t) => t.id)).toContain('M01');
    expect(await listarProyectos(demo.ctx)).toEqual(antesProyectos);
    const despuesC13 = await preguntar(demo.ctx, 'marcela-solis', '¿Cómo vamos con los pedidos de la semana?');
    expect(despuesC13.datos).toEqual(antesC13.datos);
    expect(despuesC13.fuentes).toEqual(antesC13.fuentes);
  });

  it('confirmada por dos fuentes: va a «debo» del responsable con confianza dos_fuentes y no es propuesta de nadie', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await persistirEfectos(demo.ctx.db, [
      {
        tipo: 'crear_trabajo',
        trabajo: trabajoCorreo('M03', 14, { responsableId: RICARDO, solicitadoPorId: 'andres-vargas', confirmacion: 'confirmado', duenoPropuestaId: null }),
        necesidades: [],
        actorId: null,
      },
    ]);
    const d = await obtenerMiDia(demo.ctx, RICARDO);
    expect(ids(d.debo)).toContain('M03');
    expect(d.debo.find((t) => t.id === 'M03')?.confianza).toBe('dos_fuentes');
    expect(d.propuestas).toEqual([]);
    expect(ids((await obtenerMiDia(demo.ctx, 'andres-vargas')).esperoDeOtros)).toContain('M03');
  });
});

describe('Mi día · entregas por confirmar (R6c)', () => {
  async function sembrarEntregado(): Promise<void> {
    const entrega = { en: enCR('2026-11-25', '06:30'), porId: 'karla-jimenez', nota: 'Llegaron a bodega, factura 4471', enlace: null, fuente: 'interfaz' as const };
    await persistirEfectos(demo.ctx.db, [
      {
        tipo: 'crear_trabajo',
        trabajo: trabajoCorreo('T40', 15, {
          titulo: 'Comprar los repuestos',
          responsableId: 'karla-jimenez',
          solicitadoPorId: 'marcela-solis',
          origen: 'captura',
          confirmacion: 'confirmado',
          duenoPropuestaId: null,
          entrega,
        }),
        necesidades: [],
        actorId: 'marcela-solis',
      },
    ]);
  }

  it('el solicitante lo ve en «por confirmar recibido» (sin duplicar en lo que espera); el responsable lo ve en debo con su entrega', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await sembrarEntregado();
    const marcela = await obtenerMiDia(demo.ctx, 'marcela-solis');
    expect(ids(marcela.porConfirmarRecibido)).toEqual(['T40']);
    expect(marcela.porConfirmarRecibido[0]?.entrega).toMatchObject({ nota: 'Llegaron a bodega, factura 4471' });
    expect(ids(marcela.esperoDeOtros)).not.toContain('T40');
    const karla = await obtenerMiDia(demo.ctx, 'karla-jimenez');
    expect(ids(karla.debo)).toContain('T40');
    expect(karla.debo.find((t) => t.id === 'T40')?.entrega?.por.id).toBe('karla-jimenez');
    expect(karla.porConfirmarRecibido).toEqual([]);
    expect((await obtenerMiDia(demo.ctx, 'lucia-mora')).porConfirmarRecibido).toEqual([]);
  });

  it('una propuesta con entrega sale en propuestas y no en «por confirmar recibido» hasta que se confirme', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await sembrarM01();
    const d = await obtenerMiDia(demo.ctx, RICARDO);
    expect(ids(d.propuestas)).toEqual(['M01']);
    expect(d.porConfirmarRecibido).toEqual([]);
    await persistirEfectos(demo.ctx.db, [
      { tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { confirmacion: 'confirmado', confirmadoPorId: RICARDO }, actorId: RICARDO },
    ]);
    const despues = await obtenerMiDia(demo.ctx, RICARDO);
    expect(despues.propuestas).toEqual([]);
    expect(ids(despues.porConfirmarRecibido)).toEqual(['M01']);
  });

  it('un trabajo resuelto deja de estar por confirmar', async () => {
    demo = await prepararDemo({ hora: '07:00' });
    await sembrarEntregado();
    await persistirEfectos(demo.ctx.db, [
      { tipo: 'actualizar_trabajo', trabajoId: 'T40', cambios: { estado: 'resuelto', resueltoEn: enCR('2026-11-25', '07:00') }, actorId: 'marcela-solis' },
    ]);
    expect((await obtenerMiDia(demo.ctx, 'marcela-solis')).porConfirmarRecibido).toEqual([]);
  });
});
