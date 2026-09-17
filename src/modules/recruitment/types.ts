/**
 * TIPOS DEL MÓDULO DE RECLUTAMIENTO Y BANCO DE TALENTOS — LABORAPY
 * Versión: PY-REC-2026.09.16
 */

export type AreaInteresLaboral =
  | 'operativo'
  | 'mandos_medios'
  | 'profesional'
  | 'tecnico'
  | 'administrativo'
  | 'comercial';

export type EstadoPostulacion =
  | 'nuevo'
  | 'en_revision'
  | 'entrevista'
  | 'seleccionado'
  | 'descartado';

export type DisponibilidadLaboral = 'inmediata' | '15_dias' | '1_mes';

export interface Postulante {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
  email: string;
  telefono: string;
  ciudad: string;
  departamento: string;
  cargoPostulado: string;
  areaInteres: AreaInteresLaboral;
  nivelEstudios: string;
  experienciaAnios: number;
  pretensionSalarialPYG: number;
  disponibilidad: DisponibilidadLaboral;
  cvNombre?: string;
  cvBase64?: string;
  fechaPostulacion: string;
  estado: EstadoPostulacion;
  empresaIdAsignada?: string;
  notas?: string;
}

export interface VacanteLaboral {
  id: string;
  titulo: string;
  empresaId?: string;
  empresaNombre: string;
  ciudad: string;
  area: AreaInteresLaboral;
  modalidad: 'presencial' | 'hibrido' | 'remoto';
  rangoSalarial: string;
  descripcion: string;
  requisitos: string[];
  fechaPublicacion: string;
  activa: boolean;
}
