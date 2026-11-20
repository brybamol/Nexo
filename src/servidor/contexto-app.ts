// Contexto de la aplicación (singleton del proceso) y persona actual (cookie). Tarea 1.5.
// Solo servidor: lo usan páginas y server actions, nunca el motor ni los servicios.
import { cookies } from 'next/headers';
import { obtenerConexion } from '@/db/conexion';
import { cargarSemilla } from '@/db/semilla/cargar';
import { COOKIE_PERSONA, PERSONA_POR_DEFECTO } from '@/dominio/constantes';
import { crearInterprete } from '@/ia/elegir';
import type { ContextoServicio } from '@/servicios/contexto';
import { listarPersonas } from '@/servicios/personas';

declare global {
  var __nexoContexto: Promise<ContextoServicio> | undefined;
}

async function crearContexto(): Promise<ContextoServicio> {
  const conexion = await obtenerConexion(); // esquema creado (DDL_CREAR)
  await cargarSemilla(conexion.db); // idempotente: no hace nada si ya hay personas
  return { db: conexion.db, ia: crearInterprete() };
}

/** Conexión única (obtenerConexion) + crearInterprete(); carga la semilla si `personas` está vacía. */
export function obtenerContextoApp(): Promise<ContextoServicio> {
  if (!globalThis.__nexoContexto) {
    const promesa = crearContexto();
    // Si falla, no dejar la promesa rota en caché: el siguiente intento reintenta.
    promesa.catch(() => {
      if (globalThis.__nexoContexto === promesa) globalThis.__nexoContexto = undefined;
    });
    globalThis.__nexoContexto = promesa;
  }
  return globalThis.__nexoContexto;
}

/** Id de la persona de la cookie COOKIE_PERSONA, o PERSONA_POR_DEFECTO (también si la cookie trae un id desconocido). */
export async function personaActual(): Promise<string> {
  const almacen = await cookies();
  const id = almacen.get(COOKIE_PERSONA)?.value;
  if (!id) return PERSONA_POR_DEFECTO;
  const ctx = await obtenerContextoApp();
  const personas = await listarPersonas(ctx);
  return personas.some((p) => p.id === id) ? id : PERSONA_POR_DEFECTO;
}
