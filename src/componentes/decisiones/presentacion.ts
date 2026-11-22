// Presentación de una decisión: ordena para la vista los textos y datos que ya arman el motor y el servicio.
// Solo reparte y agrupa lo que trae la DecisionVista; no calcula fechas, costos ni consecuencias.
// Si un texto del motor no tiene la forma esperada, devuelve null y la tarjeta muestra el texto tal cual.
import type { LetraOpcion } from '@/dominio/tipos';
import type { DecisionVista, OpcionVista } from '@/servicios/vistas';

// ─── Qué pasó ────────────────────────────────────────────────────────────────

export interface Hecho {
  etiqueta: string | null;
  texto: string;
}

/**
 * Parte el contexto en frases (corta en «. » seguido de mayúscula, nunca dentro de «…») y separa la etiqueta de las
 * que empiezan con «Algo: …» («Existencia corregida», «Esperan el repuesto», «Causa»).
 */
export function partirContexto(contexto: string): Hecho[] {
  const frases: string[] = [];
  let dentro = 0;
  let inicio = 0;
  for (let i = 0; i < contexto.length; i++) {
    const c = contexto[i];
    if (c === '«') dentro++;
    else if (c === '»') dentro = Math.max(0, dentro - 1);
    else if (c === '.' && dentro === 0 && /^\s+[A-ZÁÉÍÓÚÑ¿]/.test(contexto.slice(i + 1, i + 3))) {
      frases.push(contexto.slice(inicio, i + 1).trim());
      inicio = i + 1;
    }
  }
  const resto = contexto.slice(inicio).trim();
  if (resto) frases.push(resto);
  return frases.map((f) => {
    const m = /^([^:«»]{3,32}):\s+(.+)$/s.exec(f);
    return m ? { etiqueta: m[1]!, texto: m[2]! } : { etiqueta: null, texto: f };
  });
}

// ─── Opciones ────────────────────────────────────────────────────────────────

const PROVEEDOR = { local: 'proveedor local', habitual: 'proveedor habitual' } as const;

/** «Proveedor local», «Proveedor habitual» o «Local y habitual», según las líneas de la opción. */
export function nombreOpcion(o: OpcionVista): string {
  const proveedores = [...new Set(o.lineas.map((l) => l.proveedor))];
  if (proveedores.length === 1) {
    const p = PROVEEDOR[proveedores[0]!];
    return p.charAt(0).toUpperCase() + p.slice(1);
  }
  if (proveedores.length > 1) return 'Local y habitual';
  return '';
}

export function textoProveedor(p: keyof typeof PROVEEDOR): string {
  return PROVEEDOR[p];
}

// ─── Efecto por proyecto ─────────────────────────────────────────────────────

export type Efecto = { tipo: 'a_tiempo' } | { tipo: 'atrasa'; hasta: string } | { tipo: 'sin_cambios' };

export interface EfectosPorProyecto {
  /** Proyectos en el orden en que aparecen, unidos entre todas las opciones. */
  proyectos: string[];
  porOpcion: Partial<Record<LetraOpcion, Record<string, Efecto>>>;
}

interface Tramo {
  proyecto: string;
  efecto: Efecto;
  texto: string;
}

