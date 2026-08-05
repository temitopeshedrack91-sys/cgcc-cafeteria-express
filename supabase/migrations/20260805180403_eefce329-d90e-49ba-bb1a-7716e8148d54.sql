CREATE POLICY "anyone uploads payment proof"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "staff read payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier')));

CREATE POLICY "admin deletes payment proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(),'admin'));