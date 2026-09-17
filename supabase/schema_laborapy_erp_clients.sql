-- ==============================================================================
-- LABORAPY ERP - ESQUEMA MULTI-TENANT Y PROTECCIÓN RLS (SUPABASE POSTGRES)
-- Portal de Acceso a Clientes: Nómina, Contratos, IPS, MTESS y Ficha de Empleados
-- Normativa: Ley N.º 213/93, Decreto-Ley N.º 1860/50 y Resoluciones MTESS/REOP
-- ==============================================================================

-- 1. Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Empresas Clientes (Tenants)
CREATE TABLE IF NOT EXISTS public.empresas_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ruc TEXT NOT NULL UNIQUE CHECK (char_length(ruc) <= 20),
    dv TEXT NOT NULL CHECK (char_length(dv) <= 2),
    razon_social TEXT NOT NULL CHECK (char_length(razon_social) <= 200),
    nombre_fantasia TEXT CHECK (nombre_fantasia IS NULL OR char_length(nombre_fantasia) <= 150),
    actividad_economica TEXT CHECK (actividad_economica IS NULL OR char_length(actividad_economica) <= 200),
    direccion TEXT CHECK (direccion IS NULL OR char_length(direccion) <= 250),
    telefono TEXT CHECK (telefono IS NULL OR char_length(telefono) <= 50),
    email_corporativo TEXT CHECK (email_corporativo IS NULL OR char_length(email_corporativo) <= 150),
    nro_patronal_ips TEXT CHECK (nro_patronal_ips IS NULL OR char_length(nro_patronal_ips) <= 50),
    nro_patronal_mtess TEXT CHECK (nro_patronal_mtess IS NULL OR char_length(nro_patronal_mtess) <= 50),
    representante_legal_nombre TEXT CHECK (representante_legal_nombre IS NULL OR char_length(representante_legal_nombre) <= 150),
    representante_legal_ci TEXT CHECK (representante_legal_ci IS NULL OR char_length(representante_legal_ci) <= 30),
    logo_url TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- 3. Tabla de Usuarios de Clientes (Vinculación con auth.users o credenciales gestionadas)
CREATE TABLE IF NOT EXISTS public.cliente_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash TEXT NOT NULL,
    nombre_contacto TEXT NOT NULL CHECK (char_length(nombre_contacto) <= 150),
    cargo_contacto TEXT CHECK (cargo_contacto IS NULL OR char_length(cargo_contacto) <= 100),
    telefono TEXT CHECK (telefono IS NULL OR char_length(telefono) <= 50),
    rol TEXT DEFAULT 'cliente_admin' CHECK (rol IN ('cliente_admin', 'cliente_operador', 'cliente_auditor')),
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    ultimo_acceso TIMESTAMPTZ
);

-- 4. Tabla de Empleados (Ficha Electrónica / Legajo Digital)
CREATE TABLE IF NOT EXISTS public.empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
    ci TEXT NOT NULL CHECK (char_length(ci) <= 30),
    nombres TEXT NOT NULL CHECK (char_length(nombres) <= 100),
    apellidos TEXT NOT NULL CHECK (char_length(apellidos) <= 100),
    fecha_nacimiento DATE,
    nacionalidad TEXT DEFAULT 'Paraguaya' CHECK (char_length(nacionalidad) <= 50),
    estado_civil TEXT DEFAULT 'Soltero/a' CHECK (estado_civil IN ('Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión de Hecho')),
    sexo TEXT DEFAULT 'M' CHECK (sexo IN ('M', 'F', 'Otro')),
    domicilio TEXT CHECK (domicilio IS NULL OR char_length(domicilio) <= 250),
    telefono TEXT CHECK (telefono IS NULL OR char_length(telefono) <= 50),
    email TEXT CHECK (email IS NULL OR char_length(email) <= 150),
    hijos_menores INTEGER DEFAULT 0 CHECK (hijos_menores >= 0 AND hijos_menores <= 20),
    cargo TEXT NOT NULL CHECK (char_length(cargo) <= 120),
    departamento TEXT DEFAULT 'Operaciones' CHECK (char_length(departamento) <= 100),
    fecha_ingreso DATE NOT NULL,
    fecha_egreso DATE,
    salario_base NUMERIC(14,2) NOT NULL CHECK (salario_base >= 0),
    modalidad_pago TEXT DEFAULT 'mensual' CHECK (modalidad_pago IN ('mensual', 'jornalero', 'destajo', 'comisionista')),
    nro_ips TEXT CHECK (nro_ips IS NULL OR char_length(nro_ips) <= 50),
    estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'prueba', 'suspendido', 'vacaciones', 'inactivo')),
    periodo_prueba_dias INTEGER DEFAULT 30 CHECK (periodo_prueba_dias IN (30, 60, 90)),
    vacaciones_causadas_acumuladas INTEGER DEFAULT 0 CHECK (vacaciones_causadas_acumuladas >= 0),
    vacaciones_tomadas INTEGER DEFAULT 0 CHECK (vacaciones_tomadas >= 0),
    notas TEXT CHECK (notas IS NULL OR char_length(notas) <= 1000),
    CONSTRAINT uk_empleado_ci_por_empresa UNIQUE (cliente_id, ci)
);

