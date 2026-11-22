// Piezas que comparten los adaptadores de Gmail y Outlook (docs/06 §13): encabezados, direcciones, HTML y citas.
// Todo es puro: recibe texto y devuelve texto.

export interface Direccion {
  nombre: string;
  correo: string;
}

const RE_PALABRA_CODIFICADA = /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g;

function bytesDeBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
}

function decodificarBytes(bytes: Uint8Array, juego = 'utf-8'): string {
  try {
    return new TextDecoder(juego.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Encabezado con palabras codificadas (RFC 2047), p. ej. `=?UTF-8?B?UmV2aXNpw7Nu?=` → «Revisión». */
export function decodificarEncabezado(valor: string): string {
  return valor.replace(/(\?=)\s+(=\?)/g, '$1$2').replace(RE_PALABRA_CODIFICADA, (_, juego: string, modo: string, texto: string) => {
    if (modo.toUpperCase() === 'B') return decodificarBytes(bytesDeBase64(texto), juego);
    const crudo = texto.replace(/_/g, ' ');
    const bytes: number[] = [];
    for (let i = 0; i < crudo.length; i++) {
      const hex = crudo.slice(i + 1, i + 3);
      if (crudo[i] === '=' && /^[0-9a-f]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
      } else bytes.push(crudo.charCodeAt(i));
    }
    return decodificarBytes(Uint8Array.from(bytes), juego);
  });
}

/** Lista de direcciones de un encabezado `From`/`To`/`Cc`: respeta comas dentro de comillas y de `<…>`. */
export function direccionesDe(valor: string): Direccion[] {
  const partes: string[] = [];
  let actual = '';
  let comillas = false;
  let angulo = false;
  for (const ch of valor) {
    if (ch === '"') comillas = !comillas;
    else if (ch === '<' && !comillas) angulo = true;
    else if (ch === '>') angulo = false;
    if (ch === ',' && !comillas && !angulo) {
      partes.push(actual);
      actual = '';
    } else actual += ch;
  }
  partes.push(actual);
  return partes
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = /^(.*)<([^>]+)>\s*$/.exec(p);
      if (!m) return { nombre: '', correo: p.toLowerCase() };
      return { nombre: (m[1] ?? '').trim().replace(/^"|"$/g, '').trim(), correo: (m[2] ?? '').trim().toLowerCase() };
    });
}

/** Identificadores `<…>` de `Message-ID`, `In-Reply-To` o `References`. */
export function idsDe(valor: string): string[] {
  return valor.match(/<[^<>\s]+>/g) ?? [];
}

const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

/** Texto legible de un cuerpo HTML: sin estilos, scripts ni etiquetas, con los saltos de párrafo. */
export function textoDeHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, e: string) => ENTIDADES[e] ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Inicio del historial citado en una respuesta: Gmail («El … escribió:») u Outlook (línea de guiones y «De:»). */
const RE_INICIO_CITA = /^(?:(?:El|On) .+(?:escribió|wrote):\s*$|_{10,}\s*$|-{3,} ?(?:Mensaje original|Original Message) ?-{3,}\s*$|(?:De|From): .+$)/im;

/** Lo que escribió esta persona en este mensaje, sin el historial citado. Así una respuesta no repite el pedido. */
export function sinCitas(texto: string): string {
  const corte = RE_INICIO_CITA.exec(texto);
  const propio = corte ? texto.slice(0, corte.index) : texto;
  return propio
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('>'))
    .join('\n')
    .trim();
}
