// Modelo vivo del correo (docs/06 §4.6 y §6): correcciones, marcas, cadenas de espera y cuellos de botella.
// Puro: la hora llega como argumento, nada lee la base ni la red.
import { enlazarEsperas, agruparProyectos } from '@/correo/enlaces';
import { extraerDeHilo } from '@/correo/extraccion';
import { unirBuzones } from '@/correo/union';
import type {
  Buzon,
  Cadena,
  CausaCorreo,
  Compromiso,
  CompromisoConMarcas,
  CorreccionCorreo,
  EmpresaCorreo,
  MarcasCorreo,
  ModeloCorreo,
  ProyectoCorreo,
} from '@/correo/tipos';

/** Aplica las correcciones en orden. Descartar quita el compromiso; corregir cambia campos; confirmar solo lo marca. */
export function aplicarCorrecciones(compromisos: Compromiso[], correcciones: CorreccionCorreo[]): Compromiso[] {
  const ordenadas = [...correcciones].sort((a, b) => a.en.getTime() - b.en.getTime());
  let lista = compromisos;
  for (const k of ordenadas) {
    const c = lista.find((x) => x.id === k.compromisoId);
    if (!c) continue;
    if (k.tipo === 'descartar') {
      lista = lista.filter((x) => x.id !== c.id);
      continue;
    }
    if (k.tipo === 'corregir') {
      const { titulo, responsableId, plazo, estado } = k.cambios;
      if (titulo) c.titulo = titulo;
      if (responsableId) c.responsableId = responsableId;
      if (plazo) c.plazo = new Date(plazo);
      if (estado) {
        c.estado = estado;
        c.resueltoEn = estado === 'resuelto' ? k.en : null;
        if (estado !== 'bloqueado' && c.esperaA?.tipo === 'bloqueo') c.esperaA = null;
      }
    }
    c.revision = { tipo: k.tipo === 'confirmar' ? 'confirmado' : 'corregido', porId: k.personaId, en: k.en };
  }
  return lista;
}

/** Atrasado si no está resuelto y ahora ≥ plazo. En riesgo si espera a algo sin resolver que no llega a tiempo. */
export function calcularMarcasCorreo(compromisos: Compromiso[], ahora: Date): Map<string, MarcasCorreo> {
  const porId = new Map(compromisos.map((c) => [c.id, c]));
  const memo = new Map<string, MarcasCorreo>();
  const enCurso = new Set<string>();

  const atrasado = (c: Compromiso) => c.estado !== 'resuelto' && c.plazo !== null && ahora.getTime() >= c.plazo.getTime();

  const marcas = (c: Compromiso): MarcasCorreo => {
    const previo = memo.get(c.id);
    if (previo) return previo;
    const causas: CausaCorreo[] = [];
    const esAtrasado = atrasado(c);
    if (esAtrasado) causas.push({ tipo: 'atrasado' });
    let enRiesgo = false;
    const d = c.esperaA?.compromisoId ? porId.get(c.esperaA.compromisoId) : undefined;
    if (c.estado !== 'resuelto' && d && d.estado !== 'resuelto' && !enCurso.has(c.id)) {
      enCurso.add(c.id);
      let motivo: Extract<CausaCorreo, { tipo: 'espera' }>['motivo'] | null = null;
      if (atrasado(d)) motivo = 'atrasado';
      else if (d.estado === 'bloqueado') motivo = 'bloqueado';
      else if (marcas(d).enRiesgo) motivo = 'en_riesgo';
      else if (d.plazo && c.plazo && d.plazo.getTime() > c.plazo.getTime()) motivo = 'plazo_posterior';
      enCurso.delete(c.id);
      if (motivo) {
        enRiesgo = true;
        causas.push({ tipo: 'espera', compromisoId: d.id, motivo });
      }
    }
    const r = { atrasado: esAtrasado, enRiesgo, causas };
    memo.set(c.id, r);
    return r;
  };

  for (const c of compromisos) marcas(c);
  return memo;
}

