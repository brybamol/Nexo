// Servicio de correo (docs/08 reglas 10–13, §4, §6): el correo alimenta al motor. Lee los buzones conectados al avanzar
// el reloj, arma la vista de la pantalla Correo y conecta buzones.
import { eq } from 'drizzle-orm';
import { buzones, personas } from '@/db/esquema';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { construirBuzonesGmail, construirBuzonesGraph, MENSAJES_BASE } from '@/correo/ejemplo/buzones';
import { normalizarBuzonGmail } from '@/correo/fuentes/gmail';
import { normalizarBuzonGraph } from '@/correo/fuentes/outlook';
import { hechosDeCorreo, siguienteEnvio } from '@/correo/lectura';
import type { Buzon, CopiaLeida, Proveedor } from '@/correo/tipos';
import type { Db } from '@/db/esquema';
import {
  cargarBuzones,
  cargarClavesLeidas,
  cargarInstantanea,
  cargarMensajesLeidos,
  claveLeido,
  persistirEfectos,
  tomarTurnoEscritura,
} from '@/db/instantanea';
import { DOMINIO_EMPRESA } from '@/dominio/constantes';
import {
  ErrorDominio,
  type BuzonConectado,
  type Persona,
  type PersonaBreve,
  type ResumenLectura,
} from '@/dominio/tipos';
import { recortarCita } from '@/motor/entregas';
import { calcularEsperas } from '@/motor/esperas';
import { planLectura } from '@/motor/ingesta';
import { instantaneaVisible, nombrador } from '@/motor/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';
import { obtenerAhora } from '@/servicios/reloj';
import { obtenerTasaCorreccion } from '@/servicios/tasa';
import type { LineaCorreoVista, RemitenteVista, SinConvertirVista, VistaCorreo } from '@/servicios/vistas';

// Los buzones son los de ejemplo (MENSAJES_BASE), sin red: la tabla `buzones` dice cuáles están conectados y con qué
// proveedor, y `mensajes_leidos` qué copias ya se procesaron. Todo es determinista con la hora del reloj de la demo.

const PROVEEDORES: readonly Proveedor[] = ['gmail', 'outlook'];

/** Buzones conectados, normalizados, en el orden de las personas de la empresa (orden de lectura de regla 10). */
function buzonesNormalizados(conectados: readonly BuzonConectado[]): Buzon[] {
  const empresa = EMPRESA_FRIO_DEL_VALLE;
  const de = (p: Proveedor) => conectados.filter((b) => b.proveedor === p).map((b) => b.personaId);
  const gmail = de('gmail');
  const outlook = de('outlook');
  const todos: Buzon[] = [
    ...(gmail.length > 0 ? construirBuzonesGmail(empresa, MENSAJES_BASE, gmail).map((b) => normalizarBuzonGmail(b, empresa)) : []),
    ...(outlook.length > 0 ? construirBuzonesGraph(empresa, MENSAJES_BASE, outlook).map((b) => normalizarBuzonGraph(b, empresa)) : []),
  ];
  const orden = new Map(empresa.personas.map((p, i) => [p.id, i]));
  return todos.sort((a, b) => (orden.get(a.personaId) ?? 0) - (orden.get(b.personaId) ?? 0));
}

/** Copias enviadas hasta `ahora` que todavía no están en `mensajes_leidos`. */
function hayCopiasNuevas(copias: readonly CopiaLeida[], yaLeidos: ReadonlySet<string>): boolean {
  return copias.some((c) => !yaLeidos.has(claveLeido(c.personaId, c.idInternet)));
}

/**
 * Regla 10: dentro de la transacción del reloj y ANTES del tick, lee los buzones conectados (tabla `buzones`) con
 * `enviado ≤ ahora`, procesa solo las copias que no están en `mensajes_leidos` y persiste el plan. Con 0 buzones o 0
 * copias nuevas no hace nada y devuelve null.
 */
