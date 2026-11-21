// Servicio del giro a correo (docs/06). Lee las correcciones guardadas, recalcula el modelo desde los buzones de
// ejemplo con la hora del reloj de la demo, y registra correcciones validadas.
import { asc } from 'drizzle-orm';
import { correccionesCorreo } from '@/db/esquema';
import { EMPRESA_ALTAVISTA } from '@/correo/ejemplo/empresa';
import { construirBuzonesEjemplo } from '@/correo/ejemplo/buzones';
import { calcularModeloCorreo } from '@/correo/modelo';
import type {
  CambiosCorreccion,
  CompromisoConMarcas,
  CorreccionCorreo,
  ModeloCorreo,
  PersonaCorreo,
  TipoCorreccion,
} from '@/correo/tipos';
import { ErrorDominio, type EstadoTrabajo } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import { obtenerAhora } from '@/servicios/reloj';

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
  return calcularModeloCorreo({ empresa: EMPRESA_ALTAVISTA, buzones: construirBuzonesEjemplo(), correcciones, ahora });
}

export function personasCorreo(): PersonaCorreo[] {
  return EMPRESA_ALTAVISTA.personas;
}

/** Id válido de Grupo Altavista, o null. */
export function personaCorreoValida(id: string | undefined | null): PersonaCorreo | null {
  return EMPRESA_ALTAVISTA.personas.find((p) => p.id === id) ?? null;
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
  if (!persona) throw new ErrorDominio('Esa persona no es de Grupo Altavista.');
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
  if (!persona) throw new ErrorDominio('Esa persona no es de Grupo Altavista.');
  if (!TIPOS.includes(entrada.tipo)) throw new ErrorDominio('La corrección debe ser confirmar, corregir o descartar.');

  const modelo = await obtenerModeloCorreo(ctx);
  const c = modelo.compromisos.find((x) => x.id === entrada.compromisoId);
  if (!c) throw new ErrorDominio('Ese compromiso no existe o ya fue descartado.');
  if (c.solicitanteId !== persona.id && c.responsableId !== persona.id) {
    throw new ErrorDominio(`Solo quien lo pidió o quien lo debe hacer puede revisar ${c.codigo}.`);
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
      if (!personaCorreoValida(e.responsableId)) throw new ErrorDominio('El responsable debe ser alguien de Grupo Altavista.');
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
