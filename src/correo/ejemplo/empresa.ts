// Frío del Valle en el correo (docs/08 §5.1): la única empresa de la demo. Las personas son las 12 de la semilla
// (mismos ids que `PERSONAS_SEMILLA`), con su dirección `nombre.apellido@friodelvalle.cr` y su departamento.
// Todo es inventado.
import type { EmpresaCorreo } from '@/correo/tipos';

export const EMPRESA_FRIO_DEL_VALLE: EmpresaCorreo = {
  nombre: 'Frío del Valle',
  dominio: 'friodelvalle.cr',
  // Clientes (La Colina, Trigal, Hotel Mirador) y proveedores (Refrigeración Central, habitual; Repuestos Ya, local).
  dominiosLaborales: ['lacolina.cr', 'panaderiatrigal.cr', 'hotelmirador.cr', 'refrigeracioncentral.cr', 'repuestosya.cr'],
  personas: [
    { id: 'marcela-solis', nombre: 'Marcela Solís', rol: 'Gerente general', departamento: 'Gerencia', correo: 'marcela.solis@friodelvalle.cr', jefeId: null },
    { id: 'andres-vargas', nombre: 'Andrés Vargas', rol: 'Jefe de operaciones', departamento: 'Operaciones', correo: 'andres.vargas@friodelvalle.cr', jefeId: 'marcela-solis' },
    { id: 'ricardo-brenes', nombre: 'Ricardo Brenes', rol: 'Contabilidad y facturación', departamento: 'Contabilidad', correo: 'ricardo.brenes@friodelvalle.cr', jefeId: 'marcela-solis' },
    { id: 'paola-herrera', nombre: 'Paola Herrera', rol: 'Ejecutiva de ventas', departamento: 'Ventas', correo: 'paola.herrera@friodelvalle.cr', jefeId: 'andres-vargas' },
    { id: 'sofia-navarro', nombre: 'Sofía Navarro', rol: 'Servicio al cliente', departamento: 'Servicio al cliente', correo: 'sofia.navarro@friodelvalle.cr', jefeId: 'andres-vargas' },
    { id: 'karla-jimenez', nombre: 'Karla Jiménez', rol: 'Encargada de compras', departamento: 'Compras', correo: 'karla.jimenez@friodelvalle.cr', jefeId: 'andres-vargas' },
    { id: 'lucia-mora', nombre: 'Lucía Mora', rol: 'Supervisora de bodega', departamento: 'Bodega', correo: 'lucia.mora@friodelvalle.cr', jefeId: 'andres-vargas' },
    { id: 'diego-rojas', nombre: 'Diego Rojas', rol: 'Bodeguero y despacho', departamento: 'Bodega', correo: 'diego.rojas@friodelvalle.cr', jefeId: 'lucia-mora' },
    { id: 'esteban-castro', nombre: 'Esteban Castro', rol: 'Supervisor de campo', departamento: 'Campo', correo: 'esteban.castro@friodelvalle.cr', jefeId: 'andres-vargas' },
    { id: 'jose-alfaro', nombre: 'José Alfaro', rol: 'Técnico', departamento: 'Campo', correo: 'jose.alfaro@friodelvalle.cr', jefeId: 'esteban-castro' },
    { id: 'daniela-quesada', nombre: 'Daniela Quesada', rol: 'Técnica', departamento: 'Campo', correo: 'daniela.quesada@friodelvalle.cr', jefeId: 'esteban-castro' },
    { id: 'mario-chaves', nombre: 'Mario Chaves', rol: 'Técnico', departamento: 'Campo', correo: 'mario.chaves@friodelvalle.cr', jefeId: 'esteban-castro' },
  ],
};

export const PERSONA_CORREO_POR_DEFECTO = 'marcela-solis';
