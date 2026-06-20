
-- 1) Allow authenticated users to submit abuse reports for themselves
CREATE POLICY "Users submit own abuse reports"
  ON public.abuse_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2) Allow delivery agents to update/delete their own files in agent-docs bucket
CREATE POLICY "Agents update own agent-docs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'agent-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'agent-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Agents delete own agent-docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'agent-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Restrict referral_campaigns reads to admins (do not expose fraud configuration publicly).
--    User-facing flows read campaigns via SECURITY DEFINER RPCs, so anon/non-admin reads aren't needed.
DROP POLICY IF EXISTS "campaigns readable" ON public.referral_campaigns;
CREATE POLICY "campaigns admin read"
  ON public.referral_campaigns
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Protect sensitive seller columns from anon/other authenticated users.
--    Owners read their own row via SECURITY DEFINER get_my_seller_record().
--    Admins read via admin_get_seller(). Public listings already select only safe columns.
REVOKE SELECT (bank_details, food_license_url, id_proof_url, phone, email)
  ON public.sellers FROM anon, authenticated;
