#!/usr/bin/env bash
# Deploy Edge Function lên Supabase. MÔI TRƯỜNG chọn bằng cờ, KHÔNG phải biến môi
# trường — cú pháp `VAR=x lệnh` chỉ chạy ở bash, gõ trên PowerShell là lỗi cú pháp
# và rất dễ tưởng mình đang đẩy lên staging trong khi thật ra đang đẩy production.
#
#   npm run deploy:functions:staging              → staging, tất cả function
#   npm run deploy:functions                      → production, tất cả function
#   npm run deploy:functions:all                  → CẢ HAI (staging trước)
#   npm run deploy:functions:staging -- ai-chat   → chỉ một vài function
#
# Cũng nhận --ref=<ref> cho project khác, và vẫn đọc SUPABASE_PROJECT_REF nếu có.
#
# Mã nguồn hai môi trường là MỘT, khác nhau ở secrets của từng project — nên sửa
# Edge Function xong phải deploy CẢ HAI, không thì hai bên chạy hai bản khác nhau
# mà không có gì báo. Đó là lý do có `:all`.
#
# Repo không có supabase/config.toml nên cờ verify_jwt phải truyền tay:
# function nào có thể bị gọi mà KHÔNG kèm header Authorization thì phải
# --no-verify-jwt, nếu không gateway chặn trước khi vào code. Hai danh sách dưới
# đây là nguồn sự thật của cờ đó — thêm function mới thì thêm vào đúng một bên.
set -euo pipefail

PROD_REF="lcobawmkywtxhpezndsh"
STAGING_REF="gmtnoxdwoumbtdmqmisk"

# Tách cờ môi trường ra khỏi danh sách tên function.
REFS=()
ARGS=()
for a in "$@"; do
  case "$a" in
    --staging) REFS+=("$STAGING_REF") ;;
    --prod|--production) REFS+=("$PROD_REF") ;;
    --all) REFS+=("$STAGING_REF" "$PROD_REF") ;;
    --ref=*) REFS+=("${a#--ref=}") ;;
    -*) echo "✗ Cờ lạ: $a" >&2; exit 1 ;;
    *) ARGS+=("$a") ;;
  esac
done
[ ${#REFS[@]} -eq 0 ] && REFS=("${SUPABASE_PROJECT_REF:-$PROD_REF}")
set -- "${ARGS[@]+${ARGS[@]}}"

# SUPABASE_ACCESS_TOKEN (nếu có) ĐÈ lên phiên `npx supabase login`. Token cũ kiểu
# legacy bị từ chối 401 ở tận bước deploy, thông báo không hề nhắc tới biến này.
# Thử trước một lệnh nhẹ; hỏng thì bỏ biến đi rồi chạy tiếp bằng phiên đã login.
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && ! npx supabase projects list >/dev/null 2>&1; then
  echo "⚠ SUPABASE_ACCESS_TOKEN bị từ chối — bỏ qua nó, dùng phiên 'npx supabase login'."
  unset SUPABASE_ACCESS_TOKEN
fi

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

for PROJECT_REF in "${REFS[@]}"; do
  case "$PROJECT_REF" in
    "$PROD_REF")    echo "▶ Project: $PROJECT_REF  (PRODUCTION)" ;;
    "$STAGING_REF") echo "▶ Project: $PROJECT_REF  (staging)" ;;
    *)              echo "▶ Project: $PROJECT_REF" ;;
  esac

  for fn in "${TARGETS[@]}"; do
    if in_list "$fn" "${NO_VERIFY[@]}"; then
      echo "▶ $fn (--no-verify-jwt)"
      npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
    else
      echo "▶ $fn"
      npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
    fi
  done
done

echo "✅ Deploy xong: ${TARGETS[*]}  →  ${REFS[*]}"
