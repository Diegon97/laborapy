import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePostulante,
  getStoredPostulantes,
  updatePostulanteEstado,
  filterPostulantes,
  clearStoredPostulantes,
  CIUDADES_PARAGUAY,
  VACANTES_DESTACADAS,
} from '../index';

describe('Módulo de Reclutamiento y Postulación Laboral — recruitmentService', () => {
  beforeEach(() => {
    clearStoredPostulantes();
  });

  it('cuenta con el catálogo de ciudades paraguayas y vacantes destacadas', () => {
    expect(CIUDADES_PARAGUAY.length).toBeGreaterThanOrEqual(10);
    expect(CIUDADES_PARAGUAY).toContain('Asunción');
    expect(CIUDADES_PARAGUAY).toContain('Luque');
    expect(CIUDADES_PARAGUAY).toContain('San Lorenzo');
    expect(VACANTES_DESTACADAS.length).toBeGreaterThanOrEqual(3);
  });

  it('guarda una postulación laboral con ID generado y estado inicial "nuevo"', () => {
    const postulante = savePostulante({
      nombres: 'Andrea',
      apellidos: 'Benítez',
      ci: '3.800.000',
      email: 'andrea@gmail.com',
      telefono: '0981999888',
      ciudad: 'Asunción',
      departamento: 'Capital',
      cargoPostulado: 'Auxiliar Contable',
      areaInteres: 'administrativo',
      nivelEstudios: 'Universitario graduado',
      experienciaAnios: 3,
      pretensionSalarialPYG: 3_500_000,
      disponibilidad: 'inmediata',
    });

    expect(postulante.id).toBeDefined();
    expect(postulante.estado).toBe('nuevo');
    expect(postulante.fechaPostulacion).toBeDefined();

    const guardados = getStoredPostulantes();
    expect(guardados.length).toBe(1);
    expect(guardados[0].nombres).toBe('Andrea');
  });

  it('actualiza el estado de una postulación (terna / entrevista / seleccionado)', () => {
    const postulante = savePostulante({
      nombres: 'Marcos',
      apellidos: 'Duarte',
      ci: '4.200.000',
      email: 'marcos@gmail.com',
      telefono: '0971123456',
      ciudad: 'Luque',
      departamento: 'Central',
      cargoPostulado: 'Chofer Repartidor',
      areaInteres: 'operativo',
      nivelEstudios: 'Secundaria completa',
      experienciaAnios: 4,
      pretensionSalarialPYG: 3_000_000,
      disponibilidad: 'inmediata',
    });

    const exito = updatePostulanteEstado(postulante.id, 'entrevista', 'Terna finalista para Chofer');
    expect(exito).toBe(true);

    const guardados = getStoredPostulantes();
    expect(guardados[0].estado).toBe('entrevista');
    expect(guardados[0].notas).toBe('Terna finalista para Chofer');
  });

  it('filtra postulantes por área, estado y texto de búsqueda', () => {
    savePostulante({
      nombres: 'Lucas',
      apellidos: 'Rivarola',
      ci: '5.100.000',
      email: 'lucas@gmail.com',
      telefono: '0985111222',
      ciudad: 'San Lorenzo',
      departamento: 'Central',
      cargoPostulado: 'Vendedor de Salón',
      areaInteres: 'comercial',
      nivelEstudios: 'Secundaria',
      experienciaAnios: 2,
      pretensionSalarialPYG: 2_800_000,
      disponibilidad: 'inmediata',
    });

    const filtradosComercial = filterPostulantes({ area: 'comercial' });
    expect(filtradosComercial.length).toBe(1);

    const filtradosAdmin = filterPostulantes({ area: 'administrativo' });
    expect(filtradosAdmin.length).toBe(0);

    const busquedaLucas = filterPostulantes({ busqueda: 'Rivarola' });
    expect(busquedaLucas.length).toBe(1);
  });
});
