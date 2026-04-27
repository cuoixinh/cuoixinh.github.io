# PayOS Payment Integration - Deployment Guide

## 🎉 Implementation Complete!

All core functionality has been implemented. Follow this guide to deploy the PayOS payment integration.

---

## Pre-Deployment Checklist

### 1. PayOS Account Setup

- [ ] Register at https://payos.vn
- [ ] Complete KYC verification with CCCD (individual account)
- [ ] Link MB Bank account (or other supported bank)
- [ ] Get API credentials from PayOS dashboard:
  - API Key
  - Client ID
  - Checksum Key

### 2. Code Review

- [ ] Review `database-migration-payment.sql`
- [ ] Review `supabase/functions/payment-handler/index.ts`
- [ ] Review `supabase/functions/payment-handler/payos-client.ts`
- [ ] Review `payment.js` changes

---

## Deployment Steps

### Step 1: Database Migration

Run the migration script on your Supabase database:

```bash
# Connect to your Supabase project
# Run the migration file
psql -h <your-supabase-host> -U postgres -d postgres -f database-migration-payment.sql
```

Or use Supabase Dashboard:

1. Go to SQL Editor
2. Copy content from `database-migration-payment.sql`
3. Execute the script

**What it does:**

- Adds 5 columns to `weddings` table: `payment_status`, `payment_order_id`, `transaction_id`, `payment_time`, `payment_amount`
- Creates `payment_logs` audit table
- Creates indexes for performance

### Step 2: Configure Supabase Secrets

Add PayOS credentials to Supabase Secrets:

1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add the following secrets:

```
PAYOS_API_KEY=your_api_key_here
PAYOS_CLIENT_ID=your_client_id_here
PAYOS_CHECKSUM_KEY=your_checksum_key_here
```

### Step 3: Deploy Edge Function

Deploy the payment-handler Edge Function:

```bash
# Navigate to your project root
cd /path/to/your/project

# Deploy the function
supabase functions deploy payment-handler
```

**Verify deployment:**

```bash
# Test the function
curl https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/payment-handler/create-payment \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"manage_id":"test-123","customer_name":"Test","customer_phone":"0912345678","template_name":"Template 1"}'
```

### Step 4: Configure PayOS Webhook

1. Go to PayOS Dashboard → Settings → Webhooks
2. Add webhook URL:
   ```
   https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/payment-handler/webhook
   ```
3. Save and test the webhook

### Step 5: Deploy Frontend Changes

The `payment.js` file has been updated. Deploy it to your hosting:

```bash
# If using Cloudflare Pages, Netlify, or similar
git add payment.js
git commit -m "feat: integrate PayOS payment"
git push origin main
```

### Step 6: Enable Real Payment

In `payment.js`, verify the feature flag is enabled:

```javascript
const USE_REAL_PAYMENT = true; // Should be true for production
```

---

## Testing

### Test Payment Flow

