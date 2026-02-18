-- Allow users to update their own push subscriptions (needed for UPSERT)
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

