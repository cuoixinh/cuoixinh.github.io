#!/usr/bin/env bash
# Deploy Edge Function lên Supabase.
#   npm run deploy:functions                     → tất cả
#   npm run deploy:functions -- ai-chat           → chỉ ai-chat
#   npm run deploy:functions -- ai-chat ai-invitation wedding-admin
#
# Cần đăng nhập trước một lần: npx supabase login. Nếu biến môi trường
# SUPABASE_ACCESS_TOKEN đang giữ token cũ (bị từ chối là legacy) thì nó ĐÈ lên
# phiên đã login — chạy `SUPABASE_ACCESS_TOKEN= npm run deploy:functions ...`
# để vô hiệu nó.
#
# Repo không có supabase/config.toml nên cờ verify_jwt phải truyền tay:
# function nào có thể bị gọi mà KHÔNG kèm header Authorization thì phải
# --no-verify-jwt, nếu không gateway chặn trước khi vào code. Hai danh sách dưới
# đây là nguồn sự thật của cờ đó — thêm function mới thì thêm vào đúng một bên.
set -euo pipefail

PROJECT_REF="lcobawmkywtxhpezndsh"

# Cổng gateway kiểm JWT — client luôn gửi Bearer <anon key>.
VERIFY=(
  wedding-admin      # admin/js/00-core.js: adminHeaders() luôn kèm anon key
  payment-handler    # core/payment.js
  ai-invitation      # core/dal/ai-dal.js: token user hoặc anon key
  ai-chat            # core/dal/ai-chat-dal.js: token user hoặc anon key
)

# Tự xác thực trong code, gọi được khi không có Authorization.
NO_VERIFY=(
  guest-handler      # core/dal/guest-dal.js: khách chưa đăng nhập không gửi header
  payos-webhook      # PayOS gọi từ ngoài, chỉ ký HMAC
  cleanup-weddings   # pg_cron gọi qua pg_net, chỉ kèm x-admin-token
)

in_list() {
  local needle="$1"; shift
  local item
  for item in "$@"; do [ "$item" = "$needle" ] && return 0; done
  return 1
}

if [ $# -gt 0 ]; then
  TARGETS=("$@")
  # Soát hết tên TRƯỚC khi deploy: gõ nhầm mà đã đẩy nửa chừng thì khó lần.
  for fn in "${TARGETS[@]}"; do
    if ! in_list "$fn" "${VERIFY[@]}" && ! in_list "$fn" "${NO_VERIFY[@]}"; then
      echo "✗ Không biết function '$fn'." >&2
      echo "  Có: ${VERIFY[*]} ${NO_VERIFY[*]}" >&2
      exit 1
    fi
  done
else
  TARGETS=("${VERIFY[@]}" "${NO_VERIFY[@]}")
fi

for fn in "${TARGETS[@]}"; do
  if in_list "$fn" "${NO_VERIFY[@]}"; then
    echo "▶ $fn (--no-verify-jwt)"
    npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
  else
    echo "▶ $fn"
    npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  fi
done

echo "✅ Deploy xong: ${TARGETS[*]}"