1. **Open your website** (e.g., https://yourdomain.com)
2. **Select a template** and click "Thanh toán ngay"
3. **Fill in customer info** (name, phone, email)
4. **Click "Thanh toán ngay"**
5. **Verify QR code displays** with payment info
6. **Scan QR code** with your banking app
7. **Complete payment** (299,000 VND)
8. **Wait for polling** (should detect payment within 3-10 seconds)
9. **Verify success screen** shows with manage link

### Test Webhook

Use PayOS test mode to send test webhooks:

1. Go to PayOS Dashboard → Test Mode
2. Create a test payment
3. Complete the test payment
4. Verify webhook is received and processed
5. Check `payment_logs` table in Supabase

### Test Error Scenarios

1. **Network timeout**: Disable internet briefly during payment creation
2. **Invalid data**: Try submitting without name/phone
3. **Polling timeout**: Wait 10 minutes without paying
4. **Retry buttons**: Test "Kiểm tra lại" and "Tạo mã mới"

---

## Monitoring

### Check Payment Logs

Query the `payment_logs` table to monitor payment events:

```sql
-- Recent payment events
SELECT * FROM payment_logs
ORDER BY created_at DESC
LIMIT 20;

-- Failed payments
SELECT * FROM payment_logs
WHERE event_type = 'failed'
ORDER BY created_at DESC;

-- Completed payments today
SELECT * FROM payment_logs
WHERE event_type = 'completed'
AND created_at >= CURRENT_DATE;
```

### Check Wedding Records

Verify wedding records are created correctly:

```sql
-- Recent payments
SELECT id, slug, payment_status, payment_order_id, transaction_id, payment_time, payment_amount
FROM weddings
WHERE payment_status IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Pending payments
SELECT * FROM weddings
WHERE payment_status = 'pending'
ORDER BY created_at DESC;
```

---

## Rollback Plan

If you need to rollback to fake payment:

### Option 1: Feature Flag (Quick)

In `payment.js`, change:

```javascript
const USE_REAL_PAYMENT = false; // Disable real payment
```

Redeploy frontend. Users will see fake payment flow (1.5s delay).

### Option 2: Full Rollback

1. Revert `payment.js` to previous version
2. Redeploy frontend
3. Keep database migration (no harm)
4. Keep Edge Function deployed (won't be called)

---

## Troubleshooting

### QR Code Not Displaying

**Symptoms:** User clicks "Thanh toán ngay" but QR code doesn't show

**Check:**

1. Browser console for errors
2. Supabase Secrets are set correctly
3. Edge Function is deployed
4. PayOS API credentials are valid

**Fix:**

```bash
# Verify Edge Function logs
supabase functions logs payment-handler

# Test API credentials
curl https://api-merchant.payos.vn/v2/payment-requests \
  -H "x-client-id: YOUR_CLIENT_ID" \
  -H "x-api-key: YOUR_API_KEY"
```

### Webhook Not Working

**Symptoms:** Payment completed but status not updated

**Check:**

1. PayOS webhook URL is configured
2. Webhook signature verification is working
3. `payment_logs` table for webhook events

**Fix:**

```sql
-- Check webhook logs
SELECT * FROM payment_logs
WHERE event_type = 'webhook_received'
ORDER BY created_at DESC;

-- Check for signature errors
SELECT * FROM payment_logs
WHERE event_type = 'failed'
AND payload->>'error' LIKE '%signature%';
```

### Polling Not Detecting Payment

**Symptoms:** Payment completed but frontend still shows "Đang chờ thanh toán..."

**Check:**

1. Webhook updated database correctly
2. `payment_order_id` matches between frontend and database
3. Polling interval is 3 seconds

**Fix:**

```sql
-- Verify payment status
SELECT payment_status, payment_order_id, transaction_id
FROM weddings
WHERE payment_order_id = 'ORDER-1234567890-123';
```

### Database Migration Failed

**Symptoms:** Error when running migration script

**Check:**

1. Columns already exist (migration already run)
2. Permission issues

**Fix:**

```sql
-- Check if columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'weddings'
AND column_name IN ('payment_status', 'payment_order_id', 'transaction_id', 'payment_time', 'payment_amount');

-- If columns exist, skip migration
-- If not, check permissions and retry
```

---

## Support

### PayOS Support

- **Hotline:** 1900 8144 (8h-17h30, T2-T6)
- **Email:** support@payos.vn
- **Docs:** https://payos.vn/docs

### Supabase Support

- **Docs:** https://supabase.com/docs
- **Discord:** https://discord.supabase.com

---

## Next Steps (Optional)

After successful deployment, consider:

1. **Add comprehensive test suite** (26 optional test tasks in tasks.md)
2. **Add payment cancellation** feature
3. **Add refund API** integration
4. **Add email notifications** for successful payments
5. **Add payment history dashboard** for customers
6. **Support multiple payment amounts** (currently fixed at 299,000 VND)
7. **Add payment analytics** and reporting

---

## Security Notes

1. **Never commit secrets** to git (API keys, checksum keys)
2. **Use Supabase Secrets** for all sensitive data
3. **Verify webhook signatures** (already implemented)
4. **Use HTTPS only** for all API calls
5. **Validate all user inputs** (already implemented)
6. **Monitor payment_logs** for suspicious activity

---

**Deployment Date:** ******\_******

**Deployed By:** ******\_******

**PayOS Account:** ******\_******

**Notes:**

---

---

---
