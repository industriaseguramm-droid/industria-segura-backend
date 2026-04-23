-- ════════════════════════════════════════════════════════════
--  INDUSTRIA SEGURA MM — Script completo de base de datos
--  Ejecutar en: Supabase → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════

-- TABLA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre         TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  rol            TEXT NOT NULL CHECK (rol IN ('admin', 'colaborador', 'cliente')),
  cliente_id     UUID,
  activo         BOOLEAN DEFAULT TRUE,
  ultimo_acceso  TIMESTAMPTZ,
  creado_por     UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_comercial    TEXT NOT NULL,
  razon_social        TEXT,
  rfc                 TEXT,
  representante_legal TEXT,
  domicilio           TEXT,
  municipio           TEXT,
  giro                TEXT,
  telefono            TEXT,
  email               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: expedientes
CREATE TABLE IF NOT EXISTS expedientes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folio          TEXT UNIQUE NOT NULL,
  cliente_id     UUID REFERENCES clientes(id) ON DELETE CASCADE,
  token_acceso   UUID UNIQUE NOT NULL,
  estatus        TEXT NOT NULL DEFAULT 'pendiente_cliente'
                 CHECK (estatus IN (
                   'pendiente_cliente',
                   'en_captura',
                   'listo_para_revision',
                   'en_revision',
                   'observaciones',
                   'aprobado',
                   'completado'
                 )),
  progreso       INTEGER DEFAULT 0 CHECK (progreso BETWEEN 0 AND 100),
  datos_json     JSONB DEFAULT '{}',
  creado_por     UUID REFERENCES usuarios(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: archivos
CREATE TABLE IF NOT EXISTS archivos (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expediente_id      UUID REFERENCES expedientes(id) ON DELETE CASCADE,
  categoria          TEXT NOT NULL,
  nombre_original    TEXT NOT NULL,
  nombre_storage     TEXT NOT NULL,
  url_publica        TEXT NOT NULL,
  tipo_archivo       TEXT,
  tamaño_bytes       INTEGER,
  estatus_campo      TEXT DEFAULT 'subido'
                     CHECK (estatus_campo IN (
                       'subido', 'no_tengo', 'no_aplica',
                       'pendiente', 'version_final'
                     )),
  es_documento_plan  BOOLEAN DEFAULT FALSE,
  subido_por         UUID REFERENCES usuarios(id),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: observaciones
CREATE TABLE IF NOT EXISTS observaciones (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expediente_id  UUID REFERENCES expedientes(id) ON DELETE CASCADE,
  usuario_id     UUID REFERENCES usuarios(id),
  mensaje        TEXT NOT NULL,
  tipo           TEXT DEFAULT 'comentario'
                 CHECK (tipo IN ('comentario', 'solicitud', 'aprobacion')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: configuracion
CREATE TABLE IF NOT EXISTS configuracion (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  color_primario      TEXT DEFAULT '#D72B2B',
  color_secundario    TEXT DEFAULT '#111111',
  nombre_empresa      TEXT DEFAULT 'Industria Segura MM',
  mensaje_bienvenida  TEXT DEFAULT 'Bienvenido a tu portal de Protección Civil',
  submensaje          TEXT DEFAULT 'Captura la información de tu negocio.',
  logo_url            TEXT,
  whatsapp            TEXT,
  campos_activos      JSONB,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracion (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_expedientes_cliente  ON expedientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_expedientes_token    ON expedientes(token_acceso);
CREATE INDEX IF NOT EXISTS idx_expedientes_estatus  ON expedientes(estatus);
CREATE INDEX IF NOT EXISTS idx_archivos_expediente  ON archivos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_observaciones_exp    ON observaciones(expediente_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email       ON usuarios(email);

-- ROW LEVEL SECURITY
ALTER TABLE usuarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedientes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backend_full_access" ON usuarios      FOR ALL USING (true);
CREATE POLICY "backend_full_access" ON clientes      FOR ALL USING (true);
CREATE POLICY "backend_full_access" ON expedientes   FOR ALL USING (true);
CREATE POLICY "backend_full_access" ON archivos      FOR ALL USING (true);
CREATE POLICY "backend_full_access" ON observaciones FOR ALL USING (true);
CREATE POLICY "backend_full_access" ON configuracion FOR ALL USING (true);

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES ('expedientes', 'expedientes', true)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('configuracion', 'configuracion', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "storage_expedientes_access" ON storage.objects
  FOR ALL USING (bucket_id = 'expedientes');

CREATE POLICY "storage_configuracion_access" ON storage.objects
  FOR ALL USING (bucket_id = 'configuracion');

-- USUARIO ADMIN INICIAL
-- Email:      abel@industriasegura.mx
-- Contraseña: IndustriaSegura2025!
-- Cambia la contraseña en tu primer login
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES (
  'Abel Morales',
  'abel@industriasegura.mx',
  '$2a$12$K8GpOXnSHOlTaVlZJF3sO.qeU8zPxRQKJd5VnGDMlBVmj3Yk9Kw4u',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- VERIFICACIÓN: debe mostrar 6 tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
