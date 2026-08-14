-- =====================================================================
-- 0034 — Importaciones · FASE I-2 (anticipos/pagos — mínimo)
-- =====================================================================
-- Solo conserva los hechos (importe/moneda/TC/COP, fechas, utilizado). SIN
-- tesorería, SIN P&L, SIN cálculo de coste del capital. El TC del anticipo es
-- el EFECTIVO del pago (distinto del TC de valoración del coste -> base del FX
-- futuro; aquí solo se guarda).

CREATE TABLE public.importacion_anticipos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id  uuid NOT NULL REFERENCES public.importaciones(id) ON DELETE CASCADE,
  operador_id     uuid REFERENCES public.operadores(id) ON DELETE SET NULL,
  coste_id        uuid REFERENCES public.importacion_costes(id) ON DELETE SET NULL,
  concepto        varchar(160),
  importe         numeric(18,4) NOT NULL CHECK (importe >= 0),
  moneda          varchar(3) NOT NULL DEFAULT 'EUR',
  tc              numeric(18,6),                         -- TC efectivo del pago
  importe_cop     numeric(18,2) GENERATED ALWAYS AS (round(importe * tc, 2)) STORED,
  estado          varchar(15) NOT NULL DEFAULT 'solicitado'
    CHECK (estado IN ('solicitado','pagado','aplicado','devuelto')),
  importe_utilizado numeric(18,4) NOT NULL DEFAULT 0 CHECK (importe_utilizado >= 0),
  fecha_solicitud date,
  fecha_pago      date,
  documento_id    uuid REFERENCES public.importacion_documentos(id) ON DELETE SET NULL,
  notas           text,
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT chk_ant_tc CHECK (importe = 0 OR tc IS NOT NULL),
  CONSTRAINT chk_ant_utilizado CHECK (importe_utilizado <= importe)
);
CREATE INDEX idx_impanticipos_imp ON public.importacion_anticipos(importacion_id);
CREATE INDEX idx_impanticipos_op ON public.importacion_anticipos(operador_id);

-- No-delete de anticipos ya pagados/aplicados (hecho económico); archivado si no.
CREATE OR REPLACE FUNCTION public.importacion_anticipos_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado IN ('pagado','aplicado') THEN
      RAISE EXCEPTION 'Un anticipo pagado/aplicado es un hecho económico: no se borra físicamente. Archívalo (deleted_at).'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_importacion_anticipos_guard ON public.importacion_anticipos;
CREATE TRIGGER trg_importacion_anticipos_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.importacion_anticipos
  FOR EACH ROW EXECUTE FUNCTION public.importacion_anticipos_guard();

-- Vista con saldo (security_invoker).
CREATE OR REPLACE VIEW public.v_importacion_anticipos WITH (security_invoker = true) AS
SELECT a.*, (a.importe - a.importe_utilizado) AS saldo,
       round((a.importe - a.importe_utilizado) * a.tc, 2) AS saldo_cop
FROM public.importacion_anticipos a
WHERE a.deleted_at IS NULL;

ALTER TABLE public.importacion_anticipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY impant_select ON public.importacion_anticipos FOR SELECT USING (can_access_importaciones());
CREATE POLICY impant_ins    ON public.importacion_anticipos FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY impant_upd    ON public.importacion_anticipos FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY impant_del    ON public.importacion_anticipos FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacion_anticipos TO authenticated;
GRANT SELECT ON public.v_importacion_anticipos TO authenticated;
