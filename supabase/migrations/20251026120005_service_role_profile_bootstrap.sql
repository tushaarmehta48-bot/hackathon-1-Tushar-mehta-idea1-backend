-- Allow backend (service_role) to set privileged profile roles during portal user bootstrap.

CREATE OR REPLACE FUNCTION public.enforce_profile_role_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
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
