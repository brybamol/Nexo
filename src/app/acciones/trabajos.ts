'use server';
// Responder un seguimiento y marcar avisos como leídos (Mi día). Tarea 4.1.
import { NoImplementado } from '@/dominio/tipos';

export async function accionResponderSeguimiento(formData: FormData): Promise<void> {
  void formData;
  throw new NoImplementado('app/acciones/trabajos.ts (4.1)');
}

export async function accionMarcarLeidos(): Promise<void> {
  throw new NoImplementado('app/acciones/trabajos.ts (4.1)');
}
