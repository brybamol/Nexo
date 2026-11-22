// Servicio del giro a correo (docs/06). Lee las correcciones guardadas, recalcula el modelo desde los buzones de
// ejemplo con la hora del reloj de la demo, y registra correcciones validadas.
import { asc } from 'drizzle-orm';
import { correccionesCorreo } from '@/db/esquema';
import { EMPRESA_FRIO_DEL_VALLE } from '@/correo/ejemplo/empresa';
import { construirBuzonesEjemplo } from '@/correo/ejemplo/buzones';
import { calcularModeloCorreo } from '@/correo/modelo';
import type {
  CambiosCorreccion,
  CompromisoConMarcas,
  CorreccionCorreo,
  ModeloCorreo,
  PersonaCorreo,
  Proveedor,
  TipoCorreccion,
} from '@/correo/tipos';
import type { Db } from '@/db/esquema';
import { ErrorDominio, noImplementado, type EstadoTrabajo, type ResumenLectura } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import { obtenerAhora } from '@/servicios/reloj';
import type { VistaCorreo } from '@/servicios/vistas';

const ESTADOS: readonly EstadoTrabajo[] = ['abierto', 'en_curso', 'bloqueado', 'resuelto'];
const TIPOS: readonly TipoCorreccion[] = ['confirmar', 'corregir', 'descartar'];
const MAX_TITULO = 160;

export async function obtenerModeloCorreo(ctx: ContextoServicio): Promise<ModeloCorreo> {
  const [ahora, filas] = await Promise.all([
    obtenerAhora(ctx),
    ctx.db.select().from(correccionesCorreo).orderBy(asc(correccionesCorreo.en), asc(correccionesCorreo.id)),
  ]);
  const correcciones: CorreccionCorreo[] = filas.map((f) => ({
    compromisoId: f.compromisoId,
    personaId: f.personaId,
    en: f.en,
    tipo: f.tipo,
    cambios: f.cambios,
  }));
  return calcularModeloCorreo({ empresa: EMPRESA_FRIO_DEL_VALLE, buzones: construirBuzonesEjemplo(), correcciones, ahora });
}

export function personasCorreo(): PersonaCorreo[] {
  return EMPRESA_FRIO_DEL_VALLE.personas;
}

/** Id válido de Frío del Valle, o null. */
export function personaCorreoValida(id: string | undefined | null): PersonaCorreo | null {
  return EMPRESA_FRIO_DEL_VALLE.personas.find((p) => p.id === id) ?? null;
}

export interface VistaPersonaCorreo {
  persona: PersonaCorreo;
  tePiden: CompromisoConMarcas[];
  esperas: CompromisoConMarcas[];
  resueltos: CompromisoConMarcas[];
}

function porUrgencia(a: CompromisoConMarcas, b: CompromisoConMarcas): number {
  const peso = (c: CompromisoConMarcas) => (c.marcas.atrasado ? 0 : c.estado === 'bloqueado' ? 1 : c.marcas.enRiesgo ? 2 : 3);
  return peso(a) - peso(b) || (a.plazo?.getTime() ?? Infinity) - (b.plazo?.getTime() ?? Infinity);
}

export function vistaPersonaCorreo(modelo: ModeloCorreo, personaId: string): VistaPersonaCorreo {
  const persona = personaCorreoValida(personaId);
  if (!persona) throw new ErrorDominio('Esa persona no es de Frío del Valle.');
  const activos = modelo.compromisos.filter((c) => c.estado !== 'resuelto');
  return {
    persona,
    tePiden: activos.filter((c) => c.responsableId === personaId).sort(porUrgencia),
    esperas: activos.filter((c) => c.solicitanteId === personaId).sort(porUrgencia),
    resueltos: modelo.compromisos.filter(
      (c) => c.estado === 'resuelto' && (c.responsableId === personaId || c.solicitanteId === personaId),
    ),
  };
}

export interface EntradaCorreccion {
  compromisoId: string;
  personaId: string;
  tipo: TipoCorreccion;
  cambios?: CambiosCorreccion;
}

