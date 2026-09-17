/**
 * MOTOR DE AUDITORÍA PATRONAL PRE-MTESS — PARAGUAY
 * Versión: PY-AUD-2026.09.16
 *
 * Audita una nómina (EmpresaCliente + Empleado[] o planilla cargada) y detecta
 * contingencias laborales ante una eventual inspección del MTESS:
 *   1. Simulación / fraude por factura o falta de alta IPS (Arts. 18 y 19 C.T.).
 *   2. Salarios por debajo del SMLV mensual o su proporcional por horas.
 *   3. Exceso de horas extraordinarias (Art. 202 C.T.: 3 h/día · 57 h/semana).
 *   4. Omisión de bonificación familiar (Art. 261 C.T.).
 *   5. Falta de contrato escrito o período de prueba vencido sin confirmación.
 *   6. Trabajadoras con fuero maternal en riesgo de desvinculación (Ley 5508/15).
 *
 * Todas las operaciones son defensivas ante datos parciales o malformados.
 */

import type { Empleado } from '../../clientPortal/types/clientPortal';
import {
  VERSION_AUDITORIA,
  SMLV_MENSUAL_2026,
  JORNAL_MINIMO_2026,
  DIAS_JORNAL_MENSUAL,
  HORAS_SEMANA_LEGAL,
  HORAS_EXTRA_DIARIAS_MAX,
  HORAS_EXTRA_SEMANALES_MAX,
  BONIFICACION_FAMILIAR_PORCENTAJE,
  LIMITE_SALARIO_BONIFICACION_FAMILIAR,
  SEVERIDAD_INFO,
  ETIQUETA_NIVEL,
  DESCRIPCION_NIVEL,
} from '../types';
import type {
  AuditoriaPatronalInput,
  AuditoriaPatronalResult,
  DatosComplementariosEmpleado,
  HallazgoAuditoria,
  RecomendacionTecnica,
  FaseMitigacion,
  ResumenAuditoria,
  SemaforoRiesgo,
  SeveridadRiesgo,
  TipoHallazgoAuditoria,
} from '../types';

const MS_DIA = 86_400_000;

const ESTADOS_CON_FUERO = new Set<string>([
  'embarazada',
  'reposo_maternidad',
  'lactancia_obligatoria',
  'lactancia_extendida',
]);

const ORDEN_SEVERIDAD: Record<SeveridadRiesgo, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  bajo: 3,
};

