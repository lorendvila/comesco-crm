-- =====================================================================
-- 0032 — Importaciones · FASE I-1 (documental + Storage)
-- =====================================================================
-- Aditivo. Dos dominios documentales SEPARADOS:
--   - importacion_documentos: expediente de una importación.
--   - operador_documentos:    documentación de alta/relación con un operador.
-- Protección de evidencia: un documento VALIDADO no se borra físicamente; se
-- archiva o se sustituye por una nueva versión (reemplaza_a). Storage privado
-- SIN policy de DELETE (ningún fichero se borra vía API).

-- ---------------------------------------------------------------------
-- 1) Catálogo de tipos de documento de importación (base de la checklist futura)
-- ---------------------------------------------------------------------
CREATE TABLE public.importacion_tipos_documento (
  codigo varchar(40) PRIMARY KEY,
  nombre varchar(120) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden  int
);
INSERT INTO public.importacion_tipos_documento (codigo, nombre, orden) VALUES
  ('proforma',            'Proforma',                     10),
  ('factura_comercial',   'Factura comercial',            20),
  ('packing_list',        'Packing list',                 30),
  ('bl',                  'Bill of Lading (BL)',          40),
  ('eur1',                'EUR.1',                         50),
  ('dua',                 'DUA',                          60),
  ('certificado_sanitario','Certificado sanitario',       70),
  ('analisis',            'Análisis',                     80),
  ('invima',              'Documentación INVIMA',         90),
  ('doc_aduanera',        'Documentación aduanera',      100),
  ('etiquetado',          'Etiquetado',                  110),
  ('garantia',            'Garantía',                    120),
  ('otro',                'Otro',                        999)
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) importacion_documentos (expediente)
-- ---------------------------------------------------------------------
CREATE TABLE public.importacion_documentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id uuid NOT NULL REFERENCES public.importaciones(id) ON DELETE CASCADE,
  tipo_codigo    varchar(40) REFERENCES public.importacion_tipos_documento(codigo) ON DELETE SET NULL,
  estado         varchar(15) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('sugerido','requerido','pendiente','recibido','validado','observado')),
  nombre_archivo varchar(255),
  storage_bucket varchar(60) NOT NULL DEFAULT 'importaciones',
  storage_path   text,
  mime_type      varchar(120),
  tamano_bytes   bigint,
  operador_id    uuid REFERENCES public.operadores(id) ON DELETE SET NULL,
  fecha          date,
  reemplaza_a    uuid REFERENCES public.importacion_documentos(id) ON DELETE SET NULL,
  validado_at    timestamptz,
  validado_por   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notas          text,
  subido_por     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX idx_impdoc_imp ON public.importacion_documentos(importacion_id);
CREATE INDEX idx_impdoc_tipo ON public.importacion_documentos(tipo_codigo);

-- ---------------------------------------------------------------------
-- 3) operador_documentos (alta/relación con el operador — SEPARADO)
-- ---------------------------------------------------------------------
CREATE TABLE public.operador_documentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id    uuid NOT NULL REFERENCES public.operadores(id) ON DELETE RESTRICT,
  tipo           varchar(60),
  estado         varchar(15) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','recibido','validado','observado','vigente','caducado')),
  nombre_archivo varchar(255),
  storage_bucket varchar(60) NOT NULL DEFAULT 'importaciones',
  storage_path   text,
  mime_type      varchar(120),
  tamano_bytes   bigint,
  fecha_emision  date,
  fecha_caducidad date,
  reemplaza_a    uuid REFERENCES public.operador_documentos(id) ON DELETE SET NULL,
  validado_at    timestamptz,
  validado_por   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notas          text,
  subido_por     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX idx_opdoc_operador ON public.operador_documentos(operador_id);