/** Cadenas de espera activas, desde el compromiso al que nadie espera hasta el último que bloquea. */
export function calcularCadenas(compromisos: Compromiso[]): Cadena[] {
  const activos = compromisos.filter((c) => c.estado !== 'resuelto');
  const porId = new Map(activos.map((c) => [c.id, c]));
  const esperados = new Set(activos.map((c) => c.esperaA?.compromisoId).filter((id): id is string => !!id && porId.has(id)));
  const cadenas: Cadena[] = [];
  for (const raiz of activos) {
    if (esperados.has(raiz.id) || !raiz.esperaA?.compromisoId || !porId.has(raiz.esperaA.compromisoId)) continue;
    const ids = [raiz.id];
    let siguiente = porId.get(raiz.esperaA.compromisoId);
    while (siguiente && !ids.includes(siguiente.id)) {
      ids.push(siguiente.id);
      siguiente = siguiente.esperaA?.compromisoId ? porId.get(siguiente.esperaA.compromisoId) : undefined;
    }
    cadenas.push({ compromisoIds: ids });
  }
  return cadenas;
}

/** Personas en la cadena: quien pidió el primero y luego el responsable de cada eslabón (sin repetir seguidas). */
export function personasDeCadena(cadena: Cadena, compromisos: Compromiso[]): string[] {
  const porId = new Map(compromisos.map((c) => [c.id, c]));
  const ids = cadena.compromisoIds.map((id) => porId.get(id)).filter((c): c is Compromiso => !!c);
  const personas = [ids[0]?.solicitanteId ?? null, ...ids.map((c) => c.responsableId)].filter((p): p is string => !!p);
  return personas.filter((p, i) => p !== personas[i - 1]);
}

export interface EntradaModeloCorreo {
  empresa: EmpresaCorreo;
  buzones: Buzon[];
  correcciones: CorreccionCorreo[];
  ahora: Date;
}

/** Todo el flujo de docs/06 §4: unión, extracción, correcciones, enlaces, proyectos, marcas y cadenas. */
export function calcularModeloCorreo({ empresa, buzones, correcciones, ahora }: EntradaModeloCorreo): ModeloCorreo {
  const { hilos, conteos } = unirBuzones(buzones, empresa, ahora);
  const extraidos = hilos.flatMap((h) => extraerDeHilo(h, empresa));
  // Los códigos se fijan antes de descartar, para que no cambien cuando alguien descarta uno.
  extraidos.sort((a, b) => (a.evidencias[0]?.en.getTime() ?? 0) - (b.evidencias[0]?.en.getTime() ?? 0));
  const codigos = new Map(extraidos.map((c, i) => [c.id, `C${i + 1}`]));

  const compromisos = aplicarCorrecciones(extraidos, correcciones);
  enlazarEsperas(compromisos, empresa);
  agruparProyectos(compromisos);
  const marcas = calcularMarcasCorreo(compromisos, ahora);
  const cadenas = calcularCadenas(compromisos);

  const conMarcas: CompromisoConMarcas[] = compromisos.map((c) => ({
    ...c,
    codigo: codigos.get(c.id) ?? c.id,
    marcas: marcas.get(c.id) ?? { atrasado: false, enRiesgo: false, causas: [] },
  }));

  const nombres = [...new Set(conMarcas.map((c) => c.proyecto))];
  const proyectos: ProyectoCorreo[] = nombres.map((nombre) => {
    const ids = new Set(conMarcas.filter((c) => c.proyecto === nombre).map((c) => c.id));
    return {
      nombre,
      compromisoIds: [...ids],
      cadenas: cadenas.filter((k) => k.compromisoIds.some((id) => ids.has(id))),
    };
  });

  const apariciones = new Map<string, { cadenas: number; proyectos: Set<string> }>();
  for (const p of proyectos) {
    for (const k of p.cadenas) {
      for (const persona of new Set(personasDeCadena(k, compromisos).slice(1))) {
        const a = apariciones.get(persona) ?? { cadenas: 0, proyectos: new Set<string>() };
        a.cadenas++;
        a.proyectos.add(p.nombre);
        apariciones.set(persona, a);
      }
    }
  }
  const cuellos = [...apariciones.entries()]
    .filter(([, a]) => a.cadenas >= 2)
    .map(([personaId, a]) => ({ personaId, cadenas: a.cadenas, proyectos: [...a.proyectos] }))
    .sort((a, b) => b.cadenas - a.cadenas || a.personaId.localeCompare(b.personaId));

  return { ahora, empresa, compromisos: conMarcas, proyectos, conteos, cuellos };
}
