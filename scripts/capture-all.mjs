import puppeteer from 'puppeteer-core';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const session = {
  token: 'demo_token_123',
  expiresAt: Date.now() + 8 * 3600 * 1000,
  clienteId: 'emp_guarani_001',
  usuario: {
    id: 'usr_guarani_admin',
    clienteId: 'emp_guarani_001',
    email: 'cliente@laborapy.com',
    nombreContacto: 'Lic. Rodrigo Solís',
    cargoContacto: 'Gerente Administrativo & Finanzas',
    telefono: '(0981) 777-888',
    rol: 'cliente_admin',
    activo: true
  },
  empresa: {
    id: 'emp_guarani_001',
    razonSocial: 'Corporación Guaraní S.A.',
    nombreFantasia: 'Guaraní Corp',
    ruc: '80012345',
    dv: '6',
    nroPatronalIps: 'IPS-119922-PY',
    nroPatronalMtess: 'MTESS-2024-8833',
    representanteLegalNombre: 'Lic. Rodrigo Solís',
    representanteLegalCi: '2.345.678',
    activo: true,
    createdAt: '2025-01-01T08:00:00Z'
  },
  empresasDisponibles: [
    {
      id: 'emp_guarani_001',
      razonSocial: 'Corporación Guaraní S.A.',
      nombreFantasia: 'Guaraní Corp',
      ruc: '80012345',
      dv: '6',
      nroPatronalIps: 'IPS-119922-PY',
      nroPatronalMtess: 'MTESS-2024-8833',
      representanteLegalNombre: 'Lic. Rodrigo Solís',
      representanteLegalCi: '2.345.678',
      activo: true,
      createdAt: '2025-01-01T08:00:00Z'
    }
  ]
};

(async () => {
  console.log('Iniciando captura de vistas completas...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Abrir página base y configurar sesión
  await page.goto('https://calculadora-rrhh-py.vercel.app/', { waitUntil: 'networkidle0' });
  await page.evaluate((s) => {
    localStorage.setItem('laborapy_client_session', JSON.stringify(s));
  }, session);

  // 2. Abrir ERP Dashboard
  console.log('Capturando ERP Dashboard...');
  await page.goto('https://calculadora-rrhh-py.vercel.app/?portal=1', { waitUntil: 'networkidle0' });
  await sleep(2000);
  await page.screenshot({ path: 'erp_dashboard.png' });

  // 3. Click en pestaña Presentismo & Asistencia
  console.log('Capturando Módulo de Presentismo (Asistencia)...');
  const tabs = await page.$$('.erp-tab-btn');
  for (const tab of tabs) {
    const text = await (await tab.getProperty('innerText')).jsonValue();
    if (text.includes('Asistencia') || text.includes('Horas')) {
      await tab.click();
      break;
    }
  }
  await sleep(1500);
  await page.screenshot({ path: 'erp_presentismo_he.png' });

  // 4. Click en subpestaña Presentismo & Novedades
  console.log('Capturando Presentismo & Novedades...');
  const subtabs = await page.$$('button');
  for (const b of subtabs) {
    const text = await (await b.getProperty('innerText')).jsonValue();
    if (text.includes('Presentismo & Novedades')) {
      await b.click();
      break;
    }
  }
  await sleep(1200);
  await page.screenshot({ path: 'erp_presentismo_novedades.png' });

  // 5. Click en subpestaña Marcaciones Biométricas
  console.log('Capturando Marcaciones Biométricas...');
  const buttonsAfter = await page.$$('button');
  for (const b of buttonsAfter) {
    const text = await (await b.getProperty('innerText')).jsonValue();
    if (text.includes('Marcaciones Biométricas')) {
      await b.click();
      break;
    }
  }
  await sleep(1200);
  await page.screenshot({ path: 'erp_presentismo_biometria.png' });

  // 6. Volver a Dashboard y capturar Fichas de Empleados
  console.log('Capturando Fichas de Empleados...');
  const tabsAgain = await page.$$('.erp-tab-btn');
  for (const tab of tabsAgain) {
    const text = await (await tab.getProperty('innerText')).jsonValue();
    if (text.includes('Empleados') || text.includes('Nómina Activa')) {
      await tab.click();
      break;
    }
  }
  await sleep(1200);
  await page.screenshot({ path: 'erp_empleados.png' });

  await browser.close();
  console.log('Todas las capturas completadas exitosamente.');
})();