export async function leerCorreo(tx: Db, ahora: Date): Promise<ResumenLectura | null> {
  const conectados = await cargarBuzones(tx);
  if (conectados.length === 0) return null;
  const empresa = EMPRESA_FRIO_DEL_VALLE;
  const { hechos, copias } = hechosDeCorreo(buzonesNormalizados(conectados), empresa, ahora);
  const yaLeidos = await cargarClavesLeidas(tx);
  if (!hayCopiasNuevas(copias, yaLeidos)) return null;
  // La instantánea COMPLETA (las mutaciones nunca calculan sobre la visible), a la hora de la lectura.
  const inst = { ...(await cargarInstantanea(tx)), ahora };
  const plan = planLectura(inst, { hechos, copias, yaLeidos, empresa });
  if (plan.efectos.length === 0) return null;
  await persistirEfectos(tx, plan.efectos);
  return plan.resumen;
}

/** ¿Hay copias sin leer con `enviado ≤ ahora` en los buzones conectados? (irAlSiguienteEvento: leer sin mover el reloj). */
export async function hayCorreoSinLeer(tx: Db, ahora: Date): Promise<boolean> {
  const conectados = await cargarBuzones(tx);
  if (conectados.length === 0) return false;
  const { copias } = hechosDeCorreo(buzonesNormalizados(conectados), EMPRESA_FRIO_DEL_VALLE, ahora);
  return hayCopiasNuevas(copias, await cargarClavesLeidas(tx));
}

/** Envío del próximo mensaje sin leer posterior a `ahora` en los buzones conectados, o null (irAlSiguienteEvento). */
export async function siguienteCorreo(tx: Db, ahora: Date): Promise<Date | null> {
  const conectados = await cargarBuzones(tx);
  if (conectados.length === 0) return null;
  return siguienteEnvio(buzonesNormalizados(conectados), await cargarClavesLeidas(tx), ahora);
}

const breve = (p: Persona): PersonaBreve => ({ id: p.id, nombre: p.nombre, rol: p.rol, area: p.area });

/** Cita de un mensaje sin hechos (p. ej. «Mensaje de trabajo sin pedidos»): su primer párrafo, recortado. */
function citaDeMensaje(texto: string): string {
  const primero = texto.split(/\n\s*\n/)[0] ?? '';
  return recortarCita(primero.replace(/\s+/g, ' ').trim());
}

/**
 * Pantalla Correo (§6) para la persona de la barra. Solo lectura.
 * - `buzones`: las 12 personas, conectadas o no, con los conteos de lo leído (de lo personal y los boletines solo se
 *   cuenta: ni asunto ni remitente).
 * - `lineas`: cada copia LABORAL leída del buzón de quien mira, por envío: remitente, destinatarios internos, resultado,
 *   trabajos que ve, cita y su propio enlace. Incluye también las `sin_plazo`.
 * - `sinConvertir`: los pedidos sin plazo (regla 12c) del buzón de quien mira, para preguntar «¿Para cuándo?».
 * - `esperas`: regla 23 sobre la instantánea visible para quien mira. `tasa`: regla 22.
 */
