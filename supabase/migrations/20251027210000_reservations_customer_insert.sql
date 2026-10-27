-- Allow authenticated customers to insert their own row if a client ever uses the user JWT.
-- NestJS normally inserts via service_role (bypasses RLS).

CREATE POLICY reservations_customer_insert_own
  ON public.reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IS NOT NULL
    AND customer_id = auth.uid()
    AND created_by = auth.uid()
  );