-- 5. Tabla de Contratos Laborales (Ley N.º 213/93)
CREATE TABLE IF NOT EXISTS public.contratos_trabajo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
    tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('indefinido', 'plazo_fijo', 'tiempo_parcial', 'aprendizaje', 'obra')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    periodo_prueba_dias INTEGER DEFAULT 30,
    salario_pactado NUMERIC(14,2) NOT NULL,
    jornada_laboral TEXT DEFAULT '48 horas semanales (Lunes a Sábado)' CHECK (char_length(jornada_laboral) <= 200),
    horario_inicio TIME DEFAULT '08:00',
    horario_fin TIME DEFAULT '17:00',
    lugar_prestacion TEXT DEFAULT 'Asunción, Paraguay',
    clausulas_adicionales TEXT,
    estado TEXT DEFAULT 'firmado' CHECK (estado IN ('borrador', 'firmado', 'vencido', 'rescindido')),
    archivo_pdf_url TEXT
);

-- 6. Tabla de Períodos de Nómina
CREATE TABLE IF NOT EXISTS public.nominas_periodos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    anho INTEGER NOT NULL CHECK (anho >= 2020 AND anho <= 2050),
    total_salarios_brutos NUMERIC(15,2) DEFAULT 0,
    total_ips_obrero_9 NUMERIC(15,2) DEFAULT 0,
    total_ips_patronal_16_5 NUMERIC(15,2) DEFAULT 0,
    total_ips_25_5 NUMERIC(15,2) DEFAULT 0,
    total_neto_pagar NUMERIC(15,2) DEFAULT 0,
    estado TEXT DEFAULT 'cerrado' CHECK (estado IN ('abierto', 'cerrado', 'pagado')),
    fecha_pago DATE,
    CONSTRAINT uk_periodo_por_empresa UNIQUE (cliente_id, mes, anho)
);

-- 7. Tabla de Recibos de Salario Oficiales (Art. 235 y 236 Código Laboral)
CREATE TABLE IF NOT EXISTS public.recibos_salario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
    empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
    periodo_id UUID REFERENCES public.nominas_periodos(id) ON DELETE SET NULL,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    anho INTEGER NOT NULL CHECK (anho >= 2020 AND anho <= 2050),
    dias_trabajados INTEGER DEFAULT 30 CHECK (dias_trabajados >= 0 AND dias_trabajados <= 30),
    salario_base NUMERIC(14,2) NOT NULL,
    salario_devengado NUMERIC(14,2) NOT NULL,
    horas_extras_50_cant NUMERIC(6,2) DEFAULT 0,
    horas_extras_50_monto NUMERIC(14,2) DEFAULT 0,
    horas_extras_100_cant NUMERIC(6,2) DEFAULT 0,
    horas_extras_100_monto NUMERIC(14,2) DEFAULT 0,
    comisiones_premios NUMERIC(14,2) DEFAULT 0,
    bonificacion_familiar NUMERIC(14,2) DEFAULT 0,
    total_ingresos_brutos NUMERIC(14,2) NOT NULL,
    ips_obrero_9 NUMERIC(14,2) NOT NULL,
    anticipos_quincena NUMERIC(14,2) DEFAULT 0,
    judiciales_alimentos NUMERIC(14,2) DEFAULT 0,
    otros_descuentos NUMERIC(14,2) DEFAULT 0,
    total_deducciones NUMERIC(14,2) NOT NULL,
    salario_neto NUMERIC(14,2) NOT NULL,
    salario_neto_letras TEXT NOT NULL,
    qr_verificacion TEXT,
    fecha_emision DATE DEFAULT CURRENT_DATE
);

