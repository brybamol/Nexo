// Detalle de un trabajo: estado, marcas con causas, bloqueante, notas, dependencias. Lee obtenerTrabajo. Tarea 1.7.
export default async function PaginaTrabajo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main>Trabajo {id} (no implementado: 1.7)</main>;
}