function toNumber(valor: unknown, fallback = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function normalizarFecha(valor?: string): string | null {
  if (!valor || typeof valor !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const desde = Date.parse(`${desdeISO}T00:00:00Z`);
  const hasta = Date.parse(`${hastaISO}T00:00:00Z`);
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return 0;
  return Math.floor((hasta - desde) / MS_DIA);
}

function nombreCompleto(emp: Empleado): string {
  const nombre = `${emp?.nombres ?? ''} ${emp?.apellidos ?? ''}`.trim();
  return nombre || 'Trabajador sin datos';
}

function formatearGs(monto: number): string {
  return `Gs. ${Math.round(monto).toLocaleString('es-PY')}`;
}

function salarioMensualEquivalente(emp: Empleado): number {
  const base = toNumber(emp?.salarioBase, 0);
  switch (emp?.modalidadPago) {
    case 'jornalero':
      return base * DIAS_JORNAL_MENSUAL;
    case 'destajo':
    case 'comisionista':
    case 'factura':
    case 'mensual':
    default:
      return base;
  }
}

interface HallazgoParcial {
  empleadoId: string;
  empleadoNombre: string;
  ci: string;
  cargo: string;
  tipo: TipoHallazgoAuditoria;
  severidad: SeveridadRiesgo;
  titulo: string;
  descripcion: string;
  baseLegal: string;
  evidencia: string;
  recomendacion: string;
  cantidadAfectada?: number;
}

const CATALOGO_RECOMENDACIONES: Record<
  TipoHallazgoAuditoria,
  { titulo: string; detalle: string; baseLegal: string }
> = {
  simulacion_factura: {
    titulo: 'Reclasificar falsos prestadores de servicios bajo factura',
    detalle:
      'Suspender la modalidad de facturación recurrente y formalizar la relación de dependencia con alta en IPS y contrato escrito. La subordinación técnica, el horario fijo y la exclusividad activan la presunción legal de relación laboral.',
    baseLegal: 'Arts. 18 y 19 Ley N.º 213/93 (Primacía de la Realidad)',
  },
  omision_ips: {
    titulo: 'Inscribir al personal omitido en el IPS',
    detalle:
      'Regularizar el alta y los aportes obrero-patronales adeudados ante el IPS, con cálculo de retroactivos y presentación del REI. La inscripción es obligatoria para todo trabajador en relación de dependencia.',
    baseLegal: 'Decreto-Ley N.º 1860/50, Art. 76',
  },
  salario_bajo_minimo: {
    titulo: 'Ajustar remuneraciones al Salario Mínimo Legal Vigente',
    detalle:
      'Nivelar los salarios por debajo del mínimo legal (o su proporcional por jornada reducida) y notificar el reajuste por escrito al trabajador, con efecto retroactivo sobre las diferencias adeudadas.',
    baseLegal: 'Art. 245 y concordantes Ley N.º 213/93 · Decreto N.º 6225/2026',
  },
  exceso_horas_extras: {
    titulo: 'Regularizar la jornada y el tope de horas extraordinarias',
    detalle:
      'Redistribuir turnos para no exceder las 3 horas extraordinarias diarias ni 57 semanales, y garantizar el pago del recargo correspondiente (50% o 100%).',
    baseLegal: 'Arts. 200 y 202 Ley N.º 213/93',
  },
  omision_bonificacion_familiar: {
    titulo: 'Liquidar la bonificación familiar omitida',
    detalle:
      'Abonar la bonificación familiar del 5% del salario mínimo por cada hijo declarado y regularizar los períodos adeudados. El beneficio es irrenunciable mientras se mantenga el derecho.',
    baseLegal: 'Arts. 261 y 263 Ley N.º 213/93',
  },
  contrato_no_registrado: {
    titulo: 'Formalizar el contrato de trabajo por escrito',
    detalle:
      'Suscribir y registrar el contrato escrito con las cláusulas esenciales (tipo, jornada, salario, lugar de prestación) y remitir copia al trabajador.',
    baseLegal: 'Art. 38 Ley N.º 213/93',
  },
  periodo_prueba_vencido: {
    titulo: 'Confirmar o rescindir el contrato vencido el período de prueba',
    detalle:
      'Definir por escrito la continuidad del vínculo (contratación definitiva) o su cese dentro del plazo legal, evitando que la relación se consolide como indefinida por falta de decisión.',
    baseLegal: 'Arts. 55 y 58 Ley N.º 213/93',
  },
  fuero_maternal_riesgo: {
    titulo: 'Suspender toda desvinculación de trabajadoras con fuero maternal',
    detalle:
      'Abstenerse de preavisar, despedir o modificar condiciones sin autorización judicial previa. La desvinculación en fuero es nula de pleno derecho y genera indemnización agravada.',
    baseLegal: 'Art. 136 Ley N.º 213/93 y Art. 16 Ley N.º 5508/15',
  },
};

function construirSemaforo(nivel: SeveridadRiesgo): SemaforoRiesgo {
  const info = SEVERIDAD_INFO[nivel];
  return {
    nivel,
    etiqueta: ETIQUETA_NIVEL[nivel],
    colorHex: info.colorHex,
    rgb: info.rgb,
    descripcion: DESCRIPCION_NIVEL[nivel],
  };
}

function resolverNivelRiesgo(
  score: number,
  criticos: number,
  altos: number,
  medios: number,
): SeveridadRiesgo {
  if (criticos > 0 || score < 40) return 'critico';
  if (altos > 0 || score < 65) return 'alto';
  if (medios > 0 || score < 85) return 'medio';
  return 'bajo';
}

function construirResumen(
  hallazgos: HallazgoAuditoria[],
  totalEmpleados: number,
): ResumenAuditoria {
  const empleadosAfectados = new Set<string>();
  let criticos = 0;
  let altos = 0;
  let medios = 0;
  let bajos = 0;
  let multaTotal = 0;
  let penalizacion = 0;

  for (const h of hallazgos) {
    if (h.empleadoId) empleadosAfectados.add(h.empleadoId);
    multaTotal += h.multaEstimadaPYG;
    penalizacion += SEVERIDAD_INFO[h.severidad].pesoScore;
    if (h.severidad === 'critico') criticos++;
    else if (h.severidad === 'alto') altos++;
    else if (h.severidad === 'medio') medios++;
    else bajos++;
  }

  const score = hallazgos.length === 0 ? 100 : Math.max(0, Math.min(100, 100 - penalizacion));
  const nivel = resolverNivelRiesgo(score, criticos, altos, medios);

  return {
    totalEmpleados,
    empleadosConHallazgos: empleadosAfectados.size,
    totalHallazgos: hallazgos.length,
    criticos,
    altos,
    medios,
    bajos,
    multaTotalEstimadaPYG: multaTotal,
    scoreCumplimiento: score,
    semaforo: construirSemaforo(nivel),
  };
}

function construirRecomendaciones(
  hallazgos: HallazgoAuditoria[],
): RecomendacionTecnica[] {
  const porTipo = new Map<TipoHallazgoAuditoria, SeveridadRiesgo>();
  for (const h of hallazgos) {
    const actual = porTipo.get(h.tipo);
    if (!actual || ORDEN_SEVERIDAD[h.severidad] < ORDEN_SEVERIDAD[actual]) {
      porTipo.set(h.tipo, h.severidad);
    }
  }

  return Array.from(porTipo.entries())
    .sort((a, b) => ORDEN_SEVERIDAD[a[1]] - ORDEN_SEVERIDAD[b[1]])
    .map(([tipo, severidad], indice) => {
      const rec = CATALOGO_RECOMENDACIONES[tipo];
      return {
        id: `REC-${String(indice + 1).padStart(3, '0')}`,
        tipo,
        titulo: rec.titulo,
        prioridad: severidad,
        detalle: rec.detalle,
        baseLegal: rec.baseLegal,
      };
    });
}

function construirPlanMitigacion(hallazgos: HallazgoAuditoria[]): FaseMitigacion[] {
  const tiene = (tipo: TipoHallazgoAuditoria): boolean =>
    hallazgos.some((h) => h.tipo === tipo);

  const fase1: string[] = [];
  if (tiene('fuero_maternal_riesgo')) {
    fase1.push(
      'Suspender de inmediato cualquier desvinculación o modificación de condiciones de trabajadoras con fuero maternal; exigir autorización judicial previa (Ley N.º 5508/15).',
    );
  }
  if (tiene('simulacion_factura')) {
    fase1.push(
      'Suspender la modalidad de facturación recurrente y disponer el alta retroactiva al IPS de los falsos prestadores (Arts. 18 y 19 C.T.).',
    );
  }
  if (tiene('omision_ips')) {
    fase1.push(
      'Inscribir al personal sin cobertura en el IPS y regularizar los aportes obrero-patronales adeudados (Decreto-Ley N.º 1860/50).',
    );
  }
  if (tiene('salario_bajo_minimo')) {
    fase1.push(
      'Ajustar de inmediato los salarios por debajo del mínimo legal y notificar el reajuste por escrito al trabajador.',
    );
  }
  fase1.push(
    'Designar un responsable interno de compliance laboral para el seguimiento del plan de mitigación.',
  );

  const fase2: string[] = [];
  if (tiene('contrato_no_registrado')) {
    fase2.push(
      'Suscribir y registrar los contratos escritos faltantes, con copia firmada para el trabajador.',
    );
  }
  if (tiene('periodo_prueba_vencido')) {
    fase2.push(
      'Definir por escrito la confirmación o el cese del personal con período de prueba vencido.',
    );
  }
  if (tiene('omision_bonificacion_familiar')) {
    fase2.push(
      'Liquidar la bonificación familiar omitida y regularizar los períodos adeudados (Art. 261 C.T.).',
    );
  }
  if (tiene('exceso_horas_extras')) {
    fase2.push(
      'Rediseñar la organización de turnos y el registro de asistencia para respetar los topes del Art. 202 C.T.',
    );
  }
  fase2.push(
    'Actualizar la base documental de legajos, recibos de salario y comprobantes de aportes.',
  );

  const fase3: string[] = [
    'Implementar auditorías internas trimestrales con el motor de cumplimiento de LaboraPy.',
    'Capacitar al personal de RRHH en normativa laboral, IPS y obligaciones del REOP ante el MTESS.',
    'Monitorear mensualmente el score de cumplimiento y las alertas tempranas de riesgo.',
  ];

  return [
    {
      fase: 1,
      titulo: 'Contención inmediata de riesgos críticos',
      plazoDias: 15,
      acciones: fase1,
    },
    {
      fase: 2,
      titulo: 'Regularización documental y salarial',
      plazoDias: 45,
      acciones: fase2,
    },
    {
      fase: 3,
      titulo: 'Consolidación y prevención continua',
      plazoDias: 90,
      acciones: fase3,
    },
  ];
}

export function auditarNominaPatronal(
  input: AuditoriaPatronalInput,
): AuditoriaPatronalResult {
  const empresa = input.empresa;
  const empleados = Array.isArray(input.empleados) ? input.empleados : [];
  const complementarios = input.datosComplementarios ?? {};

  const contratosFirmados = new Set<string>();
  for (const contrato of input.contratos ?? []) {
    if (contrato && contrato.estado === 'firmado' && contrato.empleadoId) {
      contratosFirmados.add(contrato.empleadoId);
    }
  }

  const fueroMaternal = new Set<string>();
  for (const registro of input.registrosMaternidad ?? []) {
    if (registro && registro.fueroMaternalActivo && registro.empleadoId) {
      fueroMaternal.add(registro.empleadoId);
    }
  }

  const fechaCorte = normalizarFecha(input.fechaCorte) ?? hoyISO();
  const hallazgos: HallazgoAuditoria[] = [];
  let secuenciaHallazgos = 0;

  const registrar = (parcial: HallazgoParcial): void => {
    const cantidad = Math.max(1, Math.trunc(parcial.cantidadAfectada ?? 1));
    const jornales = SEVERIDAD_INFO[parcial.severidad].jornalesMulta;
    secuenciaHallazgos += 1;
    hallazgos.push({
      id: `AUD-${String(secuenciaHallazgos).padStart(4, '0')}`,
      empleadoId: parcial.empleadoId,
      empleadoNombre: parcial.empleadoNombre,
      ci: parcial.ci,
      cargo: parcial.cargo,
      tipo: parcial.tipo,
      severidad: parcial.severidad,
      titulo: parcial.titulo,
      descripcion: parcial.descripcion,
      baseLegal: parcial.baseLegal,
      evidencia: parcial.evidencia,
      recomendacion: parcial.recomendacion,
      jornalesMulta: jornales,
      cantidadAfectada: cantidad,
      multaEstimadaPYG: jornales * JORNAL_MINIMO_2026 * cantidad,
    });
  };

  for (const emp of empleados) {
    if (!emp) continue;

    const comp: DatosComplementariosEmpleado = complementarios[emp.id] ?? {};
    const estado = emp.estado ?? 'activo';
    const vigente = estado !== 'inactivo' && !emp.fechaEgreso;
    const base: Omit<
      HallazgoParcial,
      'tipo' | 'severidad' | 'titulo' | 'descripcion' | 'baseLegal' | 'evidencia' | 'recomendacion'
    > = {
      empleadoId: emp.id ?? '',
      empleadoNombre: nombreCompleto(emp),
      ci: emp.ci || '—',
      cargo: emp.cargo || 'Sin cargo',
    };

    if (vigente) {
      const salarioEquivalente = salarioMensualEquivalente(emp);

      // 1) Simulación / factura sin IPS — primacía de la realidad (Arts. 18 y 19 C.T.)
      if (emp.modalidadPago === 'factura') {
        registrar({
          ...base,
          tipo: 'simulacion_factura',
          severidad: 'critico',
          titulo: 'Posible simulación laboral bajo régimen de factura',
          descripcion:
            'El trabajador percibe remuneración recurrente mediante factura, lo que configura indicios de relación de dependencia encubierta con riesgo de reclasificación retroactiva.',
          baseLegal: 'Arts. 18 y 19 Ley N.º 213/93 (Primacía de la Realidad)',
          evidencia: `Modalidad de pago: factura · Remuneración declarada: ${formatearGs(salarioEquivalente)}`,
          recomendacion:
            'Reclasificar el vínculo como relación de dependencia y formalizar alta en IPS con contrato escrito.',
        });
      } else if (!emp.nroIps || !String(emp.nroIps).trim()) {
        registrar({
          ...base,
          tipo: 'omision_ips',
          severidad: 'critico',
          titulo: 'Trabajador sin inscripción al IPS',
          descripcion:
            'No se registra número patronal/asegurado IPS para un trabajador activo, configurando omisión de la seguridad social obligatoria.',
          baseLegal: 'Decreto-Ley N.º 1860/50, Art. 76',
          evidencia: `Estado: ${estado} · N.º IPS: no informado`,
          recomendacion:
            'Proceder al alta inmediata en el IPS y regularizar los aportes obrero-patronales adeudados.',
        });
      }

      // 2) Salario por debajo del mínimo legal (mensual o proporcional por horas)
      const horasSemanales =
        toNumber(comp.horasSemanales, HORAS_SEMANA_LEGAL) > 0
          ? toNumber(comp.horasSemanales, HORAS_SEMANA_LEGAL)
          : HORAS_SEMANA_LEGAL;
      const smlvProporcional =
        horasSemanales < HORAS_SEMANA_LEGAL
          ? Math.round(SMLV_MENSUAL_2026 * (horasSemanales / HORAS_SEMANA_LEGAL))
          : SMLV_MENSUAL_2026;

      if (salarioEquivalente < smlvProporcional) {
        const severidad: SeveridadRiesgo =
          salarioEquivalente < smlvProporcional * 0.5 ? 'alto' : 'medio';
        registrar({
          ...base,
          tipo: 'salario_bajo_minimo',
          severidad,
          titulo: 'Salario por debajo del Salario Mínimo Legal Vigente',
          descripcion:
            'La remuneración mensual homologada del trabajador resulta inferior al SMLV vigente o su proporcional por jornada reducida.',
          baseLegal: 'Art. 245 y concordantes Ley N.º 213/93 · Decreto N.º 6225/2026',
          evidencia: `Salario homologado: ${formatearGs(salarioEquivalente)} · Mínimo aplicable: ${formatearGs(smlvProporcional)} · Jornada: ${horasSemanales} h/semana`,
          recomendacion:
            'Nivelar el salario al mínimo legal y abonar las diferencias retroactivas adeudadas.',
        });
      }

      // 3) Exceso de horas extraordinarias (Art. 202 C.T.)
      const horasDiarias = toNumber(comp.horasExtrasDiarias, 0);
      const horasExtrasSemana = toNumber(comp.horasExtrasSemanales, 0);
      if (
        horasDiarias > HORAS_EXTRA_DIARIAS_MAX ||
        horasExtrasSemana > HORAS_EXTRA_SEMANALES_MAX
      ) {
        const excesivo =
          horasDiarias > HORAS_EXTRA_DIARIAS_MAX * 2 ||
          horasExtrasSemana > HORAS_EXTRA_SEMANALES_MAX + 20;
        registrar({
          ...base,
          tipo: 'exceso_horas_extras',
          severidad: excesivo ? 'critico' : 'alto',
          titulo: 'Exceso de horas extraordinarias',
          descripcion:
            'Las horas extras registradas superan el tope legal de 3 horas diarias o 57 horas semanales.',
          baseLegal: 'Arts. 200 y 202 Ley N.º 213/93',
          evidencia: `Horas extras: ${horasDiarias} h/día · ${horasExtrasSemana} h/semana (máx. ${HORAS_EXTRA_DIARIAS_MAX} h/día · ${HORAS_EXTRA_SEMANALES_MAX} h/semana)`,
          recomendacion:
            'Redistribuir la carga horaria y abonar los recargos del 50% o 100% según corresponda.',
        });
      }

      // 4) Omisión de bonificación familiar (Art. 261 C.T.)
      const cantHijos =
        toNumber(emp.hijosMenores, 0) + toNumber(emp.hijosDiscapacidad, 0);
      const bonificacionPagada = toNumber(comp.bonificacionFamiliarPagada, 0);
      const superaLimite = salarioEquivalente > LIMITE_SALARIO_BONIFICACION_FAMILIAR;
      if (cantHijos > 0 && !superaLimite && bonificacionPagada <= 0) {
        const montoEsperado = Math.round(
          BONIFICACION_FAMILIAR_PORCENTAJE * SMLV_MENSUAL_2026 * cantHijos,
        );
        registrar({
          ...base,
          tipo: 'omision_bonificacion_familiar',
          severidad: 'medio',
          titulo: 'Omisión de bonificación familiar',
          descripcion:
            'El trabajador declara hijos con derecho a bonificación familiar y no se registra pago alguno del beneficio.',
          baseLegal: 'Arts. 261 y 263 Ley N.º 213/93',
          evidencia: `Hijos declarados: ${cantHijos} · Bonificación abonada: ${formatearGs(bonificacionPagada)} · Monto esperado: ${formatearGs(montoEsperado)}`,
          recomendacion:
            'Liquidar la bonificación familiar del 5% del salario mínimo por hijo y regularizar períodos adeudados.',
        });
      }

      // 5) Contrato escrito registrado
      const tieneContratoEscrito =
        comp.tieneContratoEscrito === true || contratosFirmados.has(emp.id);
      if (estado !== 'prueba' && !tieneContratoEscrito) {
        registrar({
          ...base,
          tipo: 'contrato_no_registrado',
          severidad: 'alto',
          titulo: 'Trabajador sin contrato escrito registrado',
          descripcion:
            'No se registra contrato de trabajo escrito y firmado para un trabajador activo, incumpliendo las formalidades legales del vínculo.',
          baseLegal: 'Art. 38 Ley N.º 213/93',
          evidencia: `Estado: ${estado} · Contrato escrito: no registrado`,
          recomendacion:
            'Suscribir y registrar el contrato escrito con las cláusulas esenciales y entregar copia al trabajador.',
        });
      }

      // 6) Período de prueba vencido sin confirmación
      if (estado === 'prueba') {
        const fechaIngreso = normalizarFecha(emp.fechaIngreso);
        const diasPrueba = toNumber(emp.periodoPruebaDias, 30) || 30;
        if (fechaIngreso) {
          const transcurridos = diasEntre(fechaIngreso, fechaCorte);
          if (transcurridos > diasPrueba) {
            registrar({
              ...base,
              tipo: 'periodo_prueba_vencido',
              severidad: 'medio',
              titulo: 'Período de prueba vencido sin confirmación',
              descripcion:
                'El trabajador continúa registrado en período de prueba pese a haber transcurrido el plazo pactado, sin confirmación ni cese formal.',
              baseLegal: 'Arts. 55 y 58 Ley N.º 213/93',
              evidencia: `Ingreso: ${fechaIngreso} · Prueba pactada: ${diasPrueba} días · Transcurridos: ${transcurridos} días`,
              recomendacion:
                'Confirmar por escrito la continuidad laboral o formalizar el cese dentro del plazo legal.',
            });
          }
        }
      }

      // 7) Fuero maternal en riesgo de desvinculación (Ley 5508/15)
      const estadoMaternidad = emp.estadoMaternidad ?? 'ninguno';
      const tieneFuero =
        comp.fueroMaternalActivo === true ||
        fueroMaternal.has(emp.id) ||
        ESTADOS_CON_FUERO.has(estadoMaternidad);
      if (tieneFuero && comp.enProcesoDesvinculacion === true) {
        registrar({
          ...base,
          tipo: 'fuero_maternal_riesgo',
          severidad: 'critico',
          titulo: 'Riesgo de desvinculación con fuero maternal activo',
          descripcion:
            'La trabajadora se encuentra amparada por fuero maternal y se registra un proceso de desvinculación, configurando riesgo de despido nulo.',
          baseLegal: 'Art. 136 Ley N.º 213/93 y Art. 16 Ley N.º 5508/15',
          evidencia: `Estado maternidad: ${estadoMaternidad} · Fuero activo: Sí · Desvinculación en curso: Sí`,
          recomendacion:
            'Suspender inmediatamente el proceso de desvinculación; cualquier cese exige juicio de justificación de causal ante el Juzgado Laboral.',
        });
      }
    }
  }

  const resumen = construirResumen(hallazgos, empleados.length);
  const recomendaciones = construirRecomendaciones(hallazgos);
  const planMitigacion = construirPlanMitigacion(hallazgos);

  const rucEmpresa = empresa ? `${empresa.ruc || ''}${empresa.dv ? '-' + empresa.dv : ''}` : '—';

  return {
    empresaId: empresa?.id || 'sin_id',
    razonSocial: empresa?.razonSocial || 'EMPRESA AUDITADA',
    ruc: rucEmpresa,
    nroPatronalMtess: empresa?.nroPatronalMtess || '—',
    nroPatronalIps: empresa?.nroPatronalIps || '—',
    representanteLegal: empresa?.representanteLegalNombre || '—',
    fechaAuditoria: fechaCorte,
    versionReglas: VERSION_AUDITORIA,
    smlvAplicado: SMLV_MENSUAL_2026,
    jornalMinimoAplicado: JORNAL_MINIMO_2026,
    resumen,
    hallazgos,
    recomendaciones,
    planMitigacion,
  };
}