-- 8. Tabla de Documentos y Comprobantes de Cumplimiento (MTESS y Extractos IPS)
CREATE TABLE IF NOT EXISTS public.documentos_cumplimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.empresas_clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'extracto_ips', 
        'factura_pago_ips', 
        'comprobante_reop_mensual', 
        'comprobante_libro_anual_mtess', 
        'libro_sueldos_jornales_pdf', 
        'libro_empleados_obreros_pdf', 
        'rgpo_mtess_pdf'
    )),
    periodo TEXT NOT NULL, -- ej: '2026-08' o '2025'
    titulo TEXT NOT NULL CHECK (char_length(titulo) <= 200),
    archivo_nombre TEXT NOT NULL CHECK (char_length(archivo_nombre) <= 250),
    archivo_url TEXT,
    nro_transaccion_oficial TEXT CHECK (char_length(nro_transaccion_oficial) <= 100),
    fecha_presentacion DATE,
    monto_abonado NUMERIC(15,2) DEFAULT 0,
    notas TEXT CHECK (notas IS NULL OR char_length(notas) <= 500)
);

-- ==============================================================================
-- 9. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) MANDATORIO
-- ==============================================================================
ALTER TABLE public.empresas_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominas_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_salario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_cumplimiento ENABLE ROW LEVEL SECURITY;

-- 10. Helper function de resolución de tenant actual
CREATE OR REPLACE FUNCTION public.get_auth_cliente_id() 
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT cliente_id 
  FROM public.cliente_usuarios 
  WHERE email = auth.jwt() ->> 'email' AND activo = true
  LIMIT 1;
$$;

-- 11. Políticas de Aislamiento Estricto por Tenant
DROP POLICY IF EXISTS "Aislamiento tenant en empleados" ON public.empleados;
CREATE POLICY "Aislamiento tenant en empleados"
ON public.empleados
FOR ALL
TO authenticated
USING (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin')
WITH CHECK (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS "Aislamiento tenant en contratos" ON public.contratos_trabajo;
CREATE POLICY "Aislamiento tenant en contratos"
ON public.contratos_trabajo
FOR ALL
TO authenticated
USING (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin')
WITH CHECK (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS "Aislamiento tenant en nominas" ON public.nominas_periodos;
CREATE POLICY "Aislamiento tenant en nominas"
ON public.nominas_periodos
FOR ALL
TO authenticated
USING (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin')
WITH CHECK (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS "Aislamiento tenant en recibos" ON public.recibos_salario;
CREATE POLICY "Aislamiento tenant en recibos"
ON public.recibos_salario
FOR ALL
TO authenticated
USING (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin')
WITH CHECK (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS "Aislamiento tenant en documentos" ON public.documentos_cumplimiento;
CREATE POLICY "Aislamiento tenant en documentos"
ON public.documentos_cumplimiento
FOR ALL
TO authenticated
USING (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin')
WITH CHECK (cliente_id = public.get_auth_cliente_id() OR (auth.jwt() ->> 'role') = 'super_admin');

-- 12. Índices para Alto Rendimiento Multi-Tenant
CREATE INDEX IF NOT EXISTS idx_empleados_cliente ON public.empleados (cliente_id);
CREATE INDEX IF NOT EXISTS idx_empleados_ci ON public.empleados (ci);
CREATE INDEX IF NOT EXISTS idx_recibos_cliente_periodo ON public.recibos_salario (cliente_id, mes, anho);
CREATE INDEX IF NOT EXISTS idx_contratos_empleado ON public.contratos_trabajo (empleado_id);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente_tipo ON public.documentos_cumplimiento (cliente_id, tipo);
