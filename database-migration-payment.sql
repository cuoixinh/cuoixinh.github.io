-- Migration: Add payment fields to weddings table
-- Date: 2026-01-27
-- Description: Add payment tracking columns for PayOS integration

-- Add payment columns to weddings table
ALTER TABLE weddings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS payment_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_amount INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_weddings_payment_order_id ON weddings(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_weddings_transaction_id ON weddings(transaction_id);
CREATE INDEX IF NOT EXISTS idx_weddings_payment_status ON weddings(payment_status);

-- Add comments for documentation
COMMENT ON COLUMN weddings.payment_status IS 'Trạng thái thanh toán: pending, completed, failed';
COMMENT ON COLUMN weddings.payment_order_id IS 'PayOS order ID (unique per transaction)';
COMMENT ON COLUMN weddings.transaction_id IS 'PayOS transaction reference from bank';
COMMENT ON COLUMN weddings.payment_time IS 'Thời gian thanh toán thành công';
COMMENT ON COLUMN weddings.payment_amount IS 'Số tiền đã thanh toán (VND)';

-- Create payment_logs table for audit trail
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  manage_id UUID,
  event_type TEXT NOT NULL, -- 'created', 'webhook_received', 'completed', 'failed'
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for payment_logs
CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_manage_id ON payment_logs(manage_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at DESC);

-- Add comments
COMMENT ON TABLE payment_logs IS 'Audit trail for all payment events';
COMMENT ON COLUMN payment_logs.event_type IS 'Type of payment event: created, webhook_received, completed, failed';
COMMENT ON COLUMN payment_logs.payload IS 'Full payload data from PayOS or internal events';
