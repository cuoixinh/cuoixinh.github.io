#!/usr/bin/env bash
# Deploy Cloudflare Worker. MÔI TRƯỜNG chọn bằng cờ, giống deploy-functions.sh —
# mỗi worker là một file .toml riêng, gõ tay `wrangler deploy --config <file>` bốn
# lần thì rất dễ sót một cái hoặc đẩy nhầm file production trong lúc định thử staging.
#
#   npm run deploy:workers:staging            → staging, cả 4 worker
#   npm run deploy:workers                    → PRODUCTION, cả 4 worker
#   npm run deploy:workers:all                → CẢ HAI (staging trước)
#   npm run deploy:workers:staging -- image   → chỉ một vài worker
#   npm run deploy:workers:all -- --dry-run   → build thử, không đẩy lên
#
# Hai điều dễ mất dữ liệu, nhớ trước khi chạy:
#   • `[vars]` trong .toml GHI ĐÈ biến trên Dashboard mỗi lần deploy. Biến nào
#     thêm tay ở Dashboard mà không có trong .toml sẽ biến mất. Secret (đặt bằng
#     `wrangler secret put`) thì KHÔNG bị đụng.
#   • wrangler đọc FILE TRÊN MÁY, không đi qua git. Cây làm việc bẩn là bạn đang
#     đẩy lên thứ chưa ai xem — script nhắc nhưng không chặn.
#
# Lùi lại một worker:  wrangler rollback --config <file>
set -euo pipefail

cd "$(dirname "$0")/.."
WORKER_DIR="cloudflare-worker"

# Bốn worker, mỗi môi trường một .toml. Thêm worker mới thì thêm vào CẢ BA dãy,
# cùng thứ tự — script khớp chúng theo chỉ số.
NAMES=(webhook image templates cache)
PROD_CFG=(wrangler-webhook.toml wrangler-image.toml wrangler-templates.toml wrangler.toml)
STAGING_CFG=(wrangler-webhook-staging.toml wrangler-image-staging.toml wrangler-templates-staging.toml wrangler-staging.toml)

ENVS=()
TARGETS=()
PASSTHRU=()
for a in "$@"; do
  case "$a" in
    --staging) ENVS+=("staging") ;;
    --prod|--production) ENVS+=("production") ;;
    --all) ENVS+=("staging" "production") ;;
    --dry-run) PASSTHRU+=("--dry-run") ;;
    -*) echo "✗ Cờ lạ: $a" >&2; exit 1 ;;
    *) TARGETS+=("$a") ;;
  esac
done
[ ${#ENVS[@]} -eq 0 ] && ENVS=("production")

index_of() {
  local needle="$1" i
  for i in "${!NAMES[@]}"; do
    [ "${NAMES[$i]}" = "$needle" ] && { echo "$i"; return 0; }
  done
  return 1
}

# Soát hết tên TRƯỚC khi deploy: gõ nhầm mà đã đẩy nửa chừng thì khó lần.
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=("${NAMES[@]}")
else
  for t in "${TARGETS[@]}"; do
    if ! index_of "$t" >/dev/null; then
      echo "✗ Không biết worker '$t'." >&2
      echo "  Có: ${NAMES[*]}" >&2
      exit 1
    fi
  done
fi

if [ -n "$(git status --porcelain "$WORKER_DIR" 2>/dev/null)" ]; then
  echo "⚠ $WORKER_DIR đang có thay đổi chưa commit — wrangler đẩy đúng bản trên máy này."
fi

for ENV in "${ENVS[@]}"; do
  if [ "$ENV" = "production" ]; then
    echo "▶ Môi trường: PRODUCTION"
  else
    echo "▶ Môi trường: staging"
  fi

  for t in "${TARGETS[@]}"; do
    i="$(index_of "$t")"
    if [ "$ENV" = "production" ]; then
      cfg="${PROD_CFG[$i]}"
    else
      cfg="${STAGING_CFG[$i]}"
    fi

    path="$WORKER_DIR/$cfg"
    if [ ! -f "$path" ]; then
      echo "✗ Thiếu $path" >&2
      exit 1
    fi
    # Placeholder trong .toml lọt qua thì wrangler báo lỗi id KV rất khó hiểu.
    if grep -q "THAY_BANG_" "$path"; then
      echo "✗ $cfg còn chỗ chưa điền (THAY_BANG_…) — xem comment đầu file." >&2
      exit 1
    fi

    echo "▶ $t  ($cfg)"
    ( cd "$WORKER_DIR" && npx wrangler deploy --config "$cfg" ${PASSTHRU[@]+"${PASSTHRU[@]}"} )
  done
done

echo "✅ Deploy xong: ${TARGETS[*]}  →  ${ENVS[*]}"
