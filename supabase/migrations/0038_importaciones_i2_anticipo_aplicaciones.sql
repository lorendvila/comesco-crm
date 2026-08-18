-- =====================================================================
-- 0038 — I-2 Anticipos: libro de aplicaciones (soft-delete) + estado pago / grado derivado
-- =====================================================================
-- Opción B. Cada aplicación parcial es una fila (hecho financiero). NO hay DELETE
-- físico: se ANULA (soft-delete) conservando historial. importe_utilizado se
-- materializa por trigger = SUM(aplicaciones ACTIVAS). Sin sobreaplicación (lock
-- FOR UPDATE + suma). Moneda de la aplicación = moneda del anticipo (sin FX).
-- READ-ONLY respecto a landed/inventario/pedidos/referencia_costes/kardex.

-- 1) estado del anticipo = ciclo de PAGO (solicitado/pagado/devuelto). 'aplicado'
--    pasa a GRADO derivado (vista). Migrar datos previos (no hay 'aplicado' hoy).
UPDATE public.importacion_anticipos SET estado='pagado' WHERE estado='aplicado';
ALTER TABLE public.importacion_anticipos DROP CONSTRAINT importacion_anticipos_estado_check;
ALTER TABLE public.importacion_anticipos ADD CONSTRAINT importacion_anticipos_estado_check
  CHECK (estado IN ('solicitado','pagado','devuelto'));

-- 2) Libro de aplicaciones (con anulación / soft-delete)
CREATE TABLE public.importacion_anticipo_aplicaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anticipo_id  uuid NOT NULL REFERENCES public.importacion_anticipos(id) ON DELETE CASCADE,
  importe      numeric(18,4) NOT NULL CHECK (importe > 0),   -- en la MONEDA del anticipo
  fecha        date,
  coste_id     uuid REFERENCES public.importacion_costes(id) ON DELETE SET NULL,
  documento_id uuid REFERENCES public.importacion_documentos(id) ON DELETE SET NULL,
  notas        text,
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  -- anulación (soft-delete): conserva trazabilidad; deja de computar en utilizado
  anulada_at   timestamptz,
  anulada_por  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  motivo_anulacion text
);
CREATE INDEX idx_ant_aplic_anticipo ON public.importacion_anticipo_aplicaciones(anticipo_id);
CREATE INDEX idx_ant_aplic_coste ON public.importacion_anticipo_aplicaciones(coste_id);

-- 3) Guard: reglas + no sobreaplicación (concurrencia) + mantener importe_utilizado
--    = SUM(aplicaciones ACTIVAS). Sin DELETE físico (trigger aparte).
CREATE OR REPLACE FUNCTION public.anticipo_aplicaciones_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ant record; v_suma numeric; v_aid uuid;
BEGIN
  v_aid := COALESCE(NEW.anticipo_id, OLD.anticipo_id);
  SELECT * INTO v_ant FROM public.importacion_anticipos WHERE id = v_aid FOR UPDATE;  -- serializa concurrencia

  IF TG_OP = 'INSERT' THEN
    IF v_ant.estado <> 'pagado' THEN
      RAISE EXCEPTION 'Solo se puede aplicar sobre un anticipo pagado (estado actual: %).', v_ant.estado USING ERRCODE='check_violation';
    END IF;
    IF NEW.coste_id IS NOT NULL AND (SELECT importacion_id FROM public.importacion_costes WHERE id=NEW.coste_id) IS DISTINCT FROM v_ant.importacion_id THEN
      RAISE EXCEPTION 'El coste vinculado no pertenece a esta importación.';
    END IF;
    IF NEW.documento_id IS NOT NULL AND (SELECT importacion_id FROM public.importacion_documentos WHERE id=NEW.documento_id) IS DISTINCT FROM v_ant.importacion_id THEN
      RAISE EXCEPTION 'El documento vinculado no pertenece a esta importación.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Anticipo cerrado -> aplicaciones inmutables (ni anular).
    IF v_ant.estado = 'devuelto' THEN
      RAISE EXCEPTION 'Anticipo devuelto (cerrado): sus aplicaciones son inmutables.';
    END IF;
    -- Aplicación ya anulada -> inmutable.
    IF OLD.anulada_at IS NOT NULL THEN
      RAISE EXCEPTION 'Una aplicación anulada es inmutable.';
    END IF;
    -- Si sigue activa (no es una anulación), validar vínculos de la misma importación.
    IF NEW.anulada_at IS NULL THEN
      IF NEW.coste_id IS NOT NULL AND (SELECT importacion_id FROM public.importacion_costes WHERE id=NEW.coste_id) IS DISTINCT FROM v_ant.importacion_id THEN
        RAISE EXCEPTION 'El coste vinculado no pertenece a esta importación.';
      END IF;
      IF NEW.documento_id IS NOT NULL AND (SELECT importacion_id FROM public.importacion_documentos WHERE id=NEW.documento_id) IS DISTINCT FROM v_ant.importacion_id THEN
        RAISE EXCEPTION 'El documento vinculado no pertenece a esta importación.';
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(SUM(importe),0) INTO v_suma
    FROM public.importacion_anticipo_aplicaciones WHERE anticipo_id = v_aid AND anulada_at IS NULL;
  IF v_suma > v_ant.importe THEN
    RAISE EXCEPTION 'Sobreaplicación: aplicado % supera el importe del anticipo %.', v_suma, v_ant.importe USING ERRCODE='check_violation';
  END IF;
  UPDATE public.importacion_anticipos SET importe_utilizado = v_suma, updated_at = now() WHERE id = v_aid;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_anticipo_aplicaciones_guard ON public.importacion_anticipo_aplicaciones;
