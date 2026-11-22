// Cómo se NOMBRA y se REFERENCIA cada cosa ante las personas. Puro. Única fuente del formato.
//
// Regla: el id interno (`T04`, `D01`, `C3`) es de la especificación y del código (base de datos, motor, rutas y
// pruebas). Las personas ven el TÍTULO y, como referencia secundaria, un código corto con la clave del proyecto y
// la numeración propia de cada proyecto:
//   trabajo   → «Instalar unidad condensadora y compresor» (COLINA-4)
//   decisión  → «Compra de 3 compresores de 2 HP» (COLINA-D1)
//   compromiso de correo → «Revisar el contrato de TransLog» (TRANSLOG-2)
// Ningún texto que genere Nexo construye un id a mano: todo pasa por estas funciones.

/** Lo mínimo para referenciar un trabajo en pantalla: id interno (para enlaces), título y referencia visible. */
export interface TrabajoRef {
  id: string;
  titulo: string;
  /** 'COLINA-4'; cadena vacía si el trabajo no tiene número (datos de prueba incompletos). */
  referencia: string;
}

/** 'COLINA' + 4 → 'COLINA-4'. Sin clave o sin número válido → ''. */
export function referenciaTrabajo(clave: string | null | undefined, numero: number | null | undefined): string {
  return clave && Number.isInteger(numero) && (numero as number) > 0 ? `${clave}-${numero}` : '';
}

/** 'COLINA' + 1 → 'COLINA-D1' (la «D» distingue las decisiones de los trabajos del mismo proyecto). */
export function referenciaDecision(clave: string | null | undefined, numero: number | null | undefined): string {
  return clave && Number.isInteger(numero) && (numero as number) > 0 ? `${clave}-D${numero}` : '';
}

/** Para etiquetas y enlaces: 'Cableado y tablero de control (COLINA-5)'; sin referencia, solo el título. */
export function nombreConReferencia(titulo: string, referencia: string): string {
  return referencia ? `${titulo} (${referencia})` : titulo;
}

/** Para frases: '«Cableado y tablero de control» (COLINA-5)'; sin referencia, '«Cableado y tablero de control»'. */
export function citaConReferencia(titulo: string, referencia: string): string {
  return referencia ? `«${titulo}» (${referencia})` : `«${titulo}»`;
}

/** 'a', 'a y b', 'a, b y c'. */
export function enumerar(xs: readonly string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

// ─── Repuestos y decisiones ───────────────────────────────────────────────────

function plural(palabra: string): string {
  return /[aeiouáéíóú]$/i.test(palabra) ? `${palabra}s` : `${palabra}es`;
}

/** «3 compresores de 2 HP», «1 compresor de 2 HP», «20 metros de empaque de puerta». */
export function cantidadDeRepuesto(r: { nombre: string; unidad: string }, n: number): string {
  const nombre = r.nombre.charAt(0).toLowerCase() + r.nombre.slice(1);
  if (r.unidad !== 'unidad') return `${n} ${n === 1 ? r.unidad : plural(r.unidad)} de ${nombre}`;
  if (n === 1) return `1 ${nombre}`;
  const corte = nombre.indexOf(' de ');
  const cabeza = corte >= 0 ? nombre.slice(0, corte) : nombre;
  const resto = corte >= 0 ? nombre.slice(corte) : '';
  return `${n} ${cabeza.split(' ').map(plural).join(' ')}${resto}`;
}

/** Título legible de una decisión de compra: «Compra de 3 compresores de 2 HP». */
export function tituloDecision(r: { nombre: string; unidad: string } | undefined, cantidad: number): string {
  return r ? `Compra de ${cantidadDeRepuesto(r, cantidad)}` : 'Compra de repuestos';
}

// ─── Clave de proyecto ────────────────────────────────────────────────────────

/** Clave corta a partir de un nombre propio: 'TransLog' → 'TRANSLOG'. Solo letras y números, en mayúsculas. */
export function claveDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toUpperCase();
}

// ─── Leer referencias escritas por una persona ────────────────────────────────

/** Referencias de trabajo escritas en un texto: «sigo con colina-4» → ['COLINA-4']. No incluye las de decisión. */
export function referenciasEnTexto(texto: string): string[] {
  const res: string[] = [];
  for (const m of texto.matchAll(/(?<![\p{L}\p{N}-])(\p{L}[\p{L}\p{N}]*)-(\d+)(?![\p{L}\p{N}-])/gu)) {
    const ref = `${claveDesdeNombre(m[1]!)}-${Number(m[2])}`;
    if (!res.includes(ref)) res.push(ref);
  }
  return res;
}

