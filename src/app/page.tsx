// `/` redirige a `/mi-dia`. Tarea 1.7.
import { redirect } from 'next/navigation';

export default function Inicio(): never {
  redirect('/mi-dia');
}
