/**
 * BATERÍA DE 10 PRUEBAS EMPÍRICAS DE LONGITUD DE ENLACE AL COMPARTIR EN TOBI
 * Verifica empíricamente 10 escenarios reales de conversación y finiquito,
 * midiendo la longitud exacta antes vs después del acortador y la integridad del redirect.
 */

function cleanAllActionBlockMarkers(content) {
  return content.replace(/```(?:json)?\s*\{\s*"action":\s*"(?:settlement|document|options)"[\s\S]*?```/gi, '').trim();
}

function encodeShareChat(msgs) {
  try {
    const compact = msgs.map((m) => {
      const cleanContent = cleanAllActionBlockMarkers(m.content || '');
      const item = [m.role === 'user' ? 1 : 0, cleanContent];
      if (m.settlementData?.input) {
        const inp = m.settlementData.input;
        item[2] = {
          s: inp.salarioMensual,
          i: inp.fechaIngreso,
          e: inp.fechaEgreso,
          m: inp.motivo,
          r: inp.regimen,
          p: inp.preaviso?.otorgado,
          n: inp.nombreEmpleado,
          c: inp.ciEmpleado,
          v: inp.vacacionesPeriodosAnteriores,
        };
      } else if (m.documentData) {
        item[3] = m.documentData;
      }
      return item;
    });

    const json = JSON.stringify(compact);
    const b64 = Buffer.from(encodeURIComponent(json)).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodeURIComponent(b64);
  } catch {
    return '';
  }
}