/**
 * Ids internos sueltos en un texto: T04, D01 (también S1 de seguimientos y C1 de compromisos de correo). No cuenta lo
 * que forma parte de una referencia (COLINA-D1) ni de otra palabra. Sirve de red: ningún texto para personas los lleva.
 */
export function idsInternosEn(texto: string): string[] {
  return [...texto.matchAll(/(?<![\p{L}\p{N}-])(?:T\d{2,}|D\d{2,}|S\d+|C\d{1,2})(?![\p{L}\p{N}])/gu)].map((m) => m[0]);
}

// ─── Nombrador: a partir de los datos (instantánea o filas) ───────────────────

export interface FuenteNombres {
  proyectos: readonly { id: string; clave: string }[];
  trabajos: readonly { id: string; proyectoId: string; numero: number; titulo: string }[];
  decisiones?: readonly { id: string; proyectoId: string; numero: number; repuestoId: string; cantidad: number }[];
  repuestos?: readonly { id: string; nombre: string; unidad: string }[];
}

export interface Nombrador {
  /** 'COLINA-4' ('' si no se conoce). */
  referencia(trabajoId: string): string;
  /** 'Título (COLINA-4)'. */
  nombre(trabajoId: string): string;
  /** '«Título» (COLINA-4)'. */
  cita(trabajoId: string): string;
  /** Citas enumeradas: '«A» (COLINA-5) y «B» (TRIGAL-4)'. */
  citas(trabajoIds: readonly string[]): string;
  ref(trabajoId: string): TrabajoRef;
  refs(trabajoIds: readonly string[]): TrabajoRef[];
  /** Id interno a partir de lo que escribió una persona o propuso la IA: el id interno o la referencia ('colina-4'). */
  resolver(texto: string): string | null;
  /** 'COLINA-D1'. */
  referenciaDecision(decisionId: string): string;
  /** 'Compra de 3 compresores de 2 HP'. */
  tituloDecision(decisionId: string): string;
  /** '«Compra de 3 compresores de 2 HP» (COLINA-D1)'. */
  citaDecision(decisionId: string): string;
}

export function crearNombrador(f: FuenteNombres): Nombrador {
  const claves = new Map(f.proyectos.map((p) => [p.id, p.clave]));
  const trabajos = new Map(f.trabajos.map((t) => [t.id, t]));
  const repuestos = new Map((f.repuestos ?? []).map((r) => [r.id, r]));
  const decisiones = new Map((f.decisiones ?? []).map((d) => [d.id, d]));
  const porReferencia = new Map<string, string>();
  for (const t of f.trabajos) {
    const r = referenciaTrabajo(claves.get(t.proyectoId), t.numero);
    if (r) porReferencia.set(r, t.id);
  }

  const referencia = (id: string) => {
    const t = trabajos.get(id);
    return t ? referenciaTrabajo(claves.get(t.proyectoId), t.numero) : '';
  };
  const titulo = (id: string) => trabajos.get(id)?.titulo ?? 'un trabajo';
  const cita = (id: string) => citaConReferencia(titulo(id), referencia(id));
  const ref = (id: string): TrabajoRef => ({ id, titulo: titulo(id), referencia: referencia(id) });

  const refDecision = (id: string) => {
    const d = decisiones.get(id);
    return d ? referenciaDecision(claves.get(d.proyectoId), d.numero) : '';
  };
  const tituloDe = (id: string) => {
    const d = decisiones.get(id);
    return d ? tituloDecision(repuestos.get(d.repuestoId), d.cantidad) : 'una decisión';
  };

  return {
    referencia,
    nombre: (id) => nombreConReferencia(titulo(id), referencia(id)),
    cita,
    citas: (ids) => enumerar(ids.map(cita)),
    ref,
    refs: (ids) => ids.map(ref),
    resolver: (texto) => {
      const limpio = texto.trim();
      if (trabajos.has(limpio)) return limpio;
      return porReferencia.get(limpio.toUpperCase().replace(/\s+/g, '')) ?? null;
    },
    referenciaDecision: refDecision,
    tituloDecision: tituloDe,
    citaDecision: (id) => citaConReferencia(tituloDe(id), refDecision(id)),
  };
}
