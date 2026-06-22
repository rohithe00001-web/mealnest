CREATE OR REPLACE FUNCTION public.check_device_signup(_fingerprint text, _role text)
 RETURNS TABLE(allowed boolean, reason text, device_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE d record; existing int;
BEGIN
  SELECT * INTO d FROM public.devices WHERE fingerprint = _fingerprint;
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 'OK'::text, NULL::uuid; RETURN;
  END IF;
  IF d.blacklisted THEN
    INSERT INTO public.device_fraud_events(device_id, kind, details)
      VALUES (d.id, 'signup_blocked', jsonb_build_object('reason','blacklisted','role',_role));
    RETURN QUERY SELECT false, 'This device is blocked. Contact support.'::text, d.id; RETURN;
  END IF;
  SELECT COUNT(*) INTO existing FROM public.device_accounts
    WHERE device_id = d.id AND approval_status IN ('auto','approved');
  IF existing > 0 THEN
    INSERT INTO public.device_fraud_events(device_id, kind, details)
      VALUES (d.id, CASE WHEN _role IN ('seller','delivery_agent') THEN 'role_blocked' ELSE 'signup_blocked' END,
        jsonb_build_object('existing_accounts', existing, 'role', _role));
    RETURN QUERY SELECT false,
      'An account is already registered on this device. Please log in using the existing account or contact support.'::text,
      d.id; RETURN;
  END IF;
  RETURN QUERY SELECT true, 'OK'::text, d.id;
END $function$;