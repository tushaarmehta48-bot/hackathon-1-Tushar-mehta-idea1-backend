-- Fix staff/admin portal bootstrap: service role and SECURITY DEFINER upsert for privileged roles.

CREATE OR REPLACE FUNCTION public.enforce_profile_role_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '');

  IF current_setting('app.portal_bootstrap', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'CUSTOMER' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Public signup cannot grant privileged roles';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change profile roles';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_portal_profile(
  p_user_id uuid,
  p_role public.user_role,
  p_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.portal_bootstrap', 'on', true);
  INSERT INTO public.profiles (id, role, display_name, preferred_locale, active)
  VALUES (p_user_id, p_role, p_display_name, 'en', true)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    active = true;
  PERFORM set_config('app.portal_bootstrap', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_portal_profile(uuid, public.user_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_portal_profile(uuid, public.user_role, text) TO service_role;
