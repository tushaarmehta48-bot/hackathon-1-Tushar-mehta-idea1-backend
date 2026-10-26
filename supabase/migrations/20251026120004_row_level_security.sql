-- Row level security: direct Supabase access is constrained; NestJS uses service role for writes.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own_or_staff
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_staff_or_admin());

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_manage
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public venue layout (no PII)
CREATE POLICY dining_areas_public_read
  ON public.dining_areas
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY dining_areas_admin_write
  ON public.dining_areas
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY restaurant_tables_public_read
  ON public.restaurant_tables
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY restaurant_tables_admin_write
  ON public.restaurant_tables
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY service_shifts_public_read
  ON public.service_shifts
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY service_shifts_admin_write
  ON public.service_shifts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY season_rules_public_read
  ON public.season_rules
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

CREATE POLICY season_rules_admin_write
  ON public.season_rules
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY service_exceptions_public_read
  ON public.service_exceptions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY service_exceptions_admin_write
  ON public.service_exceptions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY booking_policies_public_read
  ON public.booking_policies
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY booking_policies_admin_write
  ON public.booking_policies
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY table_blocks_staff_read
  ON public.table_blocks
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY table_blocks_admin_write
  ON public.table_blocks
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- reservations: reads scoped; mutations only via service role (NestJS)
CREATE POLICY reservations_customer_read_own
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY reservations_staff_read
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY payments_customer_read_own
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.id = payments.reservation_id
        AND r.customer_id = auth.uid()
    )
  );

CREATE POLICY payments_staff_read
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY check_in_logs_staff_read
  ON public.check_in_logs
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY check_in_logs_staff_insert
  ON public.check_in_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_or_admin() AND staff_id = auth.uid());

CREATE POLICY audit_logs_admin_read
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY notifications_user_read
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_staff_read
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());