CREATE TRIGGER trg_anticipo_aplicaciones_guard
  AFTER INSERT OR UPDATE ON public.importacion_anticipo_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.anticipo_aplicaciones_guard();

-- No-DELETE físico de aplicaciones (barrera dura; cubre service_role). Se anula, no se borra.
DROP TRIGGER IF EXISTS trg_aa_no_delete_fisico ON public.importacion_anticipo_aplicaciones;
CREATE TRIGGER trg_aa_no_delete_fisico BEFORE DELETE ON public.importacion_anticipo_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_fisico();

-- 4) Endurecer el anticipo: importe_utilizado no editable a mano; no-delete de
--    pagados/devueltos; no volver a 'solicitado' con aplicaciones.
CREATE OR REPLACE FUNCTION public.importacion_anticipos_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_suma numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado IN ('pagado','devuelto') THEN
      RAISE EXCEPTION 'Un anticipo pagado/devuelto es un hecho económico: no se borra físicamente. Archívalo (deleted_at).'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.importe_utilizado IS DISTINCT FROM OLD.importe_utilizado THEN
    SELECT COALESCE(SUM(importe),0) INTO v_suma
      FROM public.importacion_anticipo_aplicaciones WHERE anticipo_id = NEW.id AND anulada_at IS NULL;
    IF NEW.importe_utilizado <> v_suma THEN
      RAISE EXCEPTION 'importe_utilizado no es editable directamente: se mantiene desde las aplicaciones (esperado %).', v_suma;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.estado = 'solicitado' AND OLD.importe_utilizado > 0 THEN
    RAISE EXCEPTION 'No se puede volver a "solicitado" un anticipo con aplicaciones.';
  END IF;
  RETURN NEW;
END; $$;

-- 5) RLS + GRANTs (sin DELETE: se anula, no se borra)
ALTER TABLE public.importacion_anticipo_aplicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_select ON public.importacion_anticipo_aplicaciones FOR SELECT USING (can_access_importaciones());
CREATE POLICY aa_ins    ON public.importacion_anticipo_aplicaciones FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY aa_upd    ON public.importacion_anticipo_aplicaciones FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE ON public.importacion_anticipo_aplicaciones TO authenticated;

-- 6) Vista: grado_aplicacion derivado
CREATE OR REPLACE VIEW public.v_importacion_anticipos WITH (security_invoker = true) AS
SELECT a.*,
       (a.importe - a.importe_utilizado) AS saldo,
       round((a.importe - a.importe_utilizado) * a.tc, 2) AS saldo_cop,
       CASE WHEN a.importe_utilizado <= 0 THEN 'sin_aplicar'
            WHEN a.importe_utilizado >= a.importe THEN 'aplicado'
            ELSE 'parcial' END AS grado_aplicacion
FROM public.importacion_anticipos a
WHERE a.deleted_at IS NULL;
