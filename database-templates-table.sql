-- Migration: Create templates table
-- Store template information in database instead of hardcoding in frontend

-- Create templates table
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL, -- e.g., "classic", "modern"
  template_name TEXT NOT NULL, -- e.g., "template1", "template2" (matches theme field)
  display_name TEXT NOT NULL, -- e.g., "Classic Elegance"
  description TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  features TEXT[], -- e.g., ["gallery", "map", "qrcode", "rsvp"]
  status TEXT DEFAULT 'active', -- active | coming_soon | inactive
  category TEXT, -- traditional | modern | luxury | minimal
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE public.templates IS 'Danh sách mẫu thiệp cưới';
COMMENT ON COLUMN public.templates.template_id IS 'ID duy nhất cho template (dùng trong code): classic, modern';
COMMENT ON COLUMN public.templates.template_name IS 'Tên file template (theme): template1, template2';
COMMENT ON COLUMN public.templates.display_name IS 'Tên hiển thị: Classic Elegance';
COMMENT ON COLUMN public.templates.description IS 'Mô tả ngắn về template';
COMMENT ON COLUMN public.templates.thumbnail_url IS 'URL ảnh thumbnail';
COMMENT ON COLUMN public.templates.preview_url IS 'URL preview template';
COMMENT ON COLUMN public.templates.features IS 'Mảng tính năng: gallery, map, qrcode, rsvp, countdown, music';
COMMENT ON COLUMN public.templates.status IS 'Trạng thái: active, coming_soon, inactive';
COMMENT ON COLUMN public.templates.category IS 'Danh mục: traditional, modern, luxury, minimal';
COMMENT ON COLUMN public.templates.sort_order IS 'Thứ tự hiển thị (số nhỏ lên trước)';

-- Enable RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active templates
CREATE POLICY "Anyone can read active templates"
  ON public.templates
  FOR SELECT
  USING (is_active = true);

-- Policy: Only service role can manage templates
CREATE POLICY "Service role can manage templates"
  ON public.templates
  FOR ALL
  USING (auth.role() = 'service_role');

-- Insert default templates
INSERT INTO public.templates (
  template_id, 
  template_name, 
  display_name, 
  description, 
  thumbnail_url, 
  preview_url, 
  features, 
  status, 
  category, 
  sort_order
) VALUES
  (
    'classic',
    'template1',
    'Classic Elegance',
    'Thiết kế sang trọng, cổ điển với màu pastel nhẹ nhàng',
    'assets/images/ZIN_3506.jpg',
    'themes/template1.html?preview=true',
    ARRAY['gallery', 'map', 'qrcode', 'rsvp'],
    'active',
    'traditional',
    1
  ),
  (
    'modern',
    'template2',
    'Modern Minimalist',
    'Phong cách tối giản, hiện đại cho cặp đôi trẻ trung',
    'assets/images/ZIN_3719.jpg',
    'themes/template2.html?preview=true',
    ARRAY['gallery', 'map', 'qrcode'],
    'active',
    'modern',
    2
  )
ON CONFLICT (template_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  thumbnail_url = EXCLUDED.thumbnail_url,
  preview_url = EXCLUDED.preview_url,
  features = EXCLUDED.features,
  status = EXCLUDED.status,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_templates_updated_at ON public.templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_templates_template_id ON public.templates(template_id);
CREATE INDEX IF NOT EXISTS idx_templates_template_name ON public.templates(template_name);
CREATE INDEX IF NOT EXISTS idx_templates_status ON public.templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_active ON public.templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_sort_order ON public.templates(sort_order);