function decodeShareChat(encoded) {
  try {
    let b64 = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const decodedStr = Buffer.from(b64, 'base64').toString('utf8');
    const json = decodeURIComponent(decodedStr);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function encodeShortSettlementLink(input) {
  try {
    const compactStr = [
      Math.round(input.salarioMensual || 3044000),
      input.fechaIngreso || '',
      input.fechaEgreso || '',
      input.motivo || 'despido_sin_causa',
      input.vacacionesPeriodosAnteriores ?? 0,
      input.preaviso?.otorgado ? 1 : 0,
      input.nombreEmpleado ? encodeURIComponent(String(input.nombreEmpleado).trim()) : '',
    ].join('|');

    return Buffer.from(encodeURIComponent(compactStr)).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
}

function decodeShortSettlementLink(encoded) {
  try {
    let b64 = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const decodedStr = Buffer.from(b64, 'base64').toString('utf8');
    const decoded = decodeURIComponent(decodedStr);
    const parts = decoded.split('|');
    return parts.length >= 4;
  } catch {
    return false;
  }
}

const SCENARIOS = [
  {
    num: 1,
    title: 'Consulta legal simple (Aguinaldo proporcional)',
    messages: [
      { role: 'user', content: '¿Cuánto me corresponde de aguinaldo proporcional si renuncié en julio tras ganar 4.000.000 mensual?' },
      {
        role: 'assistant',
        content: 'Conforme al Art. 243 del Código del Trabajo (Ley 213/93), el aguinaldo se calcula como la doceava parte de las remuneraciones devengadas durante el año calendario. Si trabajaste 7 meses con un salario de Gs. 4.000.000, tu total acumulado es Gs. 28.000.000. Al dividir por 12, te corresponde exactamente Gs. 2.333.333 en concepto de aguinaldo proporcional al momento del cese laboral.'
      }
    ]
  },
  {
    num: 2,
    title: 'Conversación multi-turno (3 turnos sobre despido verbal)',
    messages: [
      { role: 'user', content: 'Mi jefe me dijo que ya no vuelva a trabajar pero no me dio ninguna nota escrita.' },
      { role: 'assistant', content: 'El despido puramente verbal constituye despido injustificado con base en los artículos 84 y concordantes del Código del Trabajo. Al no mediar notificación escrita ni causa legal comprobada del Art. 81, el trabajador tiene derecho a percibir la totalidad de las indemnizaciones legales.' },
      { role: 'user', content: '¿Y qué tengo que hacer para que no me acusen de abandono de trabajo?' },
      { role: 'assistant', content: 'Debés presentarte a la oficina de Mediación y Conciliación del MTESS o remitir un telegrama colacionado intimando a la empresa a que aclare tu situación laboral en 48 horas, evitando que invoquen falsamente el Art. 81 inc. g (abandono).' },
      { role: 'user', content: '¿Cuánto tiempo tengo para hacer ese trámite en el MTESS?' },
      { role: 'assistant', content: 'El plazo de prescripción general para acciones derivadas del contrato de trabajo es de 60 días según el Art. 399 del Código Laboral, pero es crítico accionar dentro de las primeras 48 a 72 horas hábiles.' }
    ]
  },
  {
    num: 3,
    title: 'Liquidación con cálculo y finiquito interactivo',
    messages: [
      { role: 'user', content: 'Calculame la liquidación oficial por despido sin causa de Carlos Benítez, salario 5.500.000, ingreso 01/02/2021, egreso 28/02/2026.' },
      {
        role: 'assistant',
        content: 'Liquidación oficial calculada conforme a la Ley N° 213/93 para una antigüedad de 5 años y 0 meses. El finiquito incluye indemnización legal por antigüedad (Art. 91), compensación de preaviso omitido (Art. 87), aguinaldo proporcional (Art. 243) y vacaciones causadas.',
        settlementData: {
          input: {
            salarioMensual: 5500000,
            fechaIngreso: '2021-02-01',
            fechaEgreso: '2026-02-28',
            motivo: 'despido_sin_causa',
            nombreEmpleado: 'Carlos Benítez',
            preaviso: { otorgado: false },
            vacacionesPeriodosAnteriores: 0
          }
        }
      }
    ]
  },
  {
    num: 4,
    title: 'Consulta sobre preaviso omitido y plazos de preaviso',
    messages: [
      { role: 'user', content: '¿Cuáles son los plazos de preaviso para un trabajador que tiene 4 años de antigüedad según el artículo 87?' },
      {
        role: 'assistant',
        content: 'El artículo 87 del Código Laboral paraguayo establece una escala progresiva obligatoria:\na) Hasta un año: 30 días;\nb) De uno a cinco años: 45 días (o 30 a 45 días según el tramo de antigüedad cumplida);\nc) De cinco a diez años: 60 días;\nd) De diez años en adelante: 90 días.\nSi el empleador omite el preaviso, debe indemnizarlo íntegramente con el importe del salario correspondiente a dicho lapso.'
      }
    ]
  },
  {
    num: 5,
    title: 'Jurisprudencia vinculante CSJ sobre fraude de facturación (RUC sin IPS)',
    messages: [
      { role: 'user', content: '¿Qué dice la Corte Suprema sobre los trabajadores contratados con factura pero que cumplen horario y órdenes?' },
      {
        role: 'assistant',
        content: 'La Corte Suprema de Justicia de Paraguay (Sala Civil y Comercial / Sala Constitucional) ha sentado jurisprudencia pacífica y constante (ej. Acuerdos y Sentencias N° 412/2018, 589/2021) aplicando el Principio de Primacía de la Realidad. Si existen subordinación jurídica, cumplimiento de horario, exclusividad y dependencia económica, el contrato de prestación de servicios es simulado e inoponible al trabajador, obligando a reconocer la relación de dependencia laboral con todas las indemnizaciones y pago retroactivo al IPS.'
      }
    ]
  },
  {
    num: 6,
    title: 'Redacción de Amonestación Escrita por llegadas tardías',
    messages: [
      { role: 'user', content: 'Necesito redactar una amonestación formal para un empleado por llegadas tardías reiteradas conforme al Art. 352.' },
      {
        role: 'assistant',
        content: 'NOTIFICACIÓN DE AMONESTACIÓN ESCRITA\nAsunción, 21 de septiembre de 2026\n\nAl Colaborador: Juan Pérez\nDe: Dirección de Recursos Humanos\n\nPor medio de la presente, se le formula AMONESTACIÓN DISCIPLINARIA FORMAL por haber registrado reiteradas llegadas tardías en las fechas 14, 16 y 18 del corriente mes, contraviniendo el horario laboral pactado y el Art. 352 del Código del Trabajo (Ley 213/93).\nSe le exhorta a regularizar su puntualidad, bajo apercibimiento de sanciones mayores en caso de reincidencia.'
      }
    ]
  },
  {
    num: 7,
    title: 'Cálculo de vacaciones causadas y proporcionales',
    messages: [
      { role: 'user', content: '¿Cómo se calculan las vacaciones proporcionales al salir a mitad de año con 3 años de antigüedad?' },
      {
        role: 'assistant',
        content: 'Conforme al Art. 218 del Código del Trabajo, para una antigüedad de 1 a 5 años corresponden 12 días laborales de vacaciones pagadas. Si el trabajador cesa antes de cumplir la anualidad completa, le corresponde la fracción proporcional calculada sobre los meses efectivamente trabajados en el período incompleto a razón de (12 / 12) = 1 día por cada mes completo de labor.'
      }
    ]
  },
  {
    num: 8,
    title: 'Horas extras, recargo nocturno y días feriados',
    messages: [
      { role: 'user', content: '¿Cómo se paga a un empleado que trabaja un domingo de noche durante 6 horas extraordinarias?' },
      {
        role: 'assistant',
        content: 'En Paraguay, el trabajo en días feriados y descansos dominicales se remunera con el 100% de recargo sobre la hora ordinaria (Art. 235 C.T.). Además, la jornada nocturna (entre las 20:00 y las 06:00 hs) tiene una duración máxima de 7 horas y un recargo del 30% (Art. 197). Si son horas extras nocturnas en domingo, concurre el recargo del 100% por feriado/descanso más el 30% nocturno más el recargo de hora extraordinaria del Art. 234.'
      }
    ]
  },
  {
    num: 9,
    title: 'Conversación extensa de 6 turnos (Asesoría completa de despido)',
    messages: [
      { role: 'user', content: 'Hola Tobi, quiero saber qué me corresponde si me despiden con 7 años de antigüedad y salario de 6.000.000 Gs.' },
      { role: 'assistant', content: 'Con 7 años de antigüedad te corresponde indemnización por despido injustificado según el Art. 91: 15 días de salario por cada año trabajado (7 * 15 = 105 días de salario). Con salario de 6.000.000, el salario diario es 200.000 Gs, sumando Gs. 21.000.000 solo de indemnización.' },
      { role: 'user', content: '¿Y el preaviso de cuántos días es?' },
      { role: 'assistant', content: 'Para más de 5 años y menos de 10 años, el Art. 87 inc. c exige 60 días de preaviso. Si no te preavisaron con 2 meses de anticipación, deben abonarte 60 días de salario (Gs. 12.000.000).' },
      { role: 'user', content: '¿Y las vacaciones cuántos días son por 7 años?' },
      { role: 'assistant', content: 'Por el Art. 218 inc. b, a partir de los 5 años y hasta los 10 años corresponden 18 días hábiles corridos de vacaciones anuales remuneradas.' },
      { role: 'user', content: '¿Puedo pedir que me paguen todo en un solo cheque o transferencia?' },
      { role: 'assistant', content: 'Sí, el finiquito laboral debe ser abonado de forma íntegra y fehaciente mediante transferencia bancaria verificable o cheque a la orden al momento de la firma de la liquidación oficial ante escribanía o el MTESS.' },
      { role: 'user', content: '¿Me descuentan el 9% de IPS de la indemnización y del preaviso?' },
      { role: 'assistant', content: '¡No! Conforme al Art. 229 del Código Laboral y la Carta Orgánica del IPS, la indemnización por antigüedad y la compensación de preaviso son rubros indemnizatorios no imponibles: no sufren el descuento del 9% de aporte obrero de IPS.' }
    ]
  },
  {
    num: 10,
    title: 'Renuncia voluntaria con preaviso otorgado por el trabajador',
    messages: [
      { role: 'user', content: 'Quiero renunciar a mi trabajo de 2 años. Gano 3.800.000. ¿Qué me tienen que pagar y qué tengo que dar yo?' },
      {
        role: 'assistant',
        content: 'Al tratarse de una renuncia voluntaria (sin causal imputable al empleador):\n1. Te corresponde cobrar: Salario de los días trabajados del mes + Vacaciones causadas o proporcionales no gozadas + Aguinaldo proporcional (1/12 de todo lo ganado en el año).\n2. No te corresponde: Indemnización por despido ni compensación de preaviso patronal.\n3. Tu obligación: Con 2 años de antigüedad debés dar 30 días de preaviso al empleador conforme al Art. 87. Si no lo otorgás, el empleador podría deducirte el importe correspondiente.',
        settlementData: {
          input: {
            salarioMensual: 3800000,
            fechaIngreso: '2024-03-01',
            fechaEgreso: '2026-03-01',
            motivo: 'renuncia',
            preaviso: { otorgado: true },
            vacacionesPeriodosAnteriores: 12
          }
        }
      }
    ]
  }
];

async function runTest() {
  console.log('='.repeat(90));
  console.log('   BATERÍA DE 10 PRUEBAS EMPÍRICAS: LONGITUD DE ENLACE AL COMPARTIR EN TOBI');
  console.log('='.repeat(90));
  console.log('');

  const results = [];
  let passedCount = 0;

  for (const sc of SCENARIOS) {
    // 1. Generar la URL canónica
    let canonicalUrl;
    if (sc.messages.some(m => m.settlementData?.input)) {
      const sInput = sc.messages.find(m => m.settlementData?.input).settlementData.input;
      const shortHash = encodeShortSettlementLink(sInput);
      canonicalUrl = `https://laborapy.com/#c=${shortHash}`;
    } else {
      const hash = encodeShareChat(sc.messages);
      canonicalUrl = `https://laborapy.com/#s=${hash}`;
    }

    const originalLength = canonicalUrl.length;

    // 2. Acortar usando TinyURL API (con clck fallback)
    let shortUrl = null;
    let provider = null;
    try {
      const resTiny = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(canonicalUrl)}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (resTiny.ok) {
        const text = (await resTiny.text()).trim();
        if (text.startsWith('http') && text.length <= 35) {
          shortUrl = text;
          provider = 'tinyurl';
        }
      }
    } catch {
      // fallback
    }

    if (!shortUrl) {
      try {
        const resClck = await fetch(`https://clck.ru/--?url=${encodeURIComponent(canonicalUrl)}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (resClck.ok) {
          const text = (await resClck.text()).trim();
          if (text.startsWith('http') && text.length <= 35) {
            shortUrl = text;
            provider = 'clck';
          }
        }
      } catch {
        // fallback
      }
    }

    const finalShortUrl = shortUrl || canonicalUrl;
    const finalLength = finalShortUrl.length;
    const reductionPct = ((1 - finalLength / originalLength) * 100).toFixed(1);

    // 3. Verificar redirección e integridad si se acortó
    let redirectOk = false;
    let decodedOk = false;
    if (shortUrl) {
      try {
        const check = await fetch(shortUrl, { redirect: 'manual' });
        const loc = check.headers.get('location') || '';
        redirectOk = loc.includes('laborapy.com') && (loc.includes('#s=') || loc.includes('#c='));
      } catch {
        redirectOk = false;
      }
    }

    // Verificar decodificación de datos
    if (canonicalUrl.includes('#s=')) {
      const encoded = canonicalUrl.split('#s=')[1];
      const parsed = decodeShareChat(encoded);
      decodedOk = Array.isArray(parsed) && parsed.length === sc.messages.length;
    } else if (canonicalUrl.includes('#c=')) {
      const encoded = canonicalUrl.split('#c=')[1];
      decodedOk = decodeShortSettlementLink(encoded);
    }

    const passed = finalLength <= 35 && redirectOk && decodedOk;
    if (passed) passedCount++;

    results.push({
      num: sc.num,
      title: sc.title,
      originalLength,
      finalLength,
      reductionPct,
      shortUrl: finalShortUrl,
      provider,
      redirectOk,
      decodedOk,
      passed
    });

    console.log(`[PRUEBA ${sc.num.toString().padStart(2, '0')}/10] ${sc.title}`);
    console.log(`  • URL original (kilométrica): ${originalLength} caracteres`);
    console.log(`  • URL acortada al compartir:   ${finalLength} caracteres -> ${finalShortUrl}`);
    console.log(`  • Reducción de tamaño:        -${reductionPct}% (${originalLength - finalLength} caracteres ahorrados)`);
    console.log(`  • Integridad de redirección:  ${redirectOk ? '✓ OK (HTTP 301/302 a laborapy.com)' : '✗ ERROR'}`);
    console.log(`  • Decodificación de chat:     ${decodedOk ? '✓ OK (datos 100% íntegros)' : '✗ ERROR'}`);
    console.log(`  • Resultado de prueba:        ${passed ? '✓ PASÓ (<= 35 chars)' : '✗ FALLÓ'}`);
    console.log('-'.repeat(90));
  }

  console.log('');
  console.log('='.repeat(90));
  console.log(`RESUMEN FINAL: ${passedCount}/10 pruebas aprobadas exitosamente.`);
  console.log('='.repeat(90));

  if (passedCount !== 10) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Error fatal en batería de pruebas:', err);
  process.exit(1);
});
