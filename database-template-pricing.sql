-- Migration: Add template pricing table
-- This ensures payment amounts are controlled server-side for security

-- Create template_pricing table
CREATE TABLE IF NOT EXISTS public.template_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT UNIQUE NOT NULL,
  price INTEGER NOT NULL, -- Price in VND
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.template_pricing ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active pricing
CREATE POLICY "Anyone can read active pricing"
  ON public.template_pricing
  FOR SELECT
  USING (is_active = true);

-- Policy: Only service role can insert/update/delete
CREATE POLICY "Service role can manage pricing"
  ON public.template_pricing
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert default pricing for 2 templates (using theme names)
INSERT INTO public.template_pricing (template_name, price, description) VALUES
  ('template1', 29, 'Template 1 - Classic Elegance - 29đ'),
  ('template2', 19, 'Template 2 - Modern Minimalist - 19đ')
ON CONFLICT (template_name) DO UPDATE SET 
  price = EXCLUDED.price,
  description = EXCLUDED.description;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_template_pricing_updated_at ON public.template_pricing;
CREATE TRIGGER update_template_pricing_updated_at
  BEFORE UPDATE ON public.template_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_template_pricing_updated_at();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_template_pricing_name ON public.template_pricing(template_name);
CREATE INDEX IF NOT EXISTS idx_template_pricing_active ON public.template_pricing(is_active);
