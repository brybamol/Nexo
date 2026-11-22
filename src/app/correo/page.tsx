// La pantalla Correo ahora es Conexiones: esta ruta solo redirige para que los enlaces viejos sigan sirviendo.
import { redirect } from 'next/navigation';

export default function PaginaCorreo() {
  redirect('/conexiones');
}
