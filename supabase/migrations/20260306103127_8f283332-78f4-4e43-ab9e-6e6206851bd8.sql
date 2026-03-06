
-- Create analysis history table
CREATE TABLE public.analysis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_lines INTEGER NOT NULL DEFAULT 0,
  suspicious_count INTEGER NOT NULL DEFAULT 0,
  threat_level TEXT NOT NULL DEFAULT 'Low',
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read history
CREATE POLICY "Anyone can view analysis history"
  ON public.analysis_history FOR SELECT
  USING (true);

-- Allow anyone to insert (no auth required for this tool)
CREATE POLICY "Anyone can insert analysis history"
  ON public.analysis_history FOR INSERT
  WITH CHECK (true);

-- Index for fast ordering
CREATE INDEX idx_analysis_history_created_at ON public.analysis_history (created_at DESC);
