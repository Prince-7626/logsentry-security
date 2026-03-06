
CREATE POLICY "Anyone can delete analysis history"
  ON public.analysis_history FOR DELETE
  USING (true);
