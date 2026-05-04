-- Migration: Add original_price column to template_pricing
-- This allows showing both original price and discounted price in UI

-- Add original_price column (nullable for backward compatibility)
ALTER TABLE public.template_pricing 
ADD COLUMN IF NOT EXISTS original_price INTEGER;

COMMENT ON COLUMN public.template_pricing.original_price IS 'Giá gốc trước khuyến mãi (VND). NULL = không có khuyến mãi';
COMMENT ON COLUMN public.template_pricing.price IS 'Giá sau khuyến mãi (VND). Đây là giá thực tế khách phải trả';

-- Update existing records with original prices
UPDATE public.template_pricing 
SET original_price = 499000
WHERE template_name = 'template1' AND original_price IS NULL;

UPDATE public.template_pricing 
SET original_price = 399000
WHERE template_name = 'template2' AND original_price IS NULL;

-- Update current prices to discounted prices
UPDATE public.template_pricing 
SET price = 299000, description = 'Template 1 - Classic Elegance - 299.000đ (Giảm từ 499.000đ)'
WHERE template_name = 'template1';

UPDATE public.template_pricing 
SET price = 199000, description = 'Template 2 - Modern Minimalist - 199.000đ (Giảm từ 399.000đ)'
WHERE template_name = 'template2';