// «Cámara fría La Colina: a tiempo, sin cambios de fecha» o «…: se atrasa hasta el jue 3 dic (…)», separados por «. ».
const TRAMO = /(?:^|\.\s+)([^.:«»]+?): (?:(a tiempo, sin cambios de fecha)|se atrasa hasta el ([^(]+?) \()/g;

/** Tramos de `consecuencia` (motor/opciones.ts); null si el texto no tiene esa forma. */
function tramos(consecuencia: string): Tramo[] | null {
  const encontrados = [...consecuencia.matchAll(TRAMO)];
  if (encontrados.length === 0 || encontrados[0]!.index !== 0) return null;
  return encontrados.map((m, i) => ({
    proyecto: m[1]!.trim(),
    efecto: m[2] ? { tipo: 'a_tiempo' } : { tipo: 'atrasa', hasta: m[3]!.trim() },
    texto: consecuencia.slice(m.index, encontrados[i + 1]?.index ?? consecuencia.length),
  }));
}

/**
 * Efecto de cada opción en cada proyecto, leído de `consecuencia`. Un proyecto que una opción no nombra no tiene
 * cambios de fecha en esa opción (el motor nombra todo proyecto con un trabajo cubierto o movido).
 * null si alguna consecuencia no tiene la forma esperada: la tarjeta muestra entonces los textos completos.
 */
export function efectosPorProyecto(opciones: OpcionVista[]): EfectosPorProyecto | null {
  const proyectos: string[] = [];
  const porOpcion: EfectosPorProyecto['porOpcion'] = {};
  for (const o of opciones) {
    const ts = tramos(o.consecuencia);
    if (!ts) return null;
    const efectos: Record<string, Efecto> = {};
    for (const t of ts) {
      efectos[t.proyecto] = t.efecto;
      if (!proyectos.includes(t.proyecto)) proyectos.push(t.proyecto);
    }
    porOpcion[o.letra] = efectos;
  }
  for (const o of opciones) {
    const efectos = porOpcion[o.letra]!;
    for (const p of proyectos) efectos[p] ??= { tipo: 'sin_cambios' };
  }
  return { proyectos, porOpcion };
}

// ─── Trabajos afectados, por proyecto ────────────────────────────────────────

/** 'COLINA-4' → 'COLINA'; 'COLINA-D1' → 'COLINA'. */
export function claveDe(referencia: string): string {
  return referencia.replace(/-D?\d+$/, '');
}

/**
 * Nombre de proyecto de cada clave de referencia, con lo que trae la vista: la clave de la propia decisión y, en cada
 * consecuencia, los títulos citados en el tramo de cada proyecto. Lo que no se puede asegurar queda sin nombre.
 */
export function nombresDeClaves(d: DecisionVista): Map<string, string> {
  const nombres = new Map<string, string>();
  if (d.referencia) nombres.set(claveDe(d.referencia), d.proyecto.nombre);
  for (const o of d.opciones) {
    const ts = tramos(o.consecuencia);
    if (!ts) continue;
    for (const c of o.cambiosFecha) {
      const t = d.trabajos[c.trabajoId];
      if (!t?.referencia) continue;
      const donde = ts.filter((x) => x.texto.includes(`«${t.titulo}»`));
      if (donde.length === 1) nombres.set(claveDe(t.referencia), donde[0]!.proyecto);
    }
    // Un solo proyecto sin nombre y una sola clave sin nombre entre los trabajos que cubre la opción: son el mismo.
    const libres = ts.map((x) => x.proyecto).filter((p) => ![...nombres.values()].includes(p));
    const claves = [
      ...new Set(
        o.lineas.flatMap((l) => l.trabajoIds).map((id) => claveDe(d.trabajos[id]?.referencia ?? '')).filter((k) => k && !nombres.has(k)),
      ),
    ];
    if (libres.length === 1 && claves.length === 1) nombres.set(claves[0]!, libres[0]!);
  }
  return nombres;
}

export interface GrupoAfectados {
  clave: string;
  nombre: string | null;
  trabajos: DecisionVista['afectados'];
}

export function afectadosPorProyecto(d: DecisionVista): GrupoAfectados[] {
  const nombres = nombresDeClaves(d);
  const grupos: GrupoAfectados[] = [];
  for (const a of d.afectados) {
    const clave = claveDe(a.referencia);
    let g = grupos.find((x) => x.clave === clave);
    if (!g) {
      g = { clave, nombre: nombres.get(clave) ?? null, trabajos: [] };
      grupos.push(g);
    }
    g.trabajos.push(a);
  }
  return grupos;
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
