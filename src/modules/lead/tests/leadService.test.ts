import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  recordLead,
  getStoredLeads,
  getLastLeadInfo,
  exportLeadsToJSON,
  exportLeadsToCSV,
  getUnsyncedLeads,
  markLeadsAsSynced,
  markAllLeadsAsSynced,
  syncLeadsToCommercial,
  getLeadMetrics,
  filterLeads,
  importLeads,
  deleteLead,
  clearStoredLeads,
  setCRMWebhookUrl,
  getCRMWebhookUrl,
  type LeadData,
} from '../services/leadService';

// Mock de localStorage para el entorno de test
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
};

describe('leadService - Funnel y Captura Completa de Leads', () => {
  beforeEach(() => {
    const mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('debe registrar un lead B2B de empresa con captura completa de datos', () => {
    const lead = recordLead({
      nombre: 'Ing. Carlos Benítez',
      email: 'rrhh@corporacion.com.py',
      telefono: '+595981123456',
      tipoUsuario: 'empresa',
      empresaNombre: 'Corporación Guaraní S.A.',
      motivoConsulta: 'Despido injustificado y cálculo de indemnización',
      calculoEstimado: 15800000,
      documento: 'Finiquito de Liquidación Laboral',
      formato: 'pdf',
    });

    // Verificación de datos del lead retornado
    expect(lead.id).toBeDefined();
    expect(lead.nombre).toBe('Ing. Carlos Benítez');
    expect(lead.email).toBe('rrhh@corporacion.com.py');
    expect(lead.telefono).toBe('+595981123456');
    expect(lead.telefonoWhatsApp).toBe('+595981123456');
    expect(lead.tipoUsuario).toBe('empresa');
    expect(lead.empresaNombre).toBe('Corporación Guaraní S.A.');
    expect(lead.motivoConsulta).toBe('Despido injustificado y cálculo de indemnización');
    expect(lead.calculoEstimado).toBe(15800000);
    expect(lead.montoNeto).toBe(15800000);
    expect(lead.formato).toBe('pdf');
    expect(lead.sincronizado).toBe(false);
    expect(lead.timestamp).toBeDefined();
    expect(lead.origen).toBe('Calculadora Laboral Paraguay (Web)');

    // Verificación de almacenamiento persistente
    const stored = getStoredLeads();
    expect(stored).toHaveLength(1);
    expect(stored[0].nombre).toBe('Ing. Carlos Benítez');
    expect(stored[0].email).toBe('rrhh@corporacion.com.py');
    expect(stored[0].calculoEstimado).toBe(15800000);

    // Verificación de prellenado para agilizar futuras consultas
    const lastInfo = getLastLeadInfo();
    expect(lastInfo.email).toBe('rrhh@corporacion.com.py');
    expect(lastInfo.empresa).toBe('Corporación Guaraní S.A.');
    expect(lastInfo.nombre).toBe('Ing. Carlos Benítez');
    expect(lastInfo.telefono).toBe('+595981123456');
    expect(lastInfo.tipoUsuario).toBe('empresa');
  });

  it('debe registrar un lead B2C de trabajador particular y soportar retrocompatibilidad con alias', () => {
    const lead = recordLead({
      nombre: 'María Ramos',
      email: 'maria.ramos@gmail.com',
      telefonoWhatsApp: '0971987654',
      tipoUsuario: 'particular',
      motivoConsulta: 'Renuncia voluntaria y cobro de aguinaldo',
      montoNeto: 4200000,
      documento: 'Carta de Renuncia',
      formato: 'docx',
    });

    expect(lead.nombre).toBe('María Ramos');
    expect(lead.email).toBe('maria.ramos@gmail.com');
    // Verificación de alias recíprocos
    expect(lead.telefono).toBe('0971987654');
    expect(lead.telefonoWhatsApp).toBe('0971987654');
    expect(lead.calculoEstimado).toBe(4200000);
    expect(lead.montoNeto).toBe(4200000);
    expect(lead.tipoUsuario).toBe('particular');
    expect(lead.empresaNombre).toBeUndefined();

    const stored = getStoredLeads();
    expect(stored).toHaveLength(1);
    expect(stored[0].email).toBe('maria.ramos@gmail.com');
  });

  it('debe acumular múltiples leads con IDs únicos en el historial', () => {
    recordLead({
      email: 'lead1@empresa.com',
      tipoUsuario: 'empresa',
      documento: 'Finiquito PDF',
      formato: 'pdf',
    });

    recordLead({
      email: 'lead2@gmail.com',
      tipoUsuario: 'particular',
      documento: 'Certificado Laboral',
      formato: 'pdf',
    });

    const stored = getStoredLeads();
    expect(stored).toHaveLength(2);
    expect(stored[0].id).not.toBe(stored[1].id);
    expect(stored[0].email).toBe('lead1@empresa.com');
    expect(stored[1].email).toBe('lead2@gmail.com');
  });
});

describe('leadService - Exportación en formato JSON y CSV', () => {
  beforeEach(() => {
    const mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });

    // Cargar 2 leads de prueba
    recordLead({
      nombre: 'Pedro Romero',
      email: 'pedro@consultoria.com.py',
      telefono: '0981 111 222',
      tipoUsuario: 'empresa',
      empresaNombre: 'Consultora & Asociados, S.A.',
      motivoConsulta: 'Liquidación por despido injustificado (con "comillas")',
      calculoEstimado: 25000000,
      documento: 'Finiquito Oficial',
      formato: 'pdf',
    });

    recordLead({
      nombre: 'Lucía Giménez',
      email: 'lucia.gimenez@hotmail.com',
      telefono: '0985 333 444',
      tipoUsuario: 'particular',
      motivoConsulta: 'Cálculo de vacaciones no gozadas',
      calculoEstimado: 3200000,
      documento: 'Finiquito de Vacaciones',
      formato: 'docx',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('debe exportar los leads a JSON válido con todos los campos requeridos', () => {
    const jsonStr = exportLeadsToJSON();
    expect(typeof jsonStr).toBe('string');

    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].nombre).toBe('Pedro Romero');
    expect(parsed[0].email).toBe('pedro@consultoria.com.py');
    expect(parsed[0].empresaNombre).toBe('Consultora & Asociados, S.A.');
    expect(parsed[0].calculoEstimado).toBe(25000000);
    expect(parsed[0].tipoUsuario).toBe('empresa');

    expect(parsed[1].nombre).toBe('Lucía Giménez');
    expect(parsed[1].tipoUsuario).toBe('particular');
    expect(parsed[1].calculoEstimado).toBe(3200000);
  });

  it('debe exportar los leads a CSV con UTF-8 BOM, encabezados en español y correcto escape RFC 4180', () => {
    const csvStr = exportLeadsToCSV();

    // Verificación de UTF-8 BOM (\uFEFF) para compatibilidad con Excel
    expect(csvStr.charCodeAt(0)).toBe(0xfeff);

    // Verificación de encabezados esperados
    expect(csvStr).toContain('"ID"');
    expect(csvStr).toContain('"Nombre y Apellido"');
    expect(csvStr).toContain('"Correo Electrónico"');
    expect(csvStr).toContain('"Teléfono / WhatsApp"');
    expect(csvStr).toContain('"Tipo de Usuario"');
    expect(csvStr).toContain('"Empresa / Organización"');
    expect(csvStr).toContain('"Motivo de Consulta"');
    expect(csvStr).toContain('"Cálculo Estimado (Gs.)"');

    // Verificación de los datos y su escape (comas dentro del nombre de empresa y comillas)
    expect(csvStr).toContain('"Consultora & Asociados, S.A."');
    expect(csvStr).toContain('Liquidación por despido injustificado (con ""comillas"")');
    expect(csvStr).toContain('"Empresa (B2B)"');
    expect(csvStr).toContain('"Particular (B2C)"');
    expect(csvStr).toContain('"25000000"');
    expect(csvStr).toContain('"3200000"');
  });
});

describe('leadService - Sincronización CRM y Gestión Comercial', () => {
  beforeEach(() => {
    const mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('debe gestionar leads no sincronizados y marcar como sincronizados', () => {
    const lead1 = recordLead({
      email: 'lead1@sync.com',
      tipoUsuario: 'empresa',
    });
    const lead2 = recordLead({
      email: 'lead2@sync.com',
      tipoUsuario: 'particular',
    });

    // Inicialmente ambos están no sincronizados
    let unsynced = getUnsyncedLeads();
    expect(unsynced).toHaveLength(2);

    // Sincronizar solo el primero
    const markedCount = markLeadsAsSynced([lead1.id]);
    expect(markedCount).toBe(1);

    unsynced = getUnsyncedLeads();
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].id).toBe(lead2.id);

    // Marcar todos como sincronizados
    const allMarked = markAllLeadsAsSynced();
    expect(allMarked).toBe(1);
    expect(getUnsyncedLeads()).toHaveLength(0);
  });

  it('debe ejecutar syncLeadsToCommercial con éxito contra webhook simulado', async () => {
    recordLead({
      nombre: 'Elena Duarte',
      email: 'elena@empresa.com.py',
      tipoUsuario: 'empresa',
      calculoEstimado: 8500000,
    });

    setCRMWebhookUrl('https://api.crm-laborapy.test/webhook');
    expect(getCRMWebhookUrl()).toBe('https://api.crm-laborapy.test/webhook');

    // Mock exitoso de fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('{"success": true}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await syncLeadsToCommercial();
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verificar que los leads ahora figuran sincronizados
    expect(getUnsyncedLeads()).toHaveLength(0);
  });

  it('debe manejar error de conexión en syncLeadsToCommercial sin perder datos', async () => {
    recordLead({
      email: 'error@empresa.com.py',
      tipoUsuario: 'empresa',
    });

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await syncLeadsToCommercial({ endpointUrl: 'https://webhook.fail.test/lead' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network offline');

    // El lead debe permanecer pendiente de sincronización
    expect(getUnsyncedLeads()).toHaveLength(1);
  });

  it('debe retornar éxito inmediato si no hay leads pendientes que sincronizar', async () => {
    const result = await syncLeadsToCommercial({ endpointUrl: 'https://api.crm.test' });
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
  });
});

describe('leadService - Métricas, Filtros y Utilidades', () => {
  beforeEach(() => {
    const mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });

    recordLead({
      nombre: 'Ana Rojas',
      email: 'ana@tech.com.py',
      telefono: '0981999888',
      tipoUsuario: 'empresa',
      empresaNombre: 'Tech Guaraní',
      motivoConsulta: 'Asesoría Despido',
      calculoEstimado: 10000000,
    });

    recordLead({
      nombre: 'Marcos Franco',
      email: 'marcos@gmail.com',
      tipoUsuario: 'particular',
      motivoConsulta: 'Renuncia',
      calculoEstimado: 5000000,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('debe calcular métricas comerciales correctas', () => {
    const metrics = getLeadMetrics();
    expect(metrics.totalLeads).toBe(2);
    expect(metrics.b2bCount).toBe(1);
    expect(metrics.b2cCount).toBe(1);
    expect(metrics.totalEstimadoGs).toBe(15000000);
    expect(metrics.promedioEstimadoGs).toBe(7500000);
    expect(metrics.withPhoneCount).toBe(1);
    expect(metrics.unsyncedCount).toBe(2);
    expect(metrics.syncedCount).toBe(0);
  });

  it('debe filtrar leads por segmento, estado y texto de búsqueda', () => {
    // Filtro por tipo B2B
    const b2bOnly = filterLeads({ tipoUsuario: 'empresa' });
    expect(b2bOnly).toHaveLength(1);
    expect(b2bOnly[0].nombre).toBe('Ana Rojas');

    // Filtro por término libre
    const searchResult = filterLeads({ query: 'tech' });
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].empresaNombre).toBe('Tech Guaraní');

    // Filtro por motivo
    const searchMotivo = filterLeads({ query: 'Renuncia' });
    expect(searchMotivo).toHaveLength(1);
    expect(searchMotivo[0].nombre).toBe('Marcos Franco');
  });

  it('debe permitir eliminar un lead y limpiar el almacenamiento', () => {
    const leads = getStoredLeads();
    const leadIdToDelete = leads[0].id;

    const deleted = deleteLead(leadIdToDelete);
    expect(deleted).toBe(true);
    expect(getStoredLeads()).toHaveLength(1);

    clearStoredLeads();
    expect(getStoredLeads()).toHaveLength(0);
  });

  it('debe importar leads evitando duplicados por ID', () => {
    const existing = getStoredLeads();
    const incoming: LeadData[] = [
      existing[0], // Duplicado
      {
        id: 'external_lead_999',
        email: 'nuevo@externo.com',
        tipoUsuario: 'particular',
        timestamp: new Date().toISOString(),
        origen: 'Importación Comercial',
      },
    ];

    const { imported, duplicates } = importLeads(incoming);
    expect(imported).toBe(1);
    expect(duplicates).toBe(1);
    expect(getStoredLeads()).toHaveLength(3);
  });
});
