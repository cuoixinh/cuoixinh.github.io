#!/usr/bin/env bash
# Deploy toàn bộ Edge Function lên Supabase. Chạy: npm run deploy:functions
# Cần đăng nhập trước một lần: npx supabase login
#
# Repo không có supabase/config.toml nên cờ verify_jwt phải truyền tay:
# function nào có thể bị gọi mà KHÔNG kèm header Authorization thì phải
# --no-verify-jwt, nếu không gateway chặn trước khi vào code.
set -euo pipefail

PROJECT_REF="lcobawmkywtxhpezndsh"

# Cổng gateway kiểm JWT — client luôn gửi Bearer <anon key>.
VERIFY=(
  wedding-admin      # admin/js/00-core.js: adminHeaders() luôn kèm anon key
  payment-handler    # core/payment.js
  ai-invitation      # core/dal/ai-dal.js: token user hoặc anon key
)

# Tự xác thực trong code, gọi được khi không có Authorization.
NO_VERIFY=(
  guest-handler      # core/dal/guest-dal.js: khách chưa đăng nhập không gửi header
  payos-webhook      # PayOS gọi từ ngoài, chỉ ký HMAC
)

for fn in "${VERIFY[@]}"; do
  echo "▶ $fn"
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

for fn in "${NO_VERIFY[@]}"; do
  echo "▶ $fn (--no-verify-jwt)"
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo "✅ Deploy xong toàn bộ Edge Function."
