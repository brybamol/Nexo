// Piezas de la lectura que sobreviven al modelo de correo aparte (docs/08 §5.1, regla 11 y §5.3): empresa, extracción
// de títulos, plazos y esperas, unión de buzones por Message-ID y privacidad. Frío del Valle.
import { describe, expect, it } from 'vitest';
import { construirBuzonesEjemplo } from '@/correo/ejemplo/buzones';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { esperaCorreoDesdeTexto, plazoDesdeTexto, tituloDesdePedido } from '@/correo/extraccion';
import { hechosDeCorreo } from '@/correo/lectura';
import { clasificarMensaje } from '@/correo/privacidad';
import { unirBuzones } from '@/correo/union';
import { PERSONAS_SEMILLA } from '@/db/semilla/datos';
import { enCR } from '@/dominio/tiempo';

const LECTURA_7_05 = enCR('2026-11-25', '07:05');
const LECTURA_8_20 = enCR('2026-11-25', '08:20');

describe('las 12 personas del correo son las de la semilla (docs/08 §5.1)', () => {
  it('mismos ids, nombres y jefes que PERSONAS_SEMILLA, con dirección @friodelvalle.cr sin tildes', () => {
    expect(EMPRESA_FRIO_DEL_VALLE.personas).toHaveLength(12);
    expect(EMPRESA_FRIO_DEL_VALLE.personas.map((p) => [p.id, p.nombre, p.rol, p.jefeId])).toEqual(
      PERSONAS_SEMILLA.map((p) => [p.id, p.nombre, p.rol, p.jefeId]),
    );
    for (const p of EMPRESA_FRIO_DEL_VALLE.personas) expect(p.correo).toMatch(/^[a-z]+\.[a-z]+@friodelvalle\.cr$/);
    expect(EMPRESA_FRIO_DEL_VALLE.personas.find((p) => p.id === 'andres-vargas')?.correo).toBe('andres.vargas@friodelvalle.cr');
  });
});

describe('extracción: piezas', () => {
  it('saca el título en infinitivo, sin pronombre ni monto', () => {
    expect(tituloDesdePedido('enviarme las guías de entrega firmadas de los pedidos 1041 y 1042')).toBe('Enviar las guías de entrega firmadas de los pedidos 1041 y 1042');
    expect(tituloDesdePedido('aprobar la compra del compresor por ₡1.800.000')).toBe('Aprobar la compra del compresor');
    expect(tituloDesdePedido('reprogramar la entrega 1043 con el cliente')).toBe('Reprogramar la entrega 1043 con el cliente');
  });

  it('lee plazos en hora de Costa Rica y dice «no lo sé» sin señal', () => {
    const enviado = enCR('2026-11-24', '15:00');
    expect(plazoDesdeTexto('La necesitan mañana antes de las 12:00.', enviado)).toEqual(enCR('2026-11-25', '12:00'));
    expect(plazoDesdeTexto('Lo necesito hoy antes de las 16:00.', enviado)).toEqual(enCR('2026-11-24', '16:00'));
    expect(plazoDesdeTexto('antes del viernes 27 de noviembre', enviado)).toEqual(enCR('2026-11-27', '17:00'));
    expect(plazoDesdeTexto('antes del 4 de diciembre', enviado)).toEqual(enCR('2026-12-04', '17:00'));
    expect(plazoDesdeTexto('cuando puedas', enviado)).toBeNull();
  });

  it('separa quién, qué y el pronombre en una espera', () => {
    expect(esperaCorreoDesdeTexto('se puede hacer en cuanto Paola envíe la cotización de la cámara fría.', 'dependencia', 'ricardo-brenes')).toMatchObject({
      clase: 'dependencia',
      actor: 'Paola',
      objeto: 'la cotización de la cámara fría',
      quienEsperaId: 'ricardo-brenes',
    });
    expect(esperaCorreoDesdeTexto('La hago en cuanto Diego me los envíe.', 'bloqueo', 'karla-jimenez')).toMatchObject({ clase: 'bloqueo', actor: 'Diego', objeto: '' });
    expect(esperaCorreoDesdeTexto('Se puede hacer cuando llegue el compresor al taller.', 'dependencia', null)).toMatchObject({
      actor: null,
      objeto: 'el compresor al taller',
    });
    expect(esperaCorreoDesdeTexto('Lo necesito antes del viernes.', 'dependencia', null)).toBeNull();
  });
});

