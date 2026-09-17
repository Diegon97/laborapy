/**
 * CONSTANTES Y VACANTES MODELO — RECLUTAMIENTO LABORAPY
 * Versión: PY-REC-2026.09.16
 */

import type { VacanteLaboral } from './types';

export const CIUDADES_PARAGUAY = [
  'Asunción',
  'Luque',
  'San Lorenzo',
  'Fernando de la Mora',
  'Capiatá',
  'Lambaré',
  'Mariano Roque Alonso',
  'Ñemby',
  'Limpio',
  'Villa Elisa',
  'Itauguá',
  'Ciudad del Este',
  'Encarnación',
  'Coronel Oviedo',
  'Pedro Juan Caballero',
  'Villarrica',
  'Concepción',
  'Caaguazú',
] as const;

export const VACANTES_DESTACADAS: readonly VacanteLaboral[] = [
  {
    id: 'vac_001',
    titulo: 'Auxiliar Contable y Liquidación de Sueldos',
    empresaNombre: 'Consultora & Asociados',
    ciudad: 'Asunción',
    area: 'administrativo',
    modalidad: 'presencial',
    rangoSalarial: 'Gs. 3.200.000 - Gs. 3.800.000',
    descripcion: 'Manejo de sistema Marangatu (IVA/RG90), aportes IPS y asistencia en planillas MTESS.',
    requisitos: [
      'Estudiante de últimos años o egresado de Contabilidad',
      'Experiencia de 1 año en estudios contables o empresas',
      'Conocimiento de liquidaciones laborales paraguayas',
    ],
    fechaPublicacion: '2026-09-10',
    activa: true,
  },
  {
    id: 'vac_002',
    titulo: 'Encargado de Depósito y Logística',
    empresaNombre: 'Distribuidora Central S.A.',
    ciudad: 'San Lorenzo',
    area: 'operativo',
    modalidad: 'presencial',
    rangoSalarial: 'Gs. 3.000.000 + Horas Extras',
    descripcion: 'Control de inventario, despacho de mercaderías y supervisión de choferes repartidores.',
    requisitos: [
      'Bachiller concluido',
      'Manejo de Excel básico',
      'Disponibilidad para turnos rotativos diurnos',
    ],
    fechaPublicacion: '2026-09-12',
    activa: true,
  },
  {
    id: 'vac_003',
    titulo: 'Ejecutivo Comercial B2B / Ventas Corporativas',
    empresaNombre: 'Tech Guaraní',
    ciudad: 'Luque',
    area: 'comercial',
    modalidad: 'hibrido',
    rangoSalarial: 'Gs. 2.800.000 base + Comisiones sin tope',
    descripcion: 'Captación de clientes empresariales para soluciones de software y recursos humanos.',
    requisitos: [
      'Experiencia mínima de 2 años en ventas consultivas B2B',
      'Excelente comunicación y presencia profesional',
      'Movilidad propia (deseable)',
    ],
    fechaPublicacion: '2026-09-14',
    activa: true,
  },
];