/** Solo quien pidió o quien responde puede confirmar, corregir o descartar. La hora es la del reloj de la demo. */
export async function registrarCorreccion(ctx: ContextoServicio, entrada: EntradaCorreccion): Promise<void> {
  const persona = personaCorreoValida(entrada.personaId);
  if (!persona) throw new ErrorDominio('Esa persona no es de Frío del Valle.');
  if (!TIPOS.includes(entrada.tipo)) throw new ErrorDominio('La corrección debe ser confirmar, corregir o descartar.');

  const modelo = await obtenerModeloCorreo(ctx);
  const c = modelo.compromisos.find((x) => x.id === entrada.compromisoId);
  if (!c) throw new ErrorDominio('Ese compromiso no existe o ya fue descartado.');
  if (c.solicitanteId !== persona.id && c.responsableId !== persona.id) {
    throw new ErrorDominio(`Solo quien lo pidió o quien lo debe hacer puede revisar «${c.titulo}».`);
  }

  const cambios: CambiosCorreccion = {};
  if (entrada.tipo === 'corregir') {
    const e = entrada.cambios ?? {};
    const titulo = e.titulo?.trim();
    if (titulo !== undefined && titulo !== '' && titulo !== c.titulo) {
      if (titulo.length < 3 || titulo.length > MAX_TITULO) throw new ErrorDominio(`El título debe tener entre 3 y ${MAX_TITULO} caracteres.`);
      cambios.titulo = titulo;
    }
    if (e.responsableId && e.responsableId !== c.responsableId) {
      if (!personaCorreoValida(e.responsableId)) throw new ErrorDominio('El responsable debe ser alguien de Frío del Valle.');
      cambios.responsableId = e.responsableId;
    }
    if (e.plazo) {
      const plazo = new Date(e.plazo);
      if (Number.isNaN(plazo.getTime())) throw new ErrorDominio('El plazo no es una fecha válida.');
      if (plazo.getTime() !== c.plazo?.getTime()) cambios.plazo = plazo.toISOString();
    }
    if (e.estado && e.estado !== c.estado) {
      if (!ESTADOS.includes(e.estado)) throw new ErrorDominio('El estado no es válido.');
      cambios.estado = e.estado;
    }
    if (Object.keys(cambios).length === 0) throw new ErrorDominio('No cambiaste nada: modifica al menos un campo.');
  }

  await ctx.db.insert(correccionesCorreo).values({
    compromisoId: c.id,
    personaId: persona.id,
    en: modelo.ahora,
    tipo: entrada.tipo,
    cambios,
  });
}

// ── Reformas v2: el correo como fuente de trabajos (docs/08 §3 regla 10, §4, §6). Esqueletos de R2; los implementa R6a.
// Lo de arriba (modelo aparte con correcciones) lo retira R9.

/**
 * Regla 10: dentro de la transacción del reloj y ANTES del tick, lee los buzones conectados (tabla `buzones`) con
 * `enviado ≤ ahora`, procesa solo las copias que no están en `mensajes_leidos` y persiste el plan. Con 0 buzones o 0
 * copias nuevas no hace nada y devuelve null.
 */
export async function leerCorreo(tx: Db, ahora: Date): Promise<ResumenLectura | null> {
  return noImplementado('R6a · servicios/correo.ts · leerCorreo', tx, ahora);
}

/** Envío del próximo mensaje sin leer posterior a `ahora` en los buzones conectados, o null (irAlSiguienteEvento). */
export async function siguienteCorreo(tx: Db, ahora: Date): Promise<Date | null> {
  return noImplementado('R6a · servicios/correo.ts · siguienteCorreo', tx, ahora);
}

/** Pantalla Correo (§6) para la persona de la barra. Solo lectura. */
export async function obtenerVistaCorreo(ctx: ContextoServicio, personaId: string): Promise<VistaCorreo> {
  return noImplementado('R6a · servicios/correo.ts · obtenerVistaCorreo', ctx, personaId);
}

/** Conecta (o vuelve a conectar) el buzón de una persona. ErrorDominio si la dirección no es de DOMINIO_EMPRESA (CC14). */
export async function conectarBuzon(ctx: ContextoServicio, personaId: string, direccion: string, proveedor: Proveedor): Promise<void> {
  return noImplementado('R6a · servicios/correo.ts · conectarBuzon', ctx, personaId, direccion, proveedor);
}