describe('unión de buzones y privacidad', () => {
  it('un mensaje interno está en varios buzones y cuenta una vez, con un enlace por buzón', () => {
    const { hilos } = unirBuzones(construirBuzonesEjemplo(), EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    const mensajes = hilos.flatMap((h) => h.mensajes);
    const ids = mensajes.map((x) => x.internetMessageId);
    expect(new Set(ids).size).toBe(ids.length);
    const primero = mensajes.find((x) => x.internetMessageId === '<h1-m1@friodelvalle.cr>')!;
    expect(Object.keys(primero.enlaces).sort()).toEqual(['andres-vargas', 'paola-herrera', 'ricardo-brenes']);
  });

  it('descarta 2 personales y 2 boletines aunque pidan algo; el cumpleaños no produce hechos', () => {
    const buzones = construirBuzonesEjemplo();
    const clases = buzones.flatMap((b) => b.mensajes).map((x) => [x.idInternet, clasificarMensaje(x, EMPRESA_FRIO_DEL_VALLE)] as const);
    expect(clases.filter(([, c]) => c !== 'laboral').map(([, c]) => c).sort()).toEqual(['boletin', 'boletin', 'personal', 'personal']);
    const { conteos } = unirBuzones(buzones, EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    expect(conteos.reduce((a, k) => ({ p: a.p + k.personales, b: a.b + k.boletines }), { p: 0, b: 0 })).toEqual({ p: 2, b: 2 });
    const { hechos } = hechosDeCorreo(buzones, EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    expect(hechos.some((h) => h.tipo === 'pedido' && h.asunto.includes('Cumpleaños'))).toBe(false);
  });

  it('conteos de la lectura de las 7:05 por buzón y en total (23 copias, 19 de trabajo); a las 8:20, dos copias más', () => {
    const { conteos } = unirBuzones(construirBuzonesEjemplo(), EMPRESA_FRIO_DEL_VALLE, LECTURA_7_05);
    expect(conteos.map((k) => [k.personaId, k.leidos, k.laborales, k.personales, k.boletines])).toEqual([
      ['marcela-solis', 1, 1, 0, 0],
      ['andres-vargas', 3, 3, 0, 0],
      ['ricardo-brenes', 5, 4, 0, 1],
      ['paola-herrera', 3, 3, 0, 0],
      ['sofia-navarro', 3, 2, 1, 0],
      ['karla-jimenez', 3, 2, 1, 0],
      ['lucia-mora', 3, 2, 0, 1],
      ['esteban-castro', 2, 2, 0, 0],
    ]);
    expect(conteos.reduce((a, k) => a + k.leidos, 0)).toBe(23);
    expect(conteos.reduce((a, k) => a + k.laborales, 0)).toBe(19);
    const a_las_8_20 = unirBuzones(construirBuzonesEjemplo(), EMPRESA_FRIO_DEL_VALLE, LECTURA_8_20).conteos;
    expect(a_las_8_20.reduce((a, k) => a + k.leidos, 0)).toBe(25);
  });

  it('solo existen los correos enviados hasta la hora del reloj', () => {
    const antes = hechosDeCorreo(construirBuzonesEjemplo(), EMPRESA_FRIO_DEL_VALLE, enCR('2026-11-23', '12:00')).hechos;
    const titulos = antes.flatMap((h) => (h.tipo === 'pedido' ? [h.titulo] : []));
    expect(titulos).toEqual(['Confirmar el pago anticipado del pedido 1047 de La Colina']);
  });
});