-- ---------------------------------------------------------------------
-- 4) Guard de evidencia validada (import docs)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importacion_documentos_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.validado_at IS NOT NULL THEN
      RAISE EXCEPTION 'Un documento validado no puede borrarse físicamente (evidencia). Archívalo o sustitúyelo por una nueva versión.'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  -- Al validar, sella quién y cuándo
  IF NEW.estado = 'validado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'validado') THEN
    NEW.validado_at  := COALESCE(NEW.validado_at, now());
    NEW.validado_por := COALESCE(NEW.validado_por, public.current_user_id());
  END IF;
  -- Documento ya validado: identidad inmutable (correcciones = nueva versión)
  IF TG_OP = 'UPDATE' AND OLD.validado_at IS NOT NULL THEN
    IF NEW.storage_path   IS DISTINCT FROM OLD.storage_path
    OR NEW.nombre_archivo IS DISTINCT FROM OLD.nombre_archivo
    OR NEW.tipo_codigo    IS DISTINCT FROM OLD.tipo_codigo THEN
      RAISE EXCEPTION 'La identidad de un documento validado es inmutable. Sube una nueva versión (reemplaza_a).';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_impdoc_guard ON public.importacion_documentos;
CREATE TRIGGER trg_impdoc_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.importacion_documentos
  FOR EACH ROW EXECUTE FUNCTION public.importacion_documentos_guard();

-- Guard de evidencia validada (operador docs)
CREATE OR REPLACE FUNCTION public.operador_documentos_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.validado_at IS NOT NULL THEN
      RAISE EXCEPTION 'Un documento de operador validado no puede borrarse físicamente (evidencia). Archívalo o sustitúyelo.'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.estado = 'validado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'validado') THEN
    NEW.validado_at  := COALESCE(NEW.validado_at, now());
    NEW.validado_por := COALESCE(NEW.validado_por, public.current_user_id());
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.validado_at IS NOT NULL THEN
    IF NEW.storage_path   IS DISTINCT FROM OLD.storage_path
    OR NEW.nombre_archivo IS DISTINCT FROM OLD.nombre_archivo THEN
      RAISE EXCEPTION 'La identidad de un documento de operador validado es inmutable. Sube una nueva versión (reemplaza_a).';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_opdoc_guard ON public.operador_documentos;
CREATE TRIGGER trg_opdoc_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.operador_documentos
  FOR EACH ROW EXECUTE FUNCTION public.operador_documentos_guard();

-- ---------------------------------------------------------------------
-- 5) RLS + GRANTs (tablas)
-- ---------------------------------------------------------------------
ALTER TABLE public.importacion_tipos_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY itd_select ON public.importacion_tipos_documento FOR SELECT USING (can_access_importaciones());
CREATE POLICY itd_ins    ON public.importacion_tipos_documento FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY itd_upd    ON public.importacion_tipos_documento FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE ON public.importacion_tipos_documento TO authenticated;

ALTER TABLE public.importacion_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY impdoc_select ON public.importacion_documentos FOR SELECT USING (can_access_importaciones());
CREATE POLICY impdoc_ins    ON public.importacion_documentos FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY impdoc_upd    ON public.importacion_documentos FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY impdoc_del    ON public.importacion_documentos FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacion_documentos TO authenticated;

ALTER TABLE public.operador_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY opdoc_select ON public.operador_documentos FOR SELECT USING (can_access_importaciones());
CREATE POLICY opdoc_ins    ON public.operador_documentos FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY opdoc_upd    ON public.operador_documentos FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY opdoc_del    ON public.operador_documentos FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operador_documentos TO authenticated;

-- ---------------------------------------------------------------------
-- 6) Storage: bucket privado + policies (SIN DELETE: evidencia protegida)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('importaciones', 'importaciones', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS imp_storage_select ON storage.objects;
DROP POLICY IF EXISTS imp_storage_insert ON storage.objects;
DROP POLICY IF EXISTS imp_storage_update ON storage.objects;
CREATE POLICY imp_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'importaciones' AND public.can_access_importaciones());
CREATE POLICY imp_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'importaciones' AND public.can_manage_importaciones());
CREATE POLICY imp_storage_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'importaciones' AND public.can_manage_importaciones())
  WITH CHECK (bucket_id = 'importaciones' AND public.can_manage_importaciones());
-- (No hay policy FOR DELETE: los ficheros del expediente no se borran vía API.)