export async function obtenerVistaCorreo(ctx: ContextoServicio, personaId: string): Promise<VistaCorreo> {
  const completa = await cargarInstantanea(ctx.db);
  const persona = completa.personas.find((p) => p.id === personaId);
  if (!persona) throw new ErrorDominio('Esa persona no es de Frío del Valle.');
  const [conectados, leidos, tasa] = await Promise.all([cargarBuzones(ctx.db), cargarMensajesLeidos(ctx.db), obtenerTasaCorreccion(ctx)]);
  const ahora = completa.ahora;
  const visible = instantaneaVisible(completa, personaId);
  const nombres = nombrador(visible);
  const visibles = new Set(visible.trabajos.map((t) => t.id));
  const personas = new Map(completa.personas.map((p) => [p.id, breve(p)]));
  const porCorreo = new Map(EMPRESA_FRIO_DEL_VALLE.personas.map((p) => [p.correo.toLowerCase(), p.id]));
  const proyectos = new Map(completa.proyectos.map((p) => [p.id, { id: p.id, nombre: p.nombre }]));

  const buzonesVista = completa.personas.map((p) => {
    const b = conectados.find((x) => x.personaId === p.id);
    const propias = leidos.filter((m) => m.personaId === p.id);
    return {
      persona: breve(p),
      conectado: b !== undefined,
      proveedor: b?.proveedor ?? null,
      leidos: propias.length,
      laborales: propias.filter((m) => m.clase === 'laboral').length,
      personales: propias.filter((m) => m.clase === 'personal').length,
      boletines: propias.filter((m) => m.clase === 'boletin').length,
    };
  });

  // Lo laboral leído del buzón de quien mira. Los mensajes se rehacen de los ejemplos (sin red) para mostrar quién
  // escribió, a quién, la cita y el enlace de SU buzón; lo personal y los boletines ni se buscan.
  const propias = leidos
    .filter((m) => m.personaId === personaId && m.clase === 'laboral')
    .sort((a, b) => a.enviado.getTime() - b.enviado.getTime() || a.idInternet.localeCompare(b.idInternet));
  const conectado = conectados.find((b) => b.personaId === personaId);
  const buzon = conectado ? buzonesNormalizados([conectado])[0] : undefined;
  const hechos = buzon ? hechosDeCorreo([buzon], EMPRESA_FRIO_DEL_VALLE, ahora).hechos : [];

  const remitente = (nombre: string, correo: string): RemitenteVista => {
    const id = porCorreo.get(correo.toLowerCase());
    return { nombre, correo, persona: id ? (personas.get(id) ?? null) : null };
  };
  const lineas: LineaCorreoVista[] = [];
  const sinConvertir: SinConvertirVista[] = [];
  for (const fila of propias) {
    const m = buzon?.mensajes.find((x) => x.idInternet === fila.idInternet);
    if (!m) continue;
    const de = remitente(m.de.nombre, m.de.correo);
    const cita = hechos.find((h) => h.mensajeId === fila.idInternet)?.cita ?? citaDeMensaje(m.texto);
    const para = [...new Set([...m.para, ...m.cc].map((c) => porCorreo.get(c.toLowerCase())).filter((x): x is string => x !== undefined))]
      .map((id) => personas.get(id))
      .filter((p): p is PersonaBreve => p !== undefined);
    lineas.push({
      en: fila.enviado,
      de,
      para,
      resultado: fila.resultado,
      trabajos: nombres.refs(fila.trabajoIds.filter((id) => visibles.has(id))),
      cita,
      enlace: m.enlace,
    });
    if (fila.resultado === 'sin_plazo') sinConvertir.push({ en: fila.enviado, de, cita });
  }

  const esperas = calcularEsperas(visible);
  const persona_ = (id: string): PersonaBreve | undefined => personas.get(id);
  const definidas = <T>(xs: (T | undefined)[]) => xs.filter((x): x is T => x !== undefined);
  return {
    ahora,
    buzones: buzonesVista,
    lineas,
    sinConvertir,
    esperas: {
      cadenas: esperas.cadenas.map((c) => ({
        trabajos: nombres.refs(c.trabajoIds),
        personas: definidas(c.personaIds.map(persona_)),
        proyectos: definidas(c.proyectoIds.map((id) => proyectos.get(id))),
      })),
      cuellos: esperas.cuellos.flatMap((c) => {
        const p = persona_(c.personaId);
        if (!p) return [];
        return [{ persona: p, proyectos: definidas(c.proyectoIds.map((id) => proyectos.get(id))), esperando: definidas(c.esperando.map(persona_)) }];
      }),
    },
    tasa,
  };
}

/** Conecta (o vuelve a conectar) el buzón de una persona. ErrorDominio si la dirección no es de DOMINIO_EMPRESA (CC14). */
export async function conectarBuzon(ctx: ContextoServicio, personaId: string, direccion: string, proveedor: Proveedor): Promise<void> {
  const correo = (direccion ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(correo) || correo.split('@')[1] !== DOMINIO_EMPRESA) {
    throw new ErrorDominio(`Solo se pueden conectar buzones de la empresa (@${DOMINIO_EMPRESA}).`);
  }
  if (!PROVEEDORES.includes(proveedor)) throw new ErrorDominio('El proveedor del buzón debe ser Gmail u Outlook.');
  await ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const [p] = await tx.select({ id: personas.id }).from(personas).where(eq(personas.id, personaId));
    if (!p) throw new ErrorDominio('Esa persona no es de Frío del Valle.');
    const conectadoEn = await obtenerAhora({ ...ctx, db: tx });
    await tx
      .insert(buzones)
      .values({ personaId, direccion: correo, proveedor, conectadoEn })
      .onConflictDoUpdate({ target: buzones.personaId, set: { direccion: correo, proveedor, conectadoEn } });
  });
}
