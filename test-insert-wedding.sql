-- ============================================================
-- TEST INSERT SCRIPT - Minimal Wedding Record
-- Creates a wedding record with only essential fields
-- All other fields will be NULL for customer to fill in
-- ============================================================

-- Insert minimal wedding record after successful payment
INSERT INTO weddings (
  slug,
  theme,
  payment_status,
  payment_order_id,
  payment_amount,
  payment_time
) VALUES (
  'test-wedding-' || floor(random() * 10000)::text,  -- Random slug for testing
  'template1',                                         -- Default theme
  'completed',                                         -- Payment completed
  'ORDER_' || floor(random() * 1000000)::text,        -- Test order ID
  159000,                                              -- Price: 159k VND
  NOW()                                                -- Payment time: now
);

-- Get the inserted wedding ID
-- SELECT id, slug FROM weddings ORDER BY created_at DESC LIMIT 1;
