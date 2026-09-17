import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSupabaseConfigured, saveLeadsBatchToSupabase } from '../../../lib/supabase';
import { recordLead, clearStoredLeads, getStoredLeads } from '../services/leadService';

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

describe('Supabase Leads Integration', () => {
  beforeEach(() => {
    const mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
    clearStoredLeads();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('debe detectar si Supabase está configurado', () => {
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('debe guardar lead localmente y retornar objeto lead válido incluso si Supabase falla', async () => {
    const lead = recordLead({
      email: 'test.supabase@empresa.com.py',
      tipoUsuario: 'empresa',
      empresaNombre: 'Corporativo Test',
      calculoEstimado: 12000000,
    });

    expect(lead.id).toBeDefined();
    expect(lead.email).toBe('test.supabase@empresa.com.py');
    const stored = getStoredLeads();
    expect(stored.length).toBe(1);
    expect(stored[0].email).toBe('test.supabase@empresa.com.py');
  });

  it('debe manejar sincronización por lotes sin lanzar excepciones', async () => {
    const res = await saveLeadsBatchToSupabase([]);
    expect(res.success).toBe(false);
    expect(res.count).toBe(0);
  });
});

