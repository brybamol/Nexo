// Grupo Altavista: empresa ficticia del giro a correo (docs/06 §8). Todo es inventado.
import type { EmpresaCorreo } from '@/correo/tipos';

export const EMPRESA_ALTAVISTA: EmpresaCorreo = {
  nombre: 'Grupo Altavista',
  dominio: 'altavista.cr',
  dominiosLaborales: ['translog.cr'],
  personas: [
    { id: 'roberto-solano', nombre: 'Roberto Solano', rol: 'Gerente general', departamento: 'Gerencia', correo: 'roberto.solano@altavista.cr', jefeId: null },
    { id: 'ana-rodriguez', nombre: 'Ana Rodríguez', rol: 'Jefa de compras', departamento: 'Compras', correo: 'ana.rodriguez@altavista.cr', jefeId: 'roberto-solano' },
    { id: 'luis-mendez', nombre: 'Luis Méndez', rol: 'Abogado corporativo', departamento: 'Legal', correo: 'luis.mendez@altavista.cr', jefeId: 'roberto-solano' },
    { id: 'carla-fernandez', nombre: 'Carla Fernández', rol: 'Tesorera', departamento: 'Finanzas', correo: 'carla.fernandez@altavista.cr', jefeId: 'roberto-solano' },
    { id: 'pablo-rojas', nombre: 'Pablo Rojas', rol: 'Analista financiero', departamento: 'Finanzas', correo: 'pablo.rojas@altavista.cr', jefeId: 'carla-fernandez' },
    { id: 'sergio-vargas', nombre: 'Sergio Vargas', rol: 'Gerente de marketing', departamento: 'Marketing', correo: 'sergio.vargas@altavista.cr', jefeId: 'roberto-solano' },
    { id: 'valeria-castro', nombre: 'Valeria Castro', rol: 'Líder de TI', departamento: 'TI', correo: 'valeria.castro@altavista.cr', jefeId: 'roberto-solano' },
  ],
};

export const PERSONA_CORREO_POR_DEFECTO = 'roberto-solano';
